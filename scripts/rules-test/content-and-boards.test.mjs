// firestore.rules 검증: 운영 계정(operators)·대기 목록(contentQueue)·학교 게시판 쓰기(S3 belongsToSchool)
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 기본은 저장소의 firestore.rules. 다른 파일을 시험하려면 인자로 경로를 준다.
const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc, serverTimestamp,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-rules",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

// 運営アカウントを名簿に登録（コンソール相当 = ルール無効化）
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "operators/op1"), { note: "main" });
  // S3(#39) 이후 학교 게시판 쓰기는 users.schoolDomain 일치가 필요
  await setDoc(doc(ctx.firestore(), "users/op1"), { uid: "op1", schoolDomain: "meiji.ac.jp" });
  await setDoc(doc(ctx.firestore(), "users/user1"), { uid: "user1", schoolDomain: "meiji.ac.jp" });
});

const op = env.authenticatedContext("op1").firestore();
const user = env.authenticatedContext("user1").firestore();
const anon = env.unauthenticatedContext().firestore();

const base = {
  status: "draft", source: "ai", scope: "school", schoolDomain: "meiji.ac.jp", boardId: "free",
  title: "1限きつすぎる", body: "みんなどうしてる？", topic: "discussion", sourceUrl: null,
  createdBy: "op1", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
};

const results = [];
async function t(name, p) {
  try { await p; results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + e.message.split("\n")[0]]); }
}

// operators
await t("運営: 自分の operators を get できる", assertSucceeds(getDoc(doc(op, "operators/op1"))));
await t("一般: 自分の operators(未登録) を get できる", assertSucceeds(getDoc(doc(user, "operators/user1"))));
await t("一般: 他人の operators を get できない", assertFails(getDoc(doc(user, "operators/op1"))));
await t("一般: operators を list できない", assertFails(getDocs(collection(user, "operators"))));
await t("一般: 自分を operators に登録できない", assertFails(setDoc(doc(user, "operators/user1"), { x: 1 })));
await t("運営: operators を書き換えできない", assertFails(setDoc(doc(op, "operators/op1"), { x: 2 })));

// contentQueue — 作成
await t("運営: 正しい draft を作成できる", assertSucceeds(setDoc(doc(op, "contentQueue/q1"), base)));
await t("運営: 手書き(manual, topic null) も作成できる",
  assertSucceeds(setDoc(doc(op, "contentQueue/q2"), { ...base, source: "manual", topic: null })));
await t("運営: lounge 宛(schoolDomain null) を作成できる",
  assertSucceeds(setDoc(doc(op, "contentQueue/q3"), { ...base, scope: "lounge", schoolDomain: null, boardId: "visa" })));
await t("運営: lounge なのに schoolDomain あり → 拒否",
  assertFails(setDoc(doc(op, "contentQueue/x1"), { ...base, scope: "lounge" })));
await t("運営: school なのに schoolDomain null → 拒否",
  assertFails(setDoc(doc(op, "contentQueue/x2"), { ...base, schoolDomain: null })));
await t("運営: 不正な status → 拒否",
  assertFails(setDoc(doc(op, "contentQueue/x3"), { ...base, status: "published" })));
await t("運営: タイトル101文字 → 拒否",
  assertFails(setDoc(doc(op, "contentQueue/x4"), { ...base, title: "あ".repeat(101) })));
await t("運営: 空の本文 → 拒否",
  assertFails(setDoc(doc(op, "contentQueue/x5"), { ...base, body: "" })));
await t("運営: createdBy が他人 → 拒否",
  assertFails(setDoc(doc(op, "contentQueue/x6"), { ...base, createdBy: "someone" })));
const { topic, ...noTopic } = base;
await t("運営: topic フィールド欠落 → 拒否", assertFails(setDoc(doc(op, "contentQueue/x7"), noTopic)));
await t("一般: 作成できない",
  assertFails(setDoc(doc(user, "contentQueue/x8"), { ...base, createdBy: "user1" })));
await t("未ログイン: 作成できない", assertFails(setDoc(doc(anon, "contentQueue/x9"), base)));

// contentQueue — 読み取り
await t("運営: 一覧を読める", assertSucceeds(getDocs(collection(op, "contentQueue"))));
await t("一般: 一覧を読めない", assertFails(getDocs(collection(user, "contentQueue"))));
await t("一般: 1件も読めない", assertFails(getDoc(doc(user, "contentQueue/q1"))));

// contentQueue — 更新・削除
await t("運営: approved に更新できる",
  assertSucceeds(updateDoc(doc(op, "contentQueue/q1"), { status: "approved", updatedAt: serverTimestamp() })));
await t("運営: posted + postedPath を付けられる",
  assertSucceeds(updateDoc(doc(op, "contentQueue/q1"), {
    status: "posted", postedPath: "schools/meiji.ac.jp/boards/free/posts/p1", postedAt: serverTimestamp(),
  })));
await t("運営: createdBy は書き換えられない",
  assertFails(updateDoc(doc(op, "contentQueue/q2"), { createdBy: "someone" })));
await t("運営: 不正 status への更新 → 拒否",
  assertFails(updateDoc(doc(op, "contentQueue/q2"), { status: "deleted" })));
await t("一般: 更新できない", assertFails(updateDoc(doc(user, "contentQueue/q2"), { status: "approved" })));
await t("運営: 物理削除できない", assertFails(deleteDoc(doc(op, "contentQueue/q2"))));

// 既存ルールの回帰確認: 運営アカウントも一般と同じく掲示板に投稿できる
const post = { boardId: "free", schoolDomain: "meiji.ac.jp", title: "t", body: "b", commentCount: 0, createdAt: serverTimestamp() };
await t("運営: 学校掲示板に通常投稿できる",
  assertSucceeds(addDoc(collection(op, "schools/meiji.ac.jp/boards/free/posts"), { ...post, authorUid: "op1" })));
await t("一般: 学校掲示板に通常投稿できる（既存動作）",
  assertSucceeds(addDoc(collection(user, "schools/meiji.ac.jp/boards/free/posts"), { ...post, authorUid: "user1" })));
await t("運営: 他校(waseda.jp)の掲示板には投稿できない（S3の学校一致）",
  assertFails(addDoc(collection(op, "schools/waseda.jp/boards/free/posts"), { ...post, schoolDomain: "waseda.jp", authorUid: "op1" })));
await t("運営: ラウンジに通常投稿できる",
  assertSucceeds(addDoc(collection(op, "lounges/visa/posts"), { loungeId: "visa", title: "t", body: "b", authorUid: "op1", commentCount: 0, createdAt: serverTimestamp() })));

await env.cleanup();
for (const [s, n] of results) console.log(s, n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
