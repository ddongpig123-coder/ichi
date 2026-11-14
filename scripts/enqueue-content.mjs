// 시딩 글(초안 묶음 JSON)을 콘텐츠 큐(contentQueue)에 한 번에 넣는다 (CONTENT-OPS §9)
//
//   node enqueue-content.mjs --file ~/Downloads/seed.json                      # 미리보기 (기본. 아무것도 안 쓴다)
//   node enqueue-content.mjs --file ~/Downloads/seed.json --write --as 1       # 「초안(draft)」으로 넣기 → 앱 운영자 화면에서 승인
//   node enqueue-content.mjs --file ~/Downloads/seed.json --write --as 1 --approved   # 바로 「승인」으로 넣기 → 봇이 시간 나눠 게시
//
// 왜: 운영자 화면에서 18개를 하나씩 손으로 옮기면 오래 걸리고 오타가 난다.
//
// 🔒 시딩 글 JSON 은 **저장소에 넣지 않는다**(공개 저장소, CONTENT-OPS §9-3). 파일은 내려받은 곳에 두고 경로만 넘긴다.
//
// JSON 형식 (배열):
//   [ { "scope": "lounge", "boardId": "ryugakusei_free", "title": "…", "body": "…" },
//     { "scope": "school", "schoolDomain": "meiji.ac.jp", "boardId": "free", "title": "…", "body": "…" } ]
//   - lounge 의 boardId = loungeId (src/types/lounge.ts LOUNGES 의 id)
//   - 그 밖의 키(memo 등)는 무시한다
//
// 성질:
//   - 기본은 미리보기. 쓰기는 --write 일 때만
//   - **같은 게시판에 같은 제목이 이미 큐에 있으면 건너뛴다** → 두 번 돌려도 중복으로 안 들어간다
//   - 큐 문서 모양은 앱의 createManualItem(src/services/contentQueueService.ts)과 같다 (source: "manual")
//   - --as: 큐에 「만든 사람」으로 남길 운영자. 미리보기에 번호 목록이 나온다(운영자가 1명이면 생략 가능)
//
// 키: scripts/keys/serviceAccount.json (⚠️ 커밋 금지)

import { readFile } from "node:fs/promises";
import { isAbsolute, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const v = argv[i + 1];
    args[argv[i].slice(2)] = v !== undefined && !v.startsWith("--") ? v : true;
  }
}
const write = args.write === true;
const approved = args.approved === true;
if (typeof args.file !== "string") {
  console.error("✖ --file 로 시딩 글 JSON 경로를 주세요. 예: node enqueue-content.mjs --file ~/Downloads/seed.json");
  process.exit(1);
}
const filePath = resolve(args.file.replace(/^~(?=\/)/, homedir()));

// 숲 게시판 id (src/types/lounge.ts LOUNGES 와 같아야 한다 — 다르면 미리보기에서 걸러 보여 준다)
const LOUNGE_IDS = new Set([
  "chat", "minna_question", "market", "job",
  "ryugakusei_free", "ryugakusei_question", "visa", "parttime", "housing", "shinokubo",
]);

let items;
try {
  items = JSON.parse(await readFile(filePath, "utf-8"));
  if (!Array.isArray(items)) throw new Error("배열이 아님");
} catch (e) {
  console.error(`✖ JSON 을 읽지 못했습니다: ${filePath} (${e.message})`);
  process.exit(1);
}

// 형식 검사 (firestore.rules isValidQueueItem 과 같은 기준)
const problems = [];
items.forEach((it, i) => {
  const n = `#${i + 1}`;
  if (it.scope !== "lounge" && it.scope !== "school") problems.push(`${n} scope 는 lounge 또는 school`);
  if (typeof it.boardId !== "string" || !it.boardId) problems.push(`${n} boardId 없음`);
  if (it.scope === "lounge" && !LOUNGE_IDS.has(it.boardId)) problems.push(`${n} 모르는 숲 게시판 id: ${it.boardId}`);
  if (it.scope === "school" && (typeof it.schoolDomain !== "string" || !it.schoolDomain)) problems.push(`${n} school 은 schoolDomain 필요`);
  if (typeof it.title !== "string" || !it.title.trim() || it.title.trim().length > 100) problems.push(`${n} 제목 1~100자`);
  if (typeof it.body !== "string" || !it.body.trim() || it.body.trim().length > 5000) problems.push(`${n} 본문 1~5000자`);
});
if (problems.length) {
  console.error("✖ 형식 오류 — 아무것도 넣지 않았습니다:\n  " + problems.join("\n  "));
  process.exit(1);
}

const keyPathRaw = typeof args.key === "string" ? args.key : "keys/serviceAccount.json";
const keyPath = isAbsolute(keyPathRaw) ? keyPathRaw : join(__dirname, keyPathRaw);
const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
let app;
if (process.env.FIRESTORE_EMULATOR_HOST) {
  app = initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-ichi" });
} else {
  let key;
  try { key = JSON.parse(await readFile(keyPath, "utf-8")); }
  catch { console.error(`✖ 서비스 계정 키를 읽지 못했습니다: ${keyPath}`); process.exit(1); }
  app = initializeApp({ credential: cert(key) });
}
const db = getFirestore(app);

// 운영자 목록 (번호로 고른다)
const ops = (await db.collection("operators").get()).docs.map((d) => d.id).sort();
const nick = async (uid) => (await db.doc(`usersPublic/${uid}`).get()).data()?.nickname ?? "(닉네임 없음)";
let asUid = null;
if (typeof args.as === "string") {
  asUid = /^\d+$/.test(args.as) ? ops[Number(args.as) - 1] : args.as;
  if (!asUid || !ops.includes(asUid)) { console.error(`✖ --as ${args.as} 은 운영자가 아닙니다`); process.exit(1); }
} else if (ops.length === 1) {
  asUid = ops[0];
}

console.log(`\n운영자 ${ops.length}명:`);
for (const [i, uid] of ops.entries()) console.log(`  ${i + 1}) ${uid.slice(0, 8)}…  ${await nick(uid)}${uid === asUid ? "  ← 이 계정으로 넣음" : ""}`);

// 이미 큐에 같은 게시판·같은 제목이 있으면 건너뛴다
const plan = [];
for (const it of items) {
  const dup = await db.collection("contentQueue").where("boardId", "==", it.boardId).where("title", "==", it.title.trim()).limit(1).get();
  plan.push({ it, dup: !dup.empty });
}
const todo = plan.filter((p) => !p.dup);
console.log(`\n${filePath}`);
console.log(`글 ${items.length}개 — 새로 넣을 것 ${todo.length}개 / 이미 큐에 있어 건너뜀 ${items.length - todo.length}개`);
for (const p of plan) console.log(`  ${p.dup ? "↷ 건너뜀" : "＋"}  [${p.it.boardId}] ${p.it.title}`);

if (!write) {
  console.log(`\n[미리보기] 아무것도 쓰지 않았습니다. 넣으려면 --write${ops.length > 1 ? " --as <번호>" : ""} 를 붙이세요 (바로 승인하려면 --approved 도).`);
  process.exit(0);
}
if (!asUid) { console.error("\n✖ 운영자가 여러 명입니다. --as <번호> 로 고르세요(위 목록)."); process.exit(1); }

const status = approved ? "approved" : "draft";
let n = 0;
for (const { it } of todo) {
  await db.collection("contentQueue").add({
    status,
    source: "manual",
    scope: it.scope,
    schoolDomain: it.scope === "school" ? it.schoolDomain : null,
    boardId: it.boardId,
    title: it.title.trim(),
    body: it.body.trim(),
    topic: null,
    sourceUrl: null,
    createdBy: asUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  n++;
}
console.log(`\n✅ ${n}개를 「${status === "approved" ? "승인" : "초안"}」으로 넣었습니다.` +
  (approved ? " 봇이 시간을 나눠 게시합니다." : " 앱 → 운영자 화면에서 확인·승인하세요."));
