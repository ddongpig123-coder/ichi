// firestore.rules 검증: 쪽지(chats) — 구 경로 schools/{sd}/chats(현재 배포된 앱)·신 경로 chats/ (S3)
// 구 경로 쓰기는 OTA가 모든 단말에 닿을 때까지 열어 둔다 (PR #39, 2026-10-31)
// 실행: scripts/rules-test 에서 `npm test` (README.md)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 기본은 저장소의 firestore.rules. 다른 파일을 시험하려면 인자로 경로를 준다.
const RULES = process.argv[2] ?? fileURLToPath(new URL("../../firestore.rules", import.meta.url));
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-ichi-chats", firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 } });
const a = env.authenticatedContext("ua").firestore();
const c = env.authenticatedContext("uc").firestore();
const room = { participants: ["ua", "ub"], lastMessageAt: serverTimestamp() };
const r = [];
const t = async (n, p) => { try { await p; r.push(["PASS", n]); } catch (e) { r.push(["FAIL", n + " :: " + e.message.split("\n")[0]]); } };
await t("구 경로(현재 앱): 참가자는 방 생성 가능", assertSucceeds(setDoc(doc(a, "schools/meiji.ac.jp/chats/ua_ub"), room)));
await t("구 경로(현재 앱): 참가자는 메시지 전송 가능", assertSucceeds(addDoc(collection(a, "schools/meiji.ac.jp/chats/ua_ub/messages"), { senderUid: "ua", text: "hi", createdAt: serverTimestamp() })));
await t("구 경로: 남은 메시지 못 보냄", assertFails(addDoc(collection(c, "schools/meiji.ac.jp/chats/ua_ub/messages"), { senderUid: "uc", text: "x", createdAt: serverTimestamp() })));
await t("구 경로: 남의 이름으로 못 보냄", assertFails(addDoc(collection(a, "schools/meiji.ac.jp/chats/ua_ub/messages"), { senderUid: "ub", text: "x", createdAt: serverTimestamp() })));
await t("신 경로: 참가자는 방 생성 가능", assertSucceeds(setDoc(doc(a, "chats/ua_ub"), room)));
await t("신 경로: 참가자는 메시지 전송 가능", assertSucceeds(addDoc(collection(a, "chats/ua_ub/messages"), { senderUid: "ua", text: "hi", createdAt: serverTimestamp() })));
await t("신 경로: 남은 메시지 못 보냄", assertFails(addDoc(collection(c, "chats/ua_ub/messages"), { senderUid: "uc", text: "x", createdAt: serverTimestamp() })));
await env.cleanup();
for (const [s, n] of r) console.log(s, n);
console.log(`${r.filter(([s]) => s === "PASS").length}/${r.length} passed`);
process.exit(r.some(([x]) => x === "FAIL") ? 1 : 0);
