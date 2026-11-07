// firestore.rules 검증: 개인정보·권한 (docs/SECURITY-1.1.md §2-1)
//
// 여기까지 테스트가 없던 컬렉션들을 한 번에 덮는다. 전부 「남의 것은 못 본다·못 쓴다」가 핵심이고,
// 하나라도 뚫리면 개인정보 유출이라 규칙을 고칠 때마다 제일 먼저 돌려야 하는 파일이다.
//   users / usersPublic / emailIndex / users/{uid}/timetables · blocks · scraps
//   operators / reports / inquiries
//
// 🔴 이 파일이 지키는 것 3개 (뚫리면 바로 사고)
//   ① users 본문은 본인만 — 이메일·입학연도·초대 토큰(inviteToken)이 들어 있다.
//      inviteToken 이 읽히면 그 사람과 임의로 친구가 될 수 있다(docs/INVITE-LINK.md §3).
//   ② verificationLevel 자기 승격 금지 — 학교 인증을 스스로 올릴 수 있으면 1.2 게이팅이 무의미해진다.
//   ③ reports·inquiries 는 읽기 전면 금지 — 누가 누구를 신고했는지가 보이면 보복이 가능해진다.
//
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-rules",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

const SCHOOL = "meiji.ac.jp";
const SEM = "2026-spring";
const ALICE_MAIL = "alice@example.com";

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  // alice·bob 은 친구, carol 은 남. 시간표 공개범위 판정을 전부 이 관계로 시험한다
  await setDoc(doc(db, "users/alice"), {
    uid: "alice", email: ALICE_MAIL, nickname: "alice", schoolDomain: SCHOOL,
    verificationLevel: 0, department: "12", admissionYear: 2024,
    // 🔑 본인만 읽어야 하는 값. 아래 「타인 읽기 거부」가 이걸 지킨다
    inviteToken: "k".repeat(32),
  });
  await setDoc(doc(db, "users/bob"), {
    uid: "bob", nickname: "bob", schoolDomain: SCHOOL, verificationLevel: 0, department: "12",
  });
  await setDoc(doc(db, "users/carol"), {
    uid: "carol", nickname: "carol", schoolDomain: SCHOOL, verificationLevel: 0, department: "99",
  });
  await setDoc(doc(db, "usersPublic/alice"), { uid: "alice", nickname: "alice" });
  await setDoc(doc(db, "usersPublic/bob"), { uid: "bob", nickname: "bob" });
  await setDoc(doc(db, "friendships/alice_bob"), { participants: ["alice", "bob"], createdAt: 1 });

  await setDoc(doc(db, `users/alice/timetables/${SEM}`), { visibility: "private", entries: [] });
  await setDoc(doc(db, `users/bob/timetables/${SEM}`), { visibility: "friends", entries: [] });
  await setDoc(doc(db, `users/carol/timetables/${SEM}`), { visibility: "private", entries: [] });

  await setDoc(doc(db, "users/alice/blocks/zed"), { createdAt: 1 });
  await setDoc(doc(db, "users/alice/scraps/free_p1"), { boardId: "free", postId: "p1", title: "t" });

  await setDoc(doc(db, "operators/op1"), { addedAt: 1 });
  await setDoc(doc(db, "reports/r1"), { reporterUid: "alice", targetPath: "x", reason: "spam" });
  await setDoc(doc(db, "inquiries/i1"), { uid: "alice", body: "x" });
  await setDoc(doc(db, `emailIndex/${ALICE_MAIL}`), { uid: "alice" });
});

const alice = env.authenticatedContext("alice", { email: ALICE_MAIL }).firestore();
const bob = env.authenticatedContext("bob", { email: "bob@example.com" }).firestore();
const carol = env.authenticatedContext("carol").firestore();
const dave = env.authenticatedContext("dave").firestore();   // 아직 users 문서가 없는 신규 유저
const op = env.authenticatedContext("op1").firestore();
const guest = env.unauthenticatedContext().firestore();

const r = [];
const t = async (n, p) => {
  try { await p; r.push(["PASS", n]); }
  catch (e) { r.push(["FAIL", n + " :: " + e.message.split("\n")[0]]); }
};

// ── users (본인만) ───────────────────────────────────────────
await t("users: 본인 읽기", assertSucceeds(getDoc(doc(alice, "users/alice"))));
// 🔴 이게 뚫리면 이메일·입학연도·inviteToken 이 전부 남에게 보인다
await t("🔴 users: 타인 읽기 → 거부", assertFails(getDoc(doc(bob, "users/alice"))));
await t("users: 미로그인 읽기 → 거부", assertFails(getDoc(doc(guest, "users/alice"))));
await t("users: 타인 문서 수정 → 거부", assertFails(updateDoc(doc(bob, "users/alice"), { nickname: "위조" })));
await t("users: 타인 문서 삭제 → 거부", assertFails(deleteDoc(doc(bob, "users/alice"))));
await t("users: 본인 다른 필드 수정", assertSucceeds(updateDoc(doc(alice, "users/alice"), { nickname: "alice2" })));
// 🔴 자기 승격 차단. 1.2 의 학교 메일 게이팅이 이 한 줄에 걸려 있다
await t("🔴 users: verificationLevel 자기 승격 → 거부", assertFails(updateDoc(doc(alice, "users/alice"), { verificationLevel: 1 })));
// 같은 값(0)을 다시 쓰면 diff 에 안 걸려서 통과한다 — 규칙이 「변경」만 보기 때문. 의도된 동작
await t("users: verificationLevel 을 같은 값(0)으로 재기록 → 통과(diff 에 안 걸림)", assertSucceeds(updateDoc(doc(alice, "users/alice"), { verificationLevel: 0, nickname: "alice3" })));
await t("users: 신규 생성은 verificationLevel 0 만", assertSucceeds(setDoc(doc(dave, "users/dave"), { uid: "dave", nickname: "dave", verificationLevel: 0, schoolDomain: null })));
await t("🔴 users: 생성 시 verificationLevel 1 → 거부", assertFails(setDoc(doc(carol, "users/carol2"), { uid: "carol2", verificationLevel: 1 })));
await t("users: 남의 uid 로 문서 생성 → 거부", assertFails(setDoc(doc(bob, "users/zzz"), { uid: "zzz", verificationLevel: 0 })));

// ── usersPublic (공개 미러. 쓰기는 본인만) ────────────────────
await t("usersPublic: 로그인하면 타인 것 읽기 가능(친구 검색)", assertSucceeds(getDoc(doc(bob, "usersPublic/alice"))));
await t("usersPublic: 미로그인 읽기 → 거부", assertFails(getDoc(doc(guest, "usersPublic/alice"))));
// 🔴 이게 뚫리면 남의 공개 프로필을 바꿔치기할 수 있다(사칭)
await t("🔴 usersPublic: 타인 uid 문서에 쓰기 → 거부", assertFails(setDoc(doc(bob, "usersPublic/alice"), { uid: "alice", nickname: "사칭" })));
await t("usersPublic: 자기 문서에 uid 를 타인으로 위조 → 거부", assertFails(setDoc(doc(bob, "usersPublic/bob"), { uid: "alice", nickname: "bob" })));
await t("usersPublic: 본인 문서 정상 쓰기", assertSucceeds(setDoc(doc(bob, "usersPublic/bob"), { uid: "bob", nickname: "bob2" })));
await t("usersPublic: 타인 문서 삭제 → 거부", assertFails(deleteDoc(doc(bob, "usersPublic/alice"))));

// ── emailIndex (메일로 친구 찾기. 토큰의 메일과 일치해야 등록 가능) ──
await t("emailIndex: 본인 메일 색인 생성", assertSucceeds(setDoc(doc(alice, `emailIndex/${ALICE_MAIL}`), { uid: "alice" })));
await t("🔴 emailIndex: 타인 메일을 내 uid 로 등록 → 거부", assertFails(setDoc(doc(bob, `emailIndex/${ALICE_MAIL}`), { uid: "bob" })));
await t("emailIndex: 내 메일에 타인 uid 를 넣기 → 거부", assertFails(setDoc(doc(alice, `emailIndex/${ALICE_MAIL}`), { uid: "bob" })));
// list 금지 — 전체 메일 주소 목록을 긁어가는 것을 막는다(get 만 허용)
await t("🔴 emailIndex: 목록 조회(list) → 거부", assertFails(getDocs(collection(alice, "emailIndex"))));
await t("emailIndex: 단건 조회(get)는 가능", assertSucceeds(getDoc(doc(bob, `emailIndex/${ALICE_MAIL}`))));

// ── timetables (공개범위 private / friends 2택) ────────────────
await t("timetables: 본인 읽기", assertSucceeds(getDoc(doc(alice, `users/alice/timetables/${SEM}`))));
await t("timetables: 친구의 friends 공개 읽기", assertSucceeds(getDoc(doc(alice, `users/bob/timetables/${SEM}`))));
await t("timetables: 친구의 private 읽기 → 거부", assertFails(getDoc(doc(bob, `users/alice/timetables/${SEM}`))));
await t("timetables: 남(친구 아님)의 private 읽기 → 거부", assertFails(getDoc(doc(carol, `users/bob/timetables/${SEM}`))));
// 🔴 남의 시간표를 덮어쓰는 것은 데이터 파괴 + 친구 겹침 조작
await t("🔴 timetables: 타인 시간표 쓰기 → 거부", assertFails(setDoc(doc(bob, `users/alice/timetables/${SEM}`), { visibility: "public", entries: [] })));
await t("timetables: 본인 시간표 쓰기", assertSucceeds(setDoc(doc(alice, `users/alice/timetables/${SEM}`), { visibility: "friends", entries: [] })));

// ── blocks / scraps (본인 전용. 차단 사실이 상대에게 보이면 안 된다) ──
await t("🔴 blocks: 타인 차단목록 읽기 → 거부", assertFails(getDoc(doc(bob, "users/alice/blocks/zed"))));
await t("blocks: 본인 차단목록 쓰기", assertSucceeds(setDoc(doc(alice, "users/alice/blocks/yyy"), { createdAt: 1 })));
await t("🔴 scraps: 타인 스크랩 읽기 → 거부", assertFails(getDoc(doc(bob, "users/alice/scraps/free_p1"))));
await t("scraps: 본인 스크랩 쓰기", assertSucceeds(setDoc(doc(alice, "users/alice/scraps/free_p2"), { boardId: "free", postId: "p2", title: "t" })));

// ── operators (운영 계정 명단. 콘솔에서만 등록) ────────────────
await t("operators: 본인 여부 확인(get)", assertSucceeds(getDoc(doc(op, "operators/op1"))));
await t("operators: 타인 문서 확인 → 거부", assertFails(getDoc(doc(alice, "operators/op1"))));
// 🔴 자기 등록이 되면 콘텐츠 대기목록(contentQueue)을 아무나 읽고 쓸 수 있다
await t("🔴 operators: 자기 등록(쓰기) → 거부", assertFails(setDoc(doc(alice, "operators/alice"), { addedAt: 1 })));
await t("operators: 운영자 본인도 쓰기 불가", assertFails(setDoc(doc(op, "operators/op1"), { addedAt: 2 })));
await t("🔴 operators: 명단 목록 조회(list) → 거부", assertFails(getDocs(collection(op, "operators"))));

// ── reports (신고. 쓰기 전용) ─────────────────────────────────
await t("reports: 본인 이름으로 신고 생성", assertSucceeds(addDoc(collection(bob, "reports"), { reporterUid: "bob", targetPath: "x", reason: "spam", createdAt: serverTimestamp() })));
await t("reports: reporterUid 위조 → 거부", assertFails(addDoc(collection(bob, "reports"), { reporterUid: "alice", targetPath: "x", reason: "spam" })));
// 🔴 누가 누구를 신고했는지가 보이면 보복이 가능해진다
await t("🔴 reports: 읽기 → 거부(작성자 본인도)", assertFails(getDoc(doc(alice, "reports/r1"))));
await t("🔴 reports: 목록 조회 → 거부", assertFails(getDocs(collection(alice, "reports"))));
await t("reports: 수정 → 거부", assertFails(updateDoc(doc(alice, "reports/r1"), { reason: "x" })));
await t("reports: 삭제 → 거부", assertFails(deleteDoc(doc(alice, "reports/r1"))));

// ── inquiries (문의. 쓰기 전용) ───────────────────────────────
await t("inquiries: 본인 uid 로 문의 생성", assertSucceeds(addDoc(collection(bob, "inquiries"), { uid: "bob", body: "x", createdAt: serverTimestamp() })));
await t("inquiries: uid 위조 → 거부", assertFails(addDoc(collection(bob, "inquiries"), { uid: "alice", body: "x" })));
await t("🔴 inquiries: 읽기 → 거부(작성자 본인도)", assertFails(getDoc(doc(alice, "inquiries/i1"))));
await t("inquiries: 수정 → 거부", assertFails(updateDoc(doc(alice, "inquiries/i1"), { body: "x" })));
await t("inquiries: 삭제 → 거부", assertFails(deleteDoc(doc(alice, "inquiries/i1"))));

await env.cleanup();
for (const [s, n] of r) console.log(s, n);
console.log(`${r.filter(([s]) => s === "PASS").length}/${r.length} passed`);
process.exit(r.some(([x]) => x === "FAIL") ? 1 : 0);
