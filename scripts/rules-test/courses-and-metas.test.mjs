// firestore.rules 검증: 강의 마스터·강의평·확인·게시판 메타 + 물리삭제 금지 (docs/SECURITY-1.1.md §2-1)
//
// 여기까지 테스트가 없던 나머지 컬렉션. 핵심은 3가지다.
//   ① 공식 강의 데이터(Admin SDK 로 20,022건 적재)를 클라이언트가 못 고친다 — update/delete 전면 금지.
//      여기가 뚫리면 강의명·요일·교시를 아무나 바꿀 수 있고, 되돌릴 백업이 없다(Spark 요금제).
//   ② verified:true 를 클라이언트가 못 만든다 — 자작자연한 강의가 공식처럼 보이면 안 된다.
//      승격은 confirms 개수로 앱이 파생 판정한다(AGENTS.md).
//   ③ 글·댓글의 물리삭제 금지 — authorUid 는 발신자정보 개시청구 대비 기록이라
//      문서 자체가 사라지면 법적 대응 증적이 없어진다(MODERATION.md §1).
//
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, collection, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-rules",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

const SCHOOL = "meiji.ac.jp";
const COURSES = `schools/${SCHOOL}/departments/12/courses`;
const OFFICIAL = `${COURSES}/official1`;     // 공식 크롤 데이터 (verified: true)
const BOARD_POST = `schools/${SCHOOL}/boards/free/posts/p1`;
const LOUNGE_POST = "lounges/visa/posts/lp1";
const TEXT_MAX = "あ".repeat(1000);
const TEXT_OVER = "あ".repeat(1001);

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/mei"), { uid: "mei", schoolDomain: SCHOOL });
  await setDoc(doc(db, "users/other"), { uid: "other", schoolDomain: SCHOOL });
  await setDoc(doc(db, "usersPublic/mei"), { uid: "mei", nickname: "mei" });
  await setDoc(doc(db, "usersPublic/other"), { uid: "other", nickname: "other" });

  // 공식 크롤 데이터 1건 (Admin SDK 로 들어온 형태)
  await setDoc(doc(db, OFFICIAL), {
    name: "経営学総論", verified: true, addedBy: "official", day: 1, period: 2,
  });
  // 남이 쓴 강의평 (삭제 거부 시험용)
  await setDoc(doc(db, `${OFFICIAL}/reviews/other`), { rating: 5, text: "よい" });
  // 남이 만든 게시판 메타 (수정 거부 시험용)
  await setDoc(doc(db, `schools/${SCHOOL}/boardMetas/b_other`), {
    createdBy: "other", label: "他人の板", description: "",
  });
  // 물리삭제 거부 시험용 글·댓글
  await setDoc(doc(db, BOARD_POST), {
    boardId: "free", schoolDomain: SCHOOL, title: "t", body: "b", authorUid: "mei",
    commentCount: 0, likeCount: 0,
  });
  await setDoc(doc(db, `${BOARD_POST}/comments/c1`), { postId: "p1", body: "c", authorUid: "mei", likeCount: 0 });
  await setDoc(doc(db, LOUNGE_POST), {
    loungeId: "visa", title: "t", body: "b", authorUid: "mei", commentCount: 0, likeCount: 0,
  });
});

const mei = env.authenticatedContext("mei").firestore();
const other = env.authenticatedContext("other").firestore();

const r = [];
const t = async (n, p) => {
  try { await p; r.push(["PASS", n]); }
  catch (e) { r.push(["FAIL", n + " :: " + e.message.split("\n")[0]]); }
};

// ── courses: 유저 기여는 verified:false 만 ────────────────────
await t("강의 등록: verified:false + addedBy 본인", assertSucceeds(setDoc(doc(mei, `${COURSES}/u1`), { name: "ユーザー登録", verified: false, addedBy: "mei" })));
// 🔴 자작자연한 강의가 공식처럼 보이면 강의검색·시간표 전체의 신뢰가 깨진다
await t("🔴 강의 등록: verified:true → 거부", assertFails(setDoc(doc(mei, `${COURSES}/u2`), { name: "偽公式", verified: true, addedBy: "mei" })));
await t("강의 등록: addedBy 를 남으로 위조 → 거부", assertFails(setDoc(doc(mei, `${COURSES}/u3`), { name: "x", verified: false, addedBy: "other" })));
await t("강의 등록: verified 필드 누락 → 거부", assertFails(setDoc(doc(mei, `${COURSES}/u4`), { name: "x", addedBy: "mei" })));
// 🔴 공식 데이터 보호. 되돌릴 백업이 없다(Spark 는 자동 백업·PITR 없음 — SECURITY-1.1 §2-3)
await t("🔴 공식 강의 수정 → 거부", assertFails(updateDoc(doc(mei, OFFICIAL), { name: "改ざん" })));
await t("🔴 공식 강의 삭제 → 거부", assertFails(deleteDoc(doc(mei, OFFICIAL))));
await t("자기가 올린 강의도 수정 불가", assertFails(updateDoc(doc(mei, `${COURSES}/u1`), { name: "x" })));

// ── confirms: 문서 id = uid 로 「1인 1회」를 구조 강제 ──────────
await t("확인: 본인 uid 문서 생성", assertSucceeds(setDoc(doc(mei, `${COURSES}/u1/confirms/mei`), { uid: "mei", createdAt: serverTimestamp() })));
// 🔴 이게 뚫리면 혼자서 confirms 를 늘려 verified 상당으로 승격시킬 수 있다
await t("🔴 확인: 타인 uid 문서에 생성 → 거부", assertFails(setDoc(doc(mei, `${COURSES}/u1/confirms/other`), { uid: "other" })));
await t("확인: 문서 id 와 uid 필드 불일치 → 거부", assertFails(setDoc(doc(mei, `${COURSES}/u1/confirms/mei2`), { uid: "mei" })));
await t("확인: 수정 → 거부", assertFails(updateDoc(doc(mei, `${COURSES}/u1/confirms/mei`), { uid: "mei" })));
await t("확인: 본인 것 취소(삭제)", assertSucceeds(deleteDoc(doc(mei, `${COURSES}/u1/confirms/mei`))));

// ── reviews: 문서 id = uid (1인 1강의 1평) · rating 1〜5 ────────
await t("강의평: rating 5 + 본문 1000자", assertSucceeds(setDoc(doc(mei, `${OFFICIAL}/reviews/mei`), { rating: 5, text: TEXT_MAX })));
await t("강의평: 본문 1001자 → 거부", assertFails(setDoc(doc(mei, `${OFFICIAL}/reviews/mei`), { rating: 5, text: TEXT_OVER })));
await t("강의평: rating 6 → 거부", assertFails(setDoc(doc(mei, `${OFFICIAL}/reviews/mei`), { rating: 6 })));
await t("강의평: rating 0 → 거부", assertFails(setDoc(doc(mei, `${OFFICIAL}/reviews/mei`), { rating: 0 })));
await t("강의평: rating 이 문자열 → 거부", assertFails(setDoc(doc(mei, `${OFFICIAL}/reviews/mei`), { rating: "5" })));
await t("강의평: rating 이 소수 → 거부", assertFails(setDoc(doc(mei, `${OFFICIAL}/reviews/mei`), { rating: 4.5 })));
// 🔴 문서 id = uid 가 「1인 1평」의 유일한 장치. 뚫리면 별점 평균을 혼자서 만들 수 있다
await t("🔴 강의평: 타인 uid 문서에 작성 → 거부", assertFails(setDoc(doc(mei, `${OFFICIAL}/reviews/other2`), { rating: 5 })));
await t("강의평: 남의 평 수정 → 거부", assertFails(updateDoc(doc(mei, `${OFFICIAL}/reviews/other`), { rating: 1 })));
await t("강의평: 남의 평 삭제 → 거부", assertFails(deleteDoc(doc(mei, `${OFFICIAL}/reviews/other`))));
await t("강의평: 본인 평 삭제", assertSucceeds(deleteDoc(doc(mei, `${OFFICIAL}/reviews/mei`))));

// ── boardMetas: 유저 생성 게시판 ──────────────────────────────
await t("게시판 메타: 이름 30자", assertSucceeds(setDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b1`), { createdBy: "mei", label: "あ".repeat(30), description: "" })));
await t("게시판 메타: 이름 31자 → 거부", assertFails(setDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b2`), { createdBy: "mei", label: "あ".repeat(31), description: "" })));
await t("게시판 메타: 이름 빈 문자 → 거부", assertFails(setDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b3`), { createdBy: "mei", label: "", description: "" })));
await t("게시판 메타: 설명 101자 → 거부", assertFails(setDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b4`), { createdBy: "mei", label: "x", description: "あ".repeat(101) })));
await t("게시판 메타: createdBy 위조 → 거부", assertFails(setDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b5`), { createdBy: "other", label: "x", description: "" })));
await t("🔴 게시판 메타: 남이 만든 게시판 수정 → 거부", assertFails(updateDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b_other`), { label: "乗っ取り" })));
await t("게시판 메타: 남이 만든 게시판 삭제 → 거부", assertFails(deleteDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b_other`))));
await t("게시판 메타: 본인 게시판 수정", assertSucceeds(updateDoc(doc(mei, `schools/${SCHOOL}/boardMetas/b1`), { label: "変更" })));

// ── 물리삭제 금지 (MODERATION.md §1) ──────────────────────────
// 🔴 authorUid 는 발신자정보 개시청구 대비 기록. 문서가 사라지면 증적이 없어진다
await t("🔴 글: 작성자 본인도 물리삭제 불가(학교 게시판)", assertFails(deleteDoc(doc(mei, BOARD_POST))));
await t("🔴 글: 작성자 본인도 물리삭제 불가(숲)", assertFails(deleteDoc(doc(mei, LOUNGE_POST))));
await t("🔴 댓글: 작성자 본인도 물리삭제 불가", assertFails(deleteDoc(doc(mei, `${BOARD_POST}/comments/c1`))));
await t("글: 소프트 삭제(deleted:true)는 가능", assertSucceeds(updateDoc(doc(mei, BOARD_POST), { deleted: true, deletedAt: 1 })));

await env.cleanup();
for (const [s, n] of r) console.log(s, n);
console.log(`${r.filter(([s]) => s === "PASS").length}/${r.length} passed`);
process.exit(r.some(([x]) => x === "FAIL") ? 1 : 0);
