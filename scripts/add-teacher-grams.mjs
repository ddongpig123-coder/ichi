// 이미 적재된 강의 문서에 teacherGrams(교원명 2-gram)를 채운다 — 한 번만 돌리면 된다 (2026-11-28)
//
// 왜: 강의 검색은 nameGrams(강의명)로만 후보를 뽑았어서, 「선생님 이름」만 넣으면 0건이었다(준희 유저 피드백).
//     앱은 이제 teacherGrams 로도 후보를 뽑는다. 새로 적재하는 강의는 load-firestore.mjs 가 넣고,
//     예전에 적재한 강의(약 2만 건)는 이 스크립트로 채운다.
//
// 실행 (준희 PC · ichi/scripts 폴더 · 서비스 계정 키 필요 — 키는 절대 커밋 금지):
//   node add-teacher-grams.mjs --dry-run      … 몇 건이 바뀌는지만 본다 (읽기만)
//   node add-teacher-grams.mjs                … 실제로 채운다
//   옵션: --key keys/serviceAccount.json (기본값) · --school meiji.ac.jp (그 학교만)
//
// 비용: 강의 문서 읽기 약 2만 + 쓰기 약 2만 (요금제 무료 범위 근처. 넘어도 1엔 안팎).
// 몇 번 돌려도 안전하다 — 이미 같은 teacherGrams 가 있는 문서는 건너뛴다.
import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const has = (name) => argv.includes(`--${name}`);
const keyPath = opt("key") ?? "keys/serviceAccount.json";
const onlySchool = opt("school");
const dryRun = has("dry-run");

// ⚠️ src/utils/ngram.ts 의 makeBigrams 와 같아야 한다 (load-firestore.mjs 와 같은 복제본)
function makeBigrams(text) {
  const norm = (text ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (norm.length === 0) return [];
  if (norm.length === 1) return [norm];
  const grams = new Set();
  for (let i = 0; i < norm.length - 1; i++) grams.add(norm.slice(i, i + 2));
  return [...grams];
}
const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

const sa = JSON.parse(await readFile(keyPath, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`▶ 강의 문서 읽는 중… ${onlySchool ? `(학교: ${onlySchool})` : "(전체)"}${dryRun ? " — dry-run (쓰기 안 함)" : ""}`);
// select: 필요한 필드만 받아 와서 빠르게 (읽기 건수는 같다)
const snap = await db.collectionGroup("courses").select("teacher", "teacherGrams").get();
let total = 0, skipped = 0, toUpdate = 0, written = 0;
const bySchool = {};
const writer = dryRun ? null : db.bulkWriter();
for (const d of snap.docs) {
  // 경로: schools/{school}/departments/{dept}/courses/{id}
  const school = d.ref.path.split("/")[1];
  if (onlySchool && school !== onlySchool) continue;
  total++;
  const grams = makeBigrams(d.get("teacher"));
  if (same(d.get("teacherGrams"), grams)) { skipped++; continue; }
  toUpdate++;
  bySchool[school] = (bySchool[school] ?? 0) + 1;
  if (writer) writer.update(d.ref, { teacherGrams: grams }).then(() => { written++; if (written % 2000 === 0) console.log(`  … ${written}건 썼다`); });
}
if (writer) await writer.close();

console.log(`\n강의 문서 ${total}건 · 이미 있음 ${skipped}건 · ${dryRun ? "채울 대상" : "채움"} ${dryRun ? toUpdate : written}건`);
for (const [s, n] of Object.entries(bySchool)) console.log(`  ${s}: ${n}건`);
console.log(dryRun ? "\n✔ dry-run 끝. 실제로 채우려면 --dry-run 없이 다시 실행" : "\n✅ 끝. 앱에서 선생님 이름으로 검색해 보세요");
