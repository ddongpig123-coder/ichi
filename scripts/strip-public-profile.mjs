// usersPublic（公開プロフィール）から学校・学部・入学年度を消す (2026-11-10)
//
//   node strip-public-profile.mjs                 # 점검만 (기본. 아무것도 안 쓴다)
//   node strip-public-profile.mjs --write         # 남아 있는 문서에서 3필드를 지운다
//   node strip-public-profile.mjs --write --key keys/serviceAccount.json
//
// 왜:
//   공개 프로필은 「친구 목록·초대 화면에 이름과 사진을 보여 주기」 위한 것인데,
//   예전 버전이 학교(schoolDomain)·학부(department)·입학년도(admissionYear)까지 같이 실었다.
//   어느 화면도 남의 이 값을 쓰지 않고, 개인정보처리방침의 「所属等が他の利用者に公開される
//   ことはありません」과도 맞지 않는다. 본인 값은 users/{uid}（본인만 읽음）에 그대로 있다.
//
// 순서 (지키지 않으면 다시 생긴다):
//   ① 앱(OTA)이 이 3필드를 더 이상 쓰지 않게 한다 + 앱을 켤 때 자기 문서에서 지운다
//      (src/services/userService.ts ensureUserProfile)  ← 이 스크립트보다 먼저 배포
//   ② 이 스크립트로 **앱을 안 켜는 사람**의 문서까지 한 번에 지운다
//   ③ 스토어 빌드에 내장된 옛 코드(첫 실행)는 여전히 이 값을 쓴다. 그래서 새 빌드가
//      양쪽 스토어에 나가기 전까지는 가끔 다시 돌린다(멱등). 규칙에서 3필드를 막는 건
//      새 빌드 이후(막으면 옛 코드의 온보딩이 실패한다)
//
// 성질:
//   - **기본은 점검 전용.** 쓰기는 `--write` 를 줄 때만
//   - 멱등. 3필드가 없는 문서는 건드리지 않는다. 닉네임·사진·uid 는 절대 안 건드린다
//   - 읽기 = usersPublic 문서 수(수백 건). Spark 하루 한도(5만)에 영향 거의 없음
//
// 키: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
//     → scripts/keys/serviceAccount.json (⚠️ 커밋 금지. .gitignore에 등록됨)

import { readFile } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --플래그 [값]. 다음 토큰이 또 플래그면 값 없는 스위치로 본다 (recount-counters.mjs 와 같은 방식)
const args = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const v = argv[i + 1];
    args[argv[i].slice(2)] = v !== undefined && !v.startsWith("--") ? v : true;
  }
}
const write = args.write === true || args.write === "true";

const keyPathRaw = typeof args.key === "string" ? args.key : "keys/serviceAccount.json";
const keyPath = isAbsolute(keyPathRaw) ? keyPathRaw : join(__dirname, keyPathRaw);

let initializeApp, cert, getFirestore, FieldValue;
try {
  ({ initializeApp, cert } = await import("firebase-admin/app"));
  ({ getFirestore, FieldValue } = await import("firebase-admin/firestore"));
} catch {
  console.error("firebase-admin이 없습니다. scripts/에서 `npm install` 후 재실행하세요.");
  process.exit(1);
}

// 에뮬레이터에서 시험할 때(FIRESTORE_EMULATOR_HOST 가 있을 때)는 키 없이 돈다
let app;
if (process.env.FIRESTORE_EMULATOR_HOST) {
  app = initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-ichi" });
} else {
  let key;
  try {
    key = JSON.parse(await readFile(keyPath, "utf-8"));
  } catch {
    console.error(`서비스 계정 키를 읽지 못했습니다: ${keyPath}`);
    console.error("Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → scripts/keys/serviceAccount.json (커밋 금지)");
    process.exit(1);
  }
  app = initializeApp({ credential: cert(key) });
}
const db = getFirestore(app);

const LEGACY = ["schoolDomain", "department", "admissionYear"];

const snap = await db.collection("usersPublic").get();
const targets = [];
const perField = Object.fromEntries(LEGACY.map((k) => [k, 0]));
for (const d of snap.docs) {
  const data = d.data();
  const present = LEGACY.filter((k) => k in data);
  if (present.length === 0) continue;
  present.forEach((k) => { perField[k]++; });
  targets.push({ ref: d.ref, present });
}

console.log(`usersPublic ${snap.size}건 중 지울 필드가 남은 문서 ${targets.length}건`);
console.log(`  필드별: ${LEGACY.map((k) => `${k} ${perField[k]}`).join(" / ")}`);

if (!write) {
  console.log(targets.length === 0
    ? "\n✅ 남은 것 없음. 할 일 없습니다."
    : "\n[점검만] 아무것도 쓰지 않았습니다. 지우려면 --write 를 붙여 다시 실행하세요.");
  process.exit(0);
}

// 배치당 400건 (한도 500 아래로 여유)
let done = 0;
for (let i = 0; i < targets.length; i += 400) {
  const batch = db.batch();
  for (const t of targets.slice(i, i + 400)) {
    const patch = {};
    t.present.forEach((k) => { patch[k] = FieldValue.delete(); });
    batch.update(t.ref, patch);
  }
  await batch.commit();
  done += Math.min(400, targets.length - i);
  console.log(`  ${done}/${targets.length} 완료`);
}
console.log(`\n✅ ${done}건에서 지웠습니다. 한 번 더 돌려서 「남은 것 없음」을 확인하세요.`);
