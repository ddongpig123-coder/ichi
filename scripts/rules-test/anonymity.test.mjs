// firestore.rules 검증: 익명/기명 투고 (S4-4, BOARD-ACCESS §8)
// 🔴 「두 필드가 없는 기존 문서·구버전 앱」이 계속 통해야 한다. 규칙 배포가 OTA보다 먼저 나가므로
//    규칙을 배포한 순간 아직 업데이트하지 않은 앱이 투고를 못 하게 되면 안 된다.
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, addDoc, collection, serverTimestamp,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-rules",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

const SCHOOL = "meiji.ac.jp";
const NICK = "あ".repeat(20);        // 상한 20자 = usersPublic 의 실제 닉네임
const LONG = "あ".repeat(21);        // 21자 (usersPublic 에는 일부러 이 값을 넣어 길이 검증만 분리한다)
const POSTS = `schools/${SCHOOL}/boards/free/posts`;
const LOUNGE_POSTS = "lounges/visa/posts";
const EXISTING = `${POSTS}/p1`;

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  // 닉네임 20자 유저
  await setDoc(doc(db, "users/author"), { uid: "author", schoolDomain: SCHOOL });
  await setDoc(doc(db, "usersPublic/author"), { uid: "author", nickname: NICK });
  // usersPublic 의 닉네임이 21자인 유저 — 「길이 상한」만 따로 시험하기 위한 장치
  await setDoc(doc(db, "users/longnick"), { uid: "longnick", schoolDomain: SCHOOL });
  await setDoc(doc(db, "usersPublic/longnick"), { uid: "longnick", nickname: LONG });
  // 🔑 usersPublic 문서가 **없는** 유저 — 익명 투고에서 get() 이 실행되지 않는 것을 증명한다
  await setDoc(doc(db, "users/nopub"), { uid: "nopub", schoolDomain: SCHOOL });
  // 이미 있는 글 (수정 거부 시험용). 기존 문서처럼 두 필드가 없다
  await setDoc(doc(db, EXISTING), {
    boardId: "free", schoolDomain: SCHOOL, title: "t", body: "b", authorUid: "author", commentCount: 0,
  });
});

const author = env.authenticatedContext("author").firestore();
const longnick = env.authenticatedContext("longnick").firestore();
const nopub = env.authenticatedContext("nopub").firestore();

const results = [];
async function t(name, p) {
  try { await p; results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + e.message.split("\n")[0]]); }
}

const base = { boardId: "free", schoolDomain: SCHOOL, title: "t", body: "b", authorUid: "author", commentCount: 0, createdAt: serverTimestamp() };
const posts = collection(author, POSTS);

// ── 호환성: 두 필드가 없는 구버전 앱 / 기존 문서 ──
await t("구앱: 두 필드 없이 투고", assertSucceeds(addDoc(posts, base)));

// ── 익명 (기본값) ──
await t("익명: anonymous:true + 닉네임 없음", assertSucceeds(addDoc(posts, { ...base, anonymous: true })));
await t("익명: anonymous:true + authorNickname:null", assertSucceeds(addDoc(posts, { ...base, anonymous: true, authorNickname: null })));
await t("익명: 필드 생략 + authorNickname:null", assertSucceeds(addDoc(posts, { ...base, authorNickname: null })));
// 「익명으로 올렸다」면서 이름이 남아 있으면, 나중에 표시만 바꿔도 본인이 드러난다
await t("익명인데 닉네임을 같이 넣음 → 거부", assertFails(addDoc(posts, { ...base, anonymous: true, authorNickname: NICK })));
await t("익명(필드 생략)인데 닉네임을 넣음 → 거부", assertFails(addDoc(posts, { ...base, authorNickname: NICK })));
// 🔑 usersPublic 이 없어도 익명 투고는 통해야 한다 (ternary 가 get 을 건너뛰는지)
await t("익명: usersPublic 없는 유저도 투고 가능", assertSucceeds(addDoc(collection(nopub, POSTS), { ...base, authorUid: "nopub", anonymous: true })));

// ── 기명 ──
await t("기명: 닉네임 20자", assertSucceeds(addDoc(posts, { ...base, anonymous: false, authorNickname: NICK })));
await t("기명: 닉네임 21자 → 거부", assertFails(addDoc(collection(longnick, POSTS), { ...base, authorUid: "longnick", anonymous: false, authorNickname: LONG })));
await t("기명: 닉네임 없음 → 거부", assertFails(addDoc(posts, { ...base, anonymous: false })));
await t("기명: 닉네임 null → 거부", assertFails(addDoc(posts, { ...base, anonymous: false, authorNickname: null })));
await t("기명: 빈 닉네임 → 거부", assertFails(addDoc(posts, { ...base, anonymous: false, authorNickname: "" })));
// 사칭 — 프로필의 금칙어 검사를 투고로 우회하는 경로도 같이 막힌다
await t("기명: 남의/임의 닉네임 → 거부", assertFails(addDoc(posts, { ...base, anonymous: false, authorNickname: "学長" })));
await t("기명: usersPublic 없는 유저 → 거부", assertFails(addDoc(collection(nopub, POSTS), { ...base, authorUid: "nopub", anonymous: false, authorNickname: "だれか" })));

// ── 타입 ──
await t("anonymous 가 문자열 → 거부", assertFails(addDoc(posts, { ...base, anonymous: "false" })));
await t("authorNickname 이 숫자 → 거부", assertFails(addDoc(posts, { ...base, anonymous: false, authorNickname: 123 })));

// ── 작성 시점 고정: update 로는 못 바꾼다 ──
await t("수정: anonymous 를 false 로 → 거부", assertFails(updateDoc(doc(author, EXISTING), { anonymous: false })));
await t("수정: anonymous 를 true 로 → 거부", assertFails(updateDoc(doc(author, EXISTING), { anonymous: true })));
await t("수정: authorNickname 추가 → 거부", assertFails(updateDoc(doc(author, EXISTING), { authorNickname: NICK })));
await t("수정: 제목과 함께 익명 해제 → 거부", assertFails(updateDoc(doc(author, EXISTING), { title: "x", anonymous: false })));
await t("수정: 제목만은 여전히 가능", assertSucceeds(updateDoc(doc(author, EXISTING), { title: "x" })));

// ── 숲(lounges) 도 같은 판정 ──
const lbase = { loungeId: "visa", title: "t", body: "b", authorUid: "author", commentCount: 0, likeCount: 0, createdAt: serverTimestamp() };
const lposts = collection(author, LOUNGE_POSTS);
await t("숲: 구앱 형태", assertSucceeds(addDoc(lposts, lbase)));
await t("숲: 기명 20자", assertSucceeds(addDoc(lposts, { ...lbase, anonymous: false, authorNickname: NICK })));
await t("숲: 익명인데 닉네임 → 거부", assertFails(addDoc(lposts, { ...lbase, anonymous: true, authorNickname: NICK })));
await t("숲: 사칭 → 거부", assertFails(addDoc(lposts, { ...lbase, anonymous: false, authorNickname: "学長" })));

// ── 댓글도 같은 판정 (학교·숲 공용 isValidNewComment) ──
const cbase = { postId: "p1", body: "c", authorUid: "author", parentId: null, mentionUid: null, likeCount: 0, createdAt: serverTimestamp() };
const comments = collection(author, `${EXISTING}/comments`);
await t("댓글: 구앱 형태", assertSucceeds(addDoc(comments, cbase)));
await t("댓글: 기명 20자", assertSucceeds(addDoc(comments, { ...cbase, anonymous: false, authorNickname: NICK })));
await t("댓글: 익명인데 닉네임 → 거부", assertFails(addDoc(comments, { ...cbase, anonymous: true, authorNickname: NICK })));
await t("댓글: 사칭 → 거부", assertFails(addDoc(comments, { ...cbase, anonymous: false, authorNickname: "学長" })));
await t("댓글: 21자 → 거부", assertFails(addDoc(collection(longnick, `${EXISTING}/comments`), { ...cbase, authorUid: "longnick", anonymous: false, authorNickname: LONG })));

await env.cleanup();
for (const [s, n] of results) console.log(s, n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
