// 쪽지(chats)를 학교 스코프 → 전국 스코프로 이전한다. 1.1 / docs/BOARD-ACCESS.md §3-3 Q4
//
//   node migrate-chats-to-global.mjs --dry-run
//   node migrate-chats-to-global.mjs --key keys/serviceAccount.json
//
// 왜 필요한가:
//   1.0은 방을 schools/{schoolDomain}/chats/{chatId} 에 만들었다. 보내는 쪽 학교 아래에
//   방이 생기는데 받는 쪽은 자기 학교 아래만 구독하므로, 숲에서 타교 유저에게 보낸
//   쪽지가 영구히 도달하지 않았다. 1.1에서 chats/{chatId} 최상위로 옮겨 해소했고,
//   이 스크립트가 기존 방을 새 경로로 복사한다.
//
// 성질:
//   - 멱등하고 반복 실행용이다. 이미 옮긴 방은 "빠진 메시지만" 더한다.
//     메시지 문서 id를 그대로 쓰므로 몇 번을 돌려도 중복이 안 생긴다.
//   - 🔴 한 번만 돌리면 안 된다. OTA(expo-updates)는 다음 실행 때 적용되므로
//     구 단말이 며칠 동안 구 경로에 계속 쓴다.
//     「메시지 0건」이 연속으로 나올 때까지 날짜를 두고 몇 번 더 돌릴 것.
//   - 복사만 한다. 구 경로는 지우지 않는다 — 문제가 생기면 되돌릴 수 있어야 하기 때문.
//   - chatId는 [uid1, uid2].sort().join("_") 이라 학교와 무관하게 전역 유일하다.
//     그래서 경로만 바꿔도 충돌이 나지 않는다.
//   - 같은 두 사람의 방이 두 학교 아래에 있으면(양쪽에서 각각 보낸 경우) 메시지를
//     합치고, 방 메타는 lastMessageAt이 더 최신인 쪽을 쓴다.
//
// 키: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
//     → scripts/keys/serviceAccount.json (⚠️ 커밋 금지. .gitignore에 등록됨)

import { readFile } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] ?? true] : []))
    .filter((e) => e.length)
);
const dryRun = args["dry-run"] === true || args["dry-run"] === "true";

const keyPathRaw = typeof args.key === "string" ? args.key : "keys/serviceAccount.json";
const keyPath = isAbsolute(keyPathRaw) ? keyPathRaw : join(__dirname, keyPathRaw);

let initializeApp, cert, getFirestore;
try {
  ({ initializeApp, cert } = await import("firebase-admin/app"));
  ({ getFirestore } = await import("firebase-admin/firestore"));
} catch {
  console.error("firebase-admin이 없습니다. scripts/에서 `npm install firebase-admin` 후 재실행하세요.");
  process.exit(1);
}

let key;
try {
  key = JSON.parse(await readFile(keyPath, "utf-8"));
} catch {
  console.error(`서비스 계정 키를 읽지 못했습니다: ${keyPath}`);
  console.error("Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → scripts/keys/serviceAccount.json (커밋 금지)");
  process.exit(1);
}

const db = getFirestore(initializeApp({ credential: cert(key) }));

// ── 1) 구 경로의 모든 방을 모은다 ────────────────────────────
// collectionGroup("chats")는 schools/{sd}/chats 와 최상위 chats 를 모두 잡으므로
// 부모가 schools 인 것만 고른다(최상위 chats 문서는 parent가 null).
const snap = await db.collectionGroup("chats").get();
const legacy = [];
for (const d of snap.docs) {
  const schoolDoc = d.ref.parent.parent; // schools/{schoolDomain} 또는 null
  if (!schoolDoc || schoolDoc.parent.id !== "schools") continue; // 이미 전국 경로
  legacy.push({ ref: d.ref, id: d.id, school: schoolDoc.id, data: d.data() });
}

console.log(`구 경로(schools/*/chats) 방: ${legacy.length}개`);
if (legacy.length === 0) {
  console.log("이전할 것이 없습니다.");
  process.exit(0);
}

const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0);

// 같은 chatId가 여러 학교 아래 있을 수 있으므로 묶는다
const byId = new Map();
for (const row of legacy) {
  const list = byId.get(row.id) ?? [];
  list.push(row);
  byId.set(row.id, list);
}

// ── 2) 방마다: 없으면 만들고, 있으면 빠진 메시지만 더한다 ──────
let created = 0, topped = 0, upToDate = 0, msgCopied = 0;

for (const [chatId, rows] of byId) {
  const target = db.collection("chats").doc(chatId);
  const targetSnap = await target.get();

  // 방 메타는 lastMessageAt이 가장 최신인 쪽
  const primary = [...rows].sort((a, b) => ms(b.data.lastMessageAt) - ms(a.data.lastMessageAt))[0];

  // 메시지는 모든 출처에서 모아 createdAt 순으로
  const msgs = [];
  for (const r of rows) {
    const m = await r.ref.collection("messages").get();
    for (const d of m.docs) msgs.push({ id: d.id, data: d.data() });
  }
  msgs.sort((a, b) => ms(a.data.createdAt) - ms(b.data.createdAt));

  // 이미 옮긴 방이면 빠진 것만 추린다(반복 실행 대비)
  let missing = msgs;
  if (targetSnap.exists) {
    const have = new Set((await target.collection("messages").get()).docs.map((d) => d.id));
    missing = msgs.filter((m) => !have.has(m.id));
    if (missing.length === 0) {
      upToDate += 1;
      continue; // 이미 최신. 조용히 넘어간다
    }
  }

  const from = rows.map((r) => r.school).join(", ");
  console.log(`  ${targetSnap.exists ? "따라잡기" : "복사"} ${chatId} — ${from} / 메시지 ${missing.length}건`);
  if (dryRun) {
    if (targetSnap.exists) topped += 1; else created += 1;
    msgCopied += missing.length;
    continue;
  }

  // 메시지 → 방 메타 순. 쓰기 450건마다 커밋(Firestore 배치 한도 500)
  let batch = db.batch();
  let n = 0;
  const flush = async () => { if (n > 0) { await batch.commit(); batch = db.batch(); n = 0; } };

  for (const m of missing) {
    batch.set(target.collection("messages").doc(m.id), m.data);
    n += 1;
    if (n >= 450) await flush();
  }

  if (!targetSnap.exists) {
    batch.set(target, { ...primary.data, migratedFrom: from, migratedAt: new Date() });
    n += 1;
  } else {
    // 이미 있는 방: 참가자·기존 메시지는 건드리지 않는다.
    // 구 경로 쪽이 더 최신일 때만, 목록 정렬에 쓰는 마지막 메시지 정보를 갱신한다.
    const newest = missing[missing.length - 1];
    if (ms(newest.data.createdAt) > ms(targetSnap.data().lastMessageAt)) {
      const text = String(newest.data.text ?? "");
      batch.set(
        target,
        {
          lastMessage: text.length > 40 ? text.slice(0, 40) + "…" : text,
          lastMessageAt: newest.data.createdAt,
          lastSenderUid: newest.data.senderUid,
        },
        { merge: true }
      );
      n += 1;
    }
  }
  await flush();

  if (targetSnap.exists) topped += 1; else created += 1;
  msgCopied += missing.length;
}

console.log(
  `\n${dryRun ? "[dry-run] " : ""}새로 옮긴 방 ${created}개 / 따라잡은 방 ${topped}개 / 이미 최신 ${upToDate}개 / 메시지 ${msgCopied}건`
);
if (dryRun) {
  console.log("실제 이전은 --dry-run 없이 실행하세요.");
} else {
  console.log("구 경로는 지우지 않았습니다.");
  console.log("구 단말이 OTA를 받을 때까지 구 경로에 계속 쓰이므로, 며칠에 걸쳐 몇 번 더 돌리세요.");
  console.log("「메시지 0건」이 연속으로 나오면 firestore.rules의 DEPRECATED 블록과 함께 정리하면 됩니다.");
}
