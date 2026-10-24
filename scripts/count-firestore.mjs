// Firestore 강의 문서 수 점검 (읽기 전용). DATA-MANUAL §11 검증 ②용.
//   node count-firestore.mjs [--school meiji.ac.jp] [--key keys/serviceAccount.json]
// 학부별로 Firestore 문서 수와 output/courses-{dept}-{nendo}-{10,20}.json 의 고유 id 수를 나란히 찍는다.
// 두 수가 같으면 적재 완료. 다르면 차이만큼 미적재(--chunk 50 으로 재적재, README 참조).
import { readFile, readdir } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, AggregateField } from "firebase-admin/firestore";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1]] : []).filter(Boolean));
const school = args.school ?? "meiji.ac.jp";
const keyPath = args.key ?? "keys/serviceAccount.json";

const sa = JSON.parse(await readFile(keyPath, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// 로컬 JSON: 학부별 고유 id 집합
const files = (await readdir("output")).filter((f) => /^courses-\d+-\d{4}-(10|20)\.json$/.test(f));
const local = {};
for (const f of files) {
  const [, dept, nendo] = f.match(/^courses-(\d+)-(\d{4})-/);
  const arr = JSON.parse(await readFile(`output/${f}`, "utf8"));
  const k = `${dept}@${nendo}`;
  local[k] = local[k] || { dept, nendo, ids: new Set(), rows: 0 };
  for (const c of arr) local[k].ids.add(c.id);
  local[k].rows += arr.length;
}

console.log(`school=${school}`);
console.log("dept  nendo  JSON행수  고유id   Firestore문서  판정");
let totalFs = 0, totalLocal = 0;
for (const k of Object.keys(local).sort()) {
  const { dept, nendo, ids, rows } = local[k];
  const col = db.collection("schools").doc(school).collection("departments").doc(dept).collection("courses");
  const snap = await col.where("year", "==", Number(nendo)).count().get();
  const n = snap.data().count;
  totalFs += n; totalLocal += ids.size;
  const verdict = n === ids.size ? "✓" : n < ids.size ? `✗ 미적재 ${ids.size - n}` : `? 초과 ${n - ids.size}`;
  console.log(`${dept.padEnd(5)} ${nendo}   ${String(rows).padStart(6)}  ${String(ids.size).padStart(6)}   ${String(n).padStart(10)}   ${verdict}`);
}
console.log(`합계: 로컬 고유 ${totalLocal} / Firestore ${totalFs}`);

// 학부 코드 밖의 컬렉션(예: 学部間共通 "common")도 있으면 보여준다
const depts = await db.collection("schools").doc(school).collection("departments").listDocuments();
const extra = depts.map((d) => d.id).filter((id) => !Object.values(local).some((v) => v.dept === id));
if (extra.length) {
  for (const id of extra) {
    const n = (await db.collection("schools").doc(school).collection("departments").doc(id).collection("courses").count().get()).data().count;
    console.log(`(추가 컬렉션) ${id}: ${n}건`);
  }
}
