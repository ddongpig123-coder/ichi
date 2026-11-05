// firestore.rules 검증: 친구 관계는 (a) 수락된 신청 또는 (b) 초대 링크로만 만들어진다
// (a) QA-B4 / (b) docs/INVITE-LINK.md §3
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-ichi-rules",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
});

// 앱과 같은 규칙으로 정렬한 pairId
const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const ids = (a, b) => [a, b].sort();
// 실제 토큰은 expo-crypto UUID 에서 하이픈을 뺀 32자
const ERIN_TOKEN = "a".repeat(32);
const MALLORY_TOKEN = "m".repeat(32);

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "friendRequests/r-pending"), { fromUid: "alice", toUid: "bob", status: "pending" });
  await setDoc(doc(db, "friendRequests/r-accepted"), { fromUid: "carol", toUid: "bob", status: "accepted" });
  await setDoc(doc(db, "friendRequests/r-rejected"), { fromUid: "dave", toUid: "bob", status: "rejected" });
  await setDoc(doc(db, "friendRequests/r-self"), { fromUid: "mallory", toUid: "mallory", status: "accepted" });
  // 피해자의 친구 공개 시간표
  await setDoc(doc(db, "users/victim/timetables/2026-秋"), { visibility: "friends", sessions: [] });
  // 초대 링크: 토큰은 users/{uid}(본인만 읽음)에 있다. 규칙의 get() 만 읽을 수 있다
  await setDoc(doc(db, "users/erin"), { uid: "erin", inviteToken: ERIN_TOKEN });
  await setDoc(doc(db, "users/mallory"), { uid: "mallory", inviteToken: MALLORY_TOKEN });
  // 아직 링크를 한 번도 공유하지 않은 사람 — 토큰 필드가 없다
  await setDoc(doc(db, "users/victim"), { uid: "victim" });
});

const bob = env.authenticatedContext("bob").firestore();
const alice = env.authenticatedContext("alice").firestore();
const mallory = env.authenticatedContext("mallory").firestore();
const frank = env.authenticatedContext("frank").firestore();

const results = [];
async function t(name, p) {
  try { await p; results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + e.message.split("\n")[0]]); }
}

const friendship = (db, a, b, requestId) =>
  setDoc(doc(db, `friendships/${pairId(a, b)}`), {
    participants: ids(a, b), createdAt: 1, ...(requestId ? { requestId } : {}),
  });

// ── 공격 ──
await t("공격: 신청 없이 친구 관계 생성 → 거부", assertFails(friendship(mallory, "mallory", "victim")));
await t("공격: 없는 신청 번호 → 거부", assertFails(friendship(mallory, "mallory", "victim", "nope")));
await t("공격: 남들의 수락된 신청 번호를 재사용 → 거부", assertFails(friendship(mallory, "mallory", "victim", "r-accepted")));
await t("공격: 자기 자신에게 수락한 신청으로 남과 친구 → 거부", assertFails(friendship(mallory, "mallory", "victim", "r-self")));
await t("공격: 자기 자신에게 신청 생성 → 거부",
  assertFails(setDoc(doc(mallory, "friendRequests/new-self"), { fromUid: "mallory", toUid: "mallory", status: "pending" })));
await t("공격: 친구가 못 됐으니 친구 공개 시간표도 못 읽음",
  assertFails(getDoc(doc(mallory, "users/victim/timetables/2026-秋"))));
await t("공격: 신청한 쪽이 혼자 수락 → 거부",
  assertFails(updateDoc(doc(alice, "friendRequests/r-pending"), { status: "accepted" })));
await t("공격: 대기 중 신청으로 친구 관계 생성 → 거부", assertFails(friendship(alice, "alice", "bob", "r-pending")));
await t("거절된 신청으로 친구 관계 생성 → 거부", assertFails(friendship(bob, "dave", "bob", "r-rejected")));

// ── 정상 흐름 ──
await t("정상: 신청 생성", assertSucceeds(setDoc(doc(alice, "friendRequests/r-new"), { fromUid: "alice", toUid: "bob", status: "pending" })));
const accept = writeBatch(bob);
accept.update(doc(bob, "friendRequests/r-pending"), { status: "accepted" });
accept.set(doc(bob, `friendships/${pairId("alice", "bob")}`), { participants: ids("alice", "bob"), requestId: "r-pending", createdAt: 1 });
await t("정상: 받은 사람이 수락(batch)", assertSucceeds(accept.commit()));
await t("정상: 친구 관계를 읽을 수 있음", assertSucceeds(getDoc(doc(alice, `friendships/${pairId("alice", "bob")}`))));
await t("정상: 친구 끊기", assertSucceeds(deleteDoc(doc(alice, `friendships/${pairId("alice", "bob")}`))));
await t("정상: 수락된 신청 기록 삭제 (친구 끊을 때 앱이 함께 지움)", assertSucceeds(deleteDoc(doc(alice, "friendRequests/r-pending"))));
await t("재공격: 기록이 지워지면 옛 번호로 다시 친구 → 거부", assertFails(friendship(bob, "alice", "bob", "r-pending")));

// ── 초대 링크 (b) ────────────────────────────────────────────
// 링크를 연 쪽이 friendships 를 직접 만든다. requestId 는 보내지 않는다
const invite = (db, me, inviter, token, extra = {}) =>
  setDoc(doc(db, `friendships/${pairId(me, inviter)}`), {
    participants: ids(me, inviter), createdAt: 1, via: "invite", inviteToken: token, ...extra,
  });

// 🔑 이게 통과해야 한다. (a) 의 getAfter 는 requestId 가 없으면 에러가 나는데,
//    그 에러에 초대 경로까지 휩쓸리면 초대 링크가 전부 permission-denied 로 죽는다
await t("정상: 초대 링크로 친구 (requestId 없음)", assertSucceeds(invite(frank, "frank", "erin", ERIN_TOKEN)));
await t("정상: 만들어진 관계를 읽을 수 있음", assertSucceeds(getDoc(doc(frank, `friendships/${pairId("frank", "erin")}`))));
await t("정상: 초대로 맺은 관계도 끊을 수 있음", assertSucceeds(deleteDoc(doc(frank, `friendships/${pairId("frank", "erin")}`))));
// 문서화된 한계(INVITE-LINK §6): 토큰을 재발급하지 않으면 같은 링크로 다시 친구가 된다
await t("한계: 끊은 뒤 같은 링크로 다시 친구 (의도된 동작)", assertSucceeds(invite(frank, "frank", "erin", ERIN_TOKEN)));

await t("공격: 토큰이 틀리면 → 거부", assertFails(invite(mallory, "mallory", "erin", "z".repeat(32))));
await t("공격: via 없이 토큰만 → 거부",
  assertFails(setDoc(doc(mallory, `friendships/${pairId("mallory", "erin")}`),
    { participants: ids("mallory", "erin"), createdAt: 1, inviteToken: ERIN_TOKEN })));
await t("공격: via 만 있고 토큰 없음 → 거부",
  assertFails(setDoc(doc(mallory, `friendships/${pairId("mallory", "erin")}`),
    { participants: ids("mallory", "erin"), createdAt: 1, via: "invite" })));
await t("공격: 짧은 토큰(15자) → 거부", assertFails(invite(mallory, "mallory", "erin", "a".repeat(15))));
await t("공격: 토큰이 문자열이 아님 → 거부", assertFails(invite(mallory, "mallory", "erin", 12345678901234567890)));
// 토큰이 없는 사람(users 에 필드 없음)을 빈 문자열로 통과시키려는 시도
await t("공격: 토큰을 만든 적 없는 사람에게 빈 문자열 → 거부", assertFails(invite(mallory, "mallory", "victim", "")));
await t("공격: 토큰을 만든 적 없는 사람에게 32자 → 거부", assertFails(invite(mallory, "mallory", "victim", "a".repeat(32))));
// 링크를 받아 토큰을 아는 사람은 그 토큰으로 「발급자」와만 친구가 될 수 있다
await t("공격: 받은 토큰으로 제3자와 친구 → 거부", assertFails(invite(frank, "frank", "victim", ERIN_TOKEN)));
// 🔴 자기 자신과 친구: 자기 토큰은 자기가 아니까 participants:[me,me] 가 통과해버린다
await t("공격: 자기 토큰으로 자기 자신과 친구 → 거부",
  assertFails(setDoc(doc(mallory, "friendships/mallory_mallory"),
    { participants: ["mallory", "mallory"], createdAt: 1, via: "invite", inviteToken: MALLORY_TOKEN })));
await t("공격: participants 가 1명 → 거부",
  assertFails(setDoc(doc(mallory, `friendships/${pairId("mallory", "erin")}`),
    { participants: ["mallory"], createdAt: 1, via: "invite", inviteToken: ERIN_TOKEN })));
await t("공격: 자기가 안 든 쌍을 초대로 생성 → 거부",
  assertFails(setDoc(doc(mallory, `friendships/${pairId("bob", "erin")}`),
    { participants: ids("bob", "erin"), createdAt: 1, via: "invite", inviteToken: ERIN_TOKEN })));
await t("공격: 초대 토큰으로 남의 친구 공개 시간표 읽기 → 거부",
  assertFails(getDoc(doc(mallory, "users/victim/timetables/2026-秋"))));

await env.cleanup();
for (const [s, n] of results) console.log(s, n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
