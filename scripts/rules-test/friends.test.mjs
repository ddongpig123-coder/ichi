// firestore.rules 검증: 친구 관계는 수락된 신청이 있어야 만들어진다 (QA-B4)
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

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "friendRequests/r-pending"), { fromUid: "alice", toUid: "bob", status: "pending" });
  await setDoc(doc(db, "friendRequests/r-accepted"), { fromUid: "carol", toUid: "bob", status: "accepted" });
  await setDoc(doc(db, "friendRequests/r-rejected"), { fromUid: "dave", toUid: "bob", status: "rejected" });
  await setDoc(doc(db, "friendRequests/r-self"), { fromUid: "mallory", toUid: "mallory", status: "accepted" });
  // 피해자의 친구 공개 시간표
  await setDoc(doc(db, "users/victim/timetables/2026-秋"), { visibility: "friends", sessions: [] });
});

const bob = env.authenticatedContext("bob").firestore();
const alice = env.authenticatedContext("alice").firestore();
const mallory = env.authenticatedContext("mallory").firestore();

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

await env.cleanup();
for (const [s, n] of results) console.log(s, n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
