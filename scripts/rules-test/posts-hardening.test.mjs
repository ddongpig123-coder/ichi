// firestore.rules 검증: 게시글·댓글 쓰기 강화 (좋아요 수 조작 / authorUid 변경 / 글자 수)
// 🔴 「옛날 앱」과 「새 앱」의 쓰기 방식을 둘 다 시험한다. 규칙 배포와 OTA는 순서가 정해져 있지 않으므로
//    규칙을 배포한 순간 아직 업데이트하지 않은 앱이 깨지면 안 된다.
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, increment, serverTimestamp, writeBatch,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-rules",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

const SCHOOL = "meiji.ac.jp";
const BOARD_POST = `schools/${SCHOOL}/boards/free/posts/p1`;
const LOUNGE_POST = "lounges/visa/posts/p1";
const LONG_POST = `schools/${SCHOOL}/boards/free/posts/long`;

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/author"), { uid: "author", schoolDomain: SCHOOL });
  await setDoc(doc(db, "users/reader"), { uid: "reader", schoolDomain: SCHOOL });
  // 학교 게시판 글은 실제 앱처럼 likeCount 가 없는 상태로 만든다
  await setDoc(doc(db, BOARD_POST), { boardId: "free", schoolDomain: SCHOOL, title: "t", body: "b", authorUid: "author", commentCount: 0 });
  await setDoc(doc(db, LOUNGE_POST), { loungeId: "visa", title: "t", body: "b", authorUid: "author", commentCount: 0, likeCount: 0 });
  await setDoc(doc(db, `${BOARD_POST}/comments/c1`), { postId: "p1", body: "c", authorUid: "author", likeCount: 0 });
  // 상한 도입 전에 쓰인 긴 글
  await setDoc(doc(db, LONG_POST), { boardId: "free", schoolDomain: SCHOOL, title: "t", body: "あ".repeat(6000), authorUid: "author", commentCount: 0 });
});

const author = env.authenticatedContext("author").firestore();
const reader = env.authenticatedContext("reader").firestore();

const results = [];
async function t(name, p) {
  try { await p; results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + e.message.split("\n")[0]]); }
}

// ── 좋아요: 옛날 앱 (좋아요 문서 → 카운터를 따로 쓴다) ──
for (const [label, post] of [["학교", BOARD_POST], ["숲", LOUNGE_POST]]) {
  await t(`${label} 옛날앱: 좋아요 문서 생성`, assertSucceeds(setDoc(doc(reader, `${post}/likes/reader`), { uid: "reader" })));
  await t(`${label} 옛날앱: 카운터 +1`, assertSucceeds(updateDoc(doc(reader, post), { likeCount: increment(1) })));
  await t(`${label} 옛날앱: 좋아요 문서 삭제`, assertSucceeds(deleteDoc(doc(reader, `${post}/likes/reader`))));
  await t(`${label} 옛날앱: 카운터 -1`, assertSucceeds(updateDoc(doc(reader, post), { likeCount: increment(-1) })));
}

// ── 좋아요: 새 앱 (batch) ──
for (const [label, post] of [["학교", BOARD_POST], ["숲", LOUNGE_POST]]) {
  const like = writeBatch(reader);
  like.set(doc(reader, `${post}/likes/reader`), { uid: "reader" });
  like.update(doc(reader, post), { likeCount: increment(1) });
  await t(`${label} 새앱: 좋아요 batch`, assertSucceeds(like.commit()));
  const unlike = writeBatch(reader);
  unlike.delete(doc(reader, `${post}/likes/reader`));
  unlike.update(doc(reader, post), { likeCount: increment(-1) });
  await t(`${label} 새앱: 좋아요 취소 batch`, assertSucceeds(unlike.commit()));
}

// ── 좋아요 수 조작 (B2) ──
await t("조작: 좋아요 문서 없이 +1 → 거부", assertFails(updateDoc(doc(reader, BOARD_POST), { likeCount: increment(1) })));
await t("조작: 임의 값 9999 → 거부", assertFails(updateDoc(doc(reader, BOARD_POST), { likeCount: 9999 })));
await t("조작: 숲에서 임의 값 9999 → 거부", assertFails(updateDoc(doc(reader, LOUNGE_POST), { likeCount: 9999 })));
await t("조작: 좋아요 문서가 있어도 +5 → 거부", (async () => {
  await setDoc(doc(reader, `${BOARD_POST}/likes/reader`), { uid: "reader" });
  await assertFails(updateDoc(doc(reader, BOARD_POST), { likeCount: increment(5) }));
  await deleteDoc(doc(reader, `${BOARD_POST}/likes/reader`));
})());
await t("조작: 작성자도 자기 글 좋아요를 임의 값으로 → 거부", assertFails(updateDoc(doc(author, BOARD_POST), { likeCount: 500 })));
await t("조작: 좋아요와 제목을 동시에 → 거부", assertFails(updateDoc(doc(reader, BOARD_POST), { likeCount: increment(1), title: "x" })));
await t("조작: 댓글 수 임의 값 → 거부", assertFails(updateDoc(doc(reader, BOARD_POST), { commentCount: 100 })));
await t("정상: 댓글 수 +1", assertSucceeds(updateDoc(doc(reader, BOARD_POST), { commentCount: increment(1) })));
await t("정상: 댓글 수 -1", assertSucceeds(updateDoc(doc(reader, BOARD_POST), { commentCount: increment(-1) })));
await t("조작: 남의 글 제목 변경 → 거부", assertFails(updateDoc(doc(reader, BOARD_POST), { title: "x" })));

// ── 댓글 좋아요 ──
const commentPath = `${BOARD_POST}/comments/c1`;
await t("댓글 옛날앱: 좋아요 문서", assertSucceeds(setDoc(doc(reader, `${commentPath}/likes/reader`), { uid: "reader" })));
await t("댓글 옛날앱: +1", assertSucceeds(updateDoc(doc(reader, commentPath), { likeCount: increment(1) })));
await t("댓글 조작: 임의 값 → 거부", assertFails(updateDoc(doc(reader, commentPath), { likeCount: 77 })));
await t("댓글 조작: 남의 댓글 삭제 → 거부", assertFails(updateDoc(doc(reader, commentPath), { deleted: true })));

// ── authorUid 보호 (B3) ──
await t("작성자: authorUid 변경 → 거부", assertFails(updateDoc(doc(author, BOARD_POST), { authorUid: "someone" })));
await t("작성자: 숲 글 authorUid 변경 → 거부", assertFails(updateDoc(doc(author, LOUNGE_POST), { authorUid: "someone" })));
await t("작성자: 댓글 authorUid 변경 → 거부", assertFails(updateDoc(doc(author, commentPath), { authorUid: "someone" })));
await t("작성자: createdAt 변경 → 거부", assertFails(updateDoc(doc(author, BOARD_POST), { createdAt: 1 })));
await t("작성자: 삭제 표시와 authorUid 를 동시에 → 거부", assertFails(updateDoc(doc(author, BOARD_POST), { deleted: true, authorUid: "someone" })));
await t("작성자: 베스트 답변 지정", assertSucceeds(updateDoc(doc(author, BOARD_POST), { bestCommentId: "c1", resolved: true })));
await t("작성자: 베스트 답변 해제", assertSucceeds(updateDoc(doc(author, BOARD_POST), { bestCommentId: null, resolved: false })));
await t("작성자: 댓글 소프트 삭제", assertSucceeds(updateDoc(doc(author, commentPath), { deleted: true, deletedAt: 1 })));
await t("작성자: 글 소프트 삭제", assertSucceeds(updateDoc(doc(author, LOUNGE_POST), { deleted: true, deletedAt: 1 })));
await t("작성자: 상한 전에 쓴 긴 글도 소프트 삭제 가능", assertSucceeds(updateDoc(doc(author, LONG_POST), { deleted: true, deletedAt: 1 })));

// ── 새 글·새 댓글 검증 (B2·B11) ──
const posts = collection(author, `schools/${SCHOOL}/boards/free/posts`);
const appPost = { boardId: "free", schoolDomain: SCHOOL, title: "t", body: "b", authorUid: "author", commentCount: 0, createdAt: serverTimestamp() };
await t("새 글: 앱이 쓰는 형태 그대로", assertSucceeds(addDoc(posts, appPost)));
await t("새 글: 숲 형태 그대로", assertSucceeds(addDoc(collection(author, "lounges/visa/posts"), { loungeId: "visa", title: "t", body: "b", authorUid: "author", commentCount: 0, likeCount: 0, createdAt: serverTimestamp() })));
await t("새 글: 본문 5000자", assertSucceeds(addDoc(posts, { ...appPost, body: "あ".repeat(5000) })));
await t("새 글: 본문 5001자 → 거부", assertFails(addDoc(posts, { ...appPost, body: "あ".repeat(5001) })));
await t("새 글: 제목 101자 → 거부", assertFails(addDoc(posts, { ...appPost, title: "あ".repeat(101) })));
await t("새 글: 빈 제목 → 거부", assertFails(addDoc(posts, { ...appPost, title: "" })));
await t("새 글: 좋아요 9999 로 생성 → 거부", assertFails(addDoc(posts, { ...appPost, likeCount: 9999 })));
await t("새 글: 조회수 100 으로 생성 → 거부", assertFails(addDoc(posts, { ...appPost, viewCount: 100 })));
await t("새 글: 남의 이름으로 → 거부", assertFails(addDoc(posts, { ...appPost, authorUid: "someone" })));

const comments = collection(author, `${BOARD_POST}/comments`);
const appComment = { postId: "p1", body: "c", authorUid: "author", parentId: null, mentionUid: null, likeCount: 0, createdAt: serverTimestamp() };
await t("새 댓글: 앱이 쓰는 형태 그대로", assertSucceeds(addDoc(comments, appComment)));
await t("새 댓글: 1001자 → 거부", assertFails(addDoc(comments, { ...appComment, body: "あ".repeat(1001) })));
await t("새 댓글: 좋아요 50 으로 생성 → 거부", assertFails(addDoc(comments, { ...appComment, likeCount: 50 })));

// ── 게시판 이름·강의평 ──
const metas = collection(author, `schools/${SCHOOL}/boardMetas`);
await t("게시판 만들기: 정상", assertSucceeds(addDoc(metas, { label: "ゼミ", description: "d", category: "custom", createdBy: "author", createdAt: serverTimestamp() })));
await t("게시판 만들기: 이름 31자 → 거부", assertFails(addDoc(metas, { label: "あ".repeat(31), description: "", category: "custom", createdBy: "author" })));
const review = `schools/${SCHOOL}/departments/12/courses/c1/reviews/author`;
await t("강의평: 정상(글 없음)", assertSucceeds(setDoc(doc(author, review), { rating: 5, tags: [], text: null })));
await t("강의평: 정상(글 있음)", assertSucceeds(setDoc(doc(author, review), { rating: 4, tags: [], text: "良かった" })));
await t("강의평: 1001자 → 거부", assertFails(setDoc(doc(author, review), { rating: 4, tags: [], text: "あ".repeat(1001) })));

await env.cleanup();
for (const [s, n] of results) console.log(s, n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
