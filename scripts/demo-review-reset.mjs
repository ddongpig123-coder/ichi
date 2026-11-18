// 심사용 데모 계정(ichidemo1~4@example.com) 상태 보기·초기화 — Admin SDK 전용.
// 시간표 읽기 기록 `ocrUsage` 는 firestore.rules 에 match 가 없어 앱·클라이언트 SDK 로는 볼 수 없다(functions/index.js 참조).
//
//   node demo-review-reset.mjs                              상태만(읽기 전용): 학기별 시간표 과목 수 · 시간표 읽기 기록
//   node demo-review-reset.mjs --clear-timetable 2026-秋    그 학기 시간표를 비운다(sessions: []) → 홈에 「スクショから読み込む」 버튼이 보인다
//   node demo-review-reset.mjs --reset-ocr                  시간표 읽기 기록을 지운다 → 심사원이 다시 1회 쓸 수 있다(리젝 → 재제출 전에)
//   --only ichidemo1    한 계정만 (기본은 1~4 전부)
//   --key keys/serviceAccount.json
//
// 🔴 ichidemo[1-4]@example.com 외의 계정은 건드리지 않는다(이메일 가드). 키는 절대 커밋 금지(AGENTS.md).
import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(`--${name}`);

const keyPath = opt("key") ?? "keys/serviceAccount.json";
const only = opt("only");
const clearSem = opt("clear-timetable");
const resetOcr = has("reset-ocr");

if (clearSem && !/^\d{4}-(春|秋)$/.test(clearSem)) {
  console.error("--clear-timetable 은 2026-秋 형식으로");
  process.exit(1);
}
const DEMO_RE = /^ichidemo[1-4]@example\.com$/;
const emails = ["ichidemo1", "ichidemo2", "ichidemo3", "ichidemo4"]
  .filter((n) => !only || n === only)
  .map((n) => `${n}@example.com`);
if (emails.length === 0) {
  console.error("--only 는 ichidemo1~ichidemo4 중 하나");
  process.exit(1);
}

const sa = JSON.parse(await readFile(keyPath, "utf8"));
initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();

const year = new Date().getFullYear();
const semesters = [`${year}-春`, `${year}-秋`];
if (clearSem && !semesters.includes(clearSem)) semesters.push(clearSem);

for (const email of emails) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.log(`${email}: 계정 없음(seed-test-accounts.mjs 로 만든다)`);
    continue;
  }
  if (!DEMO_RE.test(user.email ?? "")) continue; // 가드: 데모 계정 외에는 절대 쓰지 않는다
  const uid = user.uid;
  console.log(`\n${email}  uid=${uid}`);

  for (const sem of semesters) {
    const snap = await db.doc(`users/${uid}/timetables/${sem}`).get();
    const n = snap.exists ? snap.data().sessions?.length ?? 0 : 0;
    console.log(`  시간표 ${sem}: ${snap.exists ? `${n}과목` : "문서 없음"}${n === 0 ? "  ← 비어 있음(읽기 버튼 보임)" : ""}`);
  }

  const usage = await db.collection("ocrUsage").where("uid", "==", uid).get();
  if (usage.empty) console.log("  시간표 읽기 기록: 없음(심사원이 1회 쓸 수 있음)");
  for (const d of usage.docs) {
    const u = d.data();
    console.log(`  시간표 읽기 기록: ${d.id}  status=${u.status}${u.status === "done" ? "  ← 이 학기는 「もう使いました」" : ""}`);
  }

  if (clearSem) {
    await db.doc(`users/${uid}/timetables/${clearSem}`).set({ sessions: [], updatedAt: Date.now() }, { merge: true });
    console.log(`  → ${clearSem} 시간표 비움`);
  }
  if (resetOcr && !usage.empty) {
    for (const d of usage.docs) await d.ref.delete();
    console.log(`  → 시간표 읽기 기록 ${usage.size}건 삭제`);
  }
}
process.exit(0);
