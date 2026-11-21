// firestore.rules 검증: 쪽지(chats) — 신 경로 chats/ 만 쓸 수 있다
// 🗑 구 경로 schools/{sd}/chats 는 **닫혔다**. OTA가 퍼질 때까지 열어 뒀던 것(PR #39, 2026-10-31)을
//    migrate-chats-to-global.mjs 가 「옮긴 방 0」을 연속으로 낸 뒤 제거했다(OTA-2026-11 §5).
// 🔴 아래 「구 경로 → 거부」 케이스를 지우지 말 것. 학교 스코프로 되돌아가면
//    숲에서 타교 유저에게 보낸 쪽지가 상대에게 영구히 도달하지 않는다. 그 회귀를 막는 자물쇠다.
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 기본은 저장소의 firestore.rules. 다른 파일을 시험하려면 인자로 경로를 준다.
const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-ichi-chats", firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 } });
const a = env.authenticatedContext("ua").firestore();
const c = env.authenticatedContext("uc").firestore();
const room = { participants: ["ua", "ub"], lastMessageAt: serverTimestamp() };
const r = [];
const t = async (n, p) => { try { await p; r.push(["PASS", n]); } catch (e) { r.push(["FAIL", n + " :: " + e.message.split("\n")[0]]); } };
// ── 구 경로: 전부 거부 (규칙이 삭제됐으므로 참가자 본인도 못 쓴다) ──
await t("🔴 구 경로: 참가자도 방 생성 불가", assertFails(setDoc(doc(a, "schools/meiji.ac.jp/chats/ua_ub"), room)));
await t("🔴 구 경로: 참가자도 메시지 전송 불가", assertFails(addDoc(collection(a, "schools/meiji.ac.jp/chats/ua_ub/messages"), { senderUid: "ua", text: "hi", createdAt: serverTimestamp() })));
await t("🔴 구 경로: 방 읽기도 불가", assertFails(getDoc(doc(a, "schools/meiji.ac.jp/chats/ua_ub"))));
await t("구 경로: 남은 당연히 못 보냄", assertFails(addDoc(collection(c, "schools/meiji.ac.jp/chats/ua_ub/messages"), { senderUid: "uc", text: "x", createdAt: serverTimestamp() })));
await t("신 경로: 참가자는 방 생성 가능", assertSucceeds(setDoc(doc(a, "chats/ua_ub"), room)));
await t("신 경로: 참가자는 메시지 전송 가능", assertSucceeds(addDoc(collection(a, "chats/ua_ub/messages"), { senderUid: "ua", text: "hi", createdAt: serverTimestamp() })));
await t("신 경로: 남은 메시지 못 보냄", assertFails(addDoc(collection(c, "chats/ua_ub/messages"), { senderUid: "uc", text: "x", createdAt: serverTimestamp() })));
await t("신 경로: 남의 이름으로 못 보냄", assertFails(addDoc(collection(a, "chats/ua_ub/messages"), { senderUid: "ub", text: "x", createdAt: serverTimestamp() })));
await t("신 경로: 남의 방 못 읽음", assertFails(getDoc(doc(c, "chats/ua_ub"))));
await env.cleanup();
for (const [s, n] of r) console.log(s, n);
console.log(`${r.filter(([s]) => s === "PASS").length}/${r.length} passed`);
process.exit(r.some(([x]) => x === "FAIL") ? 1 : 0);
