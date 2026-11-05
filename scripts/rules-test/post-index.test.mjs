// firestore.rules 검증: 투고 검색 색인(postIndex) — 학교 게시판·숲
// 색인은 투고와 같은 배치로 만든다. 작성만 허용, 수정·삭제는 금지(본체와 어긋나지 않게).
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-postindex",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

const SCHOOL = "meiji.ac.jp";
const OTHER = "waseda.jp";

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  // 메이지 소속 유저와, 색인 수정 시험용으로 이미 있는 색인 1건
  await setDoc(doc(db, "users/mei"), { uid: "mei", schoolDomain: SCHOOL });
  await setDoc(doc(db, `schools/${SCHOOL}/postIndex/exists`), {
    boardId: "free", authorUid: "mei", grams: ["さー"], createdAt: 1,
  });
});

const mei = env.authenticatedContext("mei").firestore();

const r = [];
const t = async (n, p) => {
  try { await p; r.push(["PASS", n]); } catch (e) { r.push(["FAIL", n + " :: " + e.message.split("\n")[0]]); }
};

const post = (title = "サークルの新歓", body = "いつですか") => ({
  boardId: "free", schoolDomain: SCHOOL, title, body, authorUid: "mei",
  commentCount: 0, createdAt: serverTimestamp(),
});
const index = (over = {}) => ({
  boardId: "free", authorUid: "mei", grams: ["さー", "ーく"], createdAt: 1, ...over,
});

// 앱이 실제로 하는 것: 본체 + 색인을 한 배치로
await t("정상: 투고와 색인을 한 배치로 생성", assertSucceeds((async () => {
  const b = writeBatch(mei);
  b.set(doc(mei, `schools/${SCHOOL}/boards/free/posts/p1`), post());
  b.set(doc(mei, `schools/${SCHOOL}/postIndex/p1`), index());
  await b.commit();
})()));

await t("정상: 색인 읽기", assertSucceeds(getDoc(doc(mei, `schools/${SCHOOL}/postIndex/p1`))));

await t("거부: 남의 이름으로 색인",
  assertFails(setDoc(doc(mei, `schools/${SCHOOL}/postIndex/x1`), index({ authorUid: "other" }))));

await t("거부: 타교 게시판의 색인(소속 불일치)",
  assertFails(setDoc(doc(mei, `schools/${OTHER}/postIndex/x2`), index())));

await t("거부: grams 0건",
  assertFails(setDoc(doc(mei, `schools/${SCHOOL}/postIndex/x3`), index({ grams: [] }))));

await t("거부: grams 401개",
  assertFails(setDoc(doc(mei, `schools/${SCHOOL}/postIndex/x4`),
    index({ grams: Array.from({ length: 401 }, (_, i) => "g" + i) }))));

await t("거부: grams 가 배열이 아님",
  assertFails(setDoc(doc(mei, `schools/${SCHOOL}/postIndex/x5`), index({ grams: "さー" }))));

await t("거부: boardId 없음",
  assertFails(setDoc(doc(mei, `schools/${SCHOOL}/postIndex/x6`), index({ boardId: "" }))));

// 색인은 본체와 어긋나지 않도록 만든 뒤 바꿀 수 없다
await t("거부: 색인 수정",
  assertFails(updateDoc(doc(mei, `schools/${SCHOOL}/postIndex/exists`), { grams: ["ずる"] })));

await t("거부: 색인 덮어쓰기(set)",
  assertFails(setDoc(doc(mei, `schools/${SCHOOL}/postIndex/exists`), index())));

await t("거부: 색인 삭제",
  assertFails(deleteDoc(doc(mei, `schools/${SCHOOL}/postIndex/exists`))));

// 숲은 소속을 보지 않는다(숲 투고 자체와 같은 조건)
await t("숲 정상: 투고와 색인을 한 배치로 생성", assertSucceeds((async () => {
  const b = writeBatch(mei);
  b.set(doc(mei, "lounges/visa/posts/p1"), {
    loungeId: "visa", title: "ビザ更新", body: "どこで", authorUid: "mei",
    commentCount: 0, likeCount: 0, createdAt: serverTimestamp(),
  });
  b.set(doc(mei, "lounges/visa/postIndex/p1"), index({ boardId: "visa" }));
  await b.commit();
})()));

await t("숲 거부: 남의 이름으로 색인",
  assertFails(setDoc(doc(mei, "lounges/visa/postIndex/x1"), index({ boardId: "visa", authorUid: "other" }))));

await env.cleanup();
for (const [s, n] of r) console.log(s, n);
const failed = r.filter(([s]) => s === "FAIL").length;
console.log(`\n${r.length - failed}/${r.length} passed`);
process.exit(failed ? 1 : 0);
