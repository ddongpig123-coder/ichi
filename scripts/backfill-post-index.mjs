// 既存投稿の検索索引(postIndex)を補充する。1.1 / src/services/postIndexService.ts
//
//   node backfill-post-index.mjs --dry-run
//   node backfill-post-index.mjs --key keys/serviceAccount.json
//
// 왜 필요한가:
//   검색은 「각 게시판 최신 100건을 읽어서 클라이언트에서 거르기」였기 때문에 그보다
//   오래된 글은 검색에 안 나왔다. 1.1에서 글마다 2-gram 색인 문서를 같이 만들지만,
//   색인 도입 **전에 쓰인 글**과 **봇이 올린 글**에는 색인이 없다.
//   이 스크립트가 없는 것만 만들어 준다.
//
// 성질:
//   - 멱등하고 반복 실행용이다. 이미 색인이 있는 글은 건드리지 않는다
//     (색인 문서 id = 글 id 라서 몇 번을 돌려도 중복이 안 생긴다).
//   - 🔴 반복해서 돌릴 것. 이유 2가지:
//       ① OTA(expo-updates)는 다음 실행 때 적용되므로, 구 버전 앱으로 쓴 글은
//          며칠 동안 색인 없이 들어온다.
//       ② 예약 게시 봇(비공개 저장소 ichi-content)이 아직 색인을 안 쓴다면,
//          봇 글은 계속 색인 없이 쌓인다. 봇을 고치기 전까지는 이 스크립트가 유일한 보완책이다.
//     「새로 만든 색인 0건」이 연속으로 나오면 따라잡은 것이다.
//   - 글은 읽기만 한다. 본체는 수정하지 않는다.
//
// ⚠️ makePostGrams / makeBigrams / normalizeForSearch 는 src/utils/ngram.ts 와
//    **완전히 동일**해야 한다. 한쪽을 바꾸면 반드시 양쪽을 맞출 것
//    (앱은 번들, 여기는 Node 라서 import 공유가 안 돼 의도적으로 이중 관리한다).
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

// ── src/utils/ngram.ts と同一 ───────────────────────────────
const POST_INDEX_BODY_CHARS = 400;
const POST_GRAMS_MAX = 400;

function normalizeForSearch(s) {
  return (s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function makeBigrams(name) {
  const norm = normalizeForSearch(name);
  if (norm.length === 0) return [];
  if (norm.length === 1) return [norm];
  const set = new Set();
  for (let i = 0; i < norm.length - 1; i++) set.add(norm.slice(i, i + 2));
  return [...set];
}

function makePostGrams(title, body) {
  const set = new Set([
    ...makeBigrams(title ?? ""),
    ...makeBigrams((body ?? "").slice(0, POST_INDEX_BODY_CHARS)),
  ]);
  return [...set].slice(0, POST_GRAMS_MAX);
}
// ───────────────────────────────────────────────────────────

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

// ── 1) 모든 글을 모은다 ─────────────────────────────────────
// posts 컬렉션 그룹은 두 경로를 다 잡는다:
//   schools/{schoolDomain}/boards/{boardId}/posts/{postId}  → 색인은 schools/{sd}/postIndex
//   lounges/{loungeId}/posts/{postId}                       → 색인은 lounges/{lid}/postIndex
const snap = await db.collectionGroup("posts").get();

const targets = [];
let skippedPath = 0;
for (const d of snap.docs) {
  const seg = d.ref.path.split("/");
  if (seg[0] === "schools" && seg[2] === "boards" && seg.length === 6) {
    targets.push({
      post: d,
      scopeLabel: `${seg[1]} / ${seg[3]}`,
      boardId: seg[3],
      indexRef: db.collection("schools").doc(seg[1]).collection("postIndex").doc(d.id),
    });
  } else if (seg[0] === "lounges" && seg.length === 4) {
    targets.push({
      post: d,
      scopeLabel: `森 / ${seg[1]}`,
      boardId: seg[1],
      indexRef: db.collection("lounges").doc(seg[1]).collection("postIndex").doc(d.id),
    });
  } else {
    skippedPath++;
  }
}

console.log(`글 ${snap.size}건 (대상 ${targets.length} / 경로 밖 ${skippedPath})`);

// ── 2) 색인이 없는 것만 만든다 ──────────────────────────────
// 색인 문서를 하나씩 확인한다(존재 확인 = 1읽기). 글 수가 수천 건이 되면
// 학교/森별로 postIndex 를 한 번에 읽어 Set 으로 비교하도록 바꿀 것.
let created = 0;
let already = 0;
let noText = 0;
const perScope = new Map();

for (let i = 0; i < targets.length; i += 200) {
  const chunk = targets.slice(i, i + 200);
  const existing = await db.getAll(...chunk.map((c) => c.indexRef));

  const batch = db.batch();
  let inBatch = 0;

  for (let k = 0; k < chunk.length; k++) {
    const { post, boardId, indexRef, scopeLabel } = chunk[k];
    if (existing[k].exists) {
      already++;
      continue;
    }
    const data = post.data();
    const grams = makePostGrams(data.title ?? "", data.body ?? "");
    if (grams.length === 0) {
      // 제목·본문이 비어 있으면 색인할 게 없다(규칙이 grams 0건을 거부하므로 맞춰 둔다)
      noText++;
      continue;
    }
    const createdAt =
      typeof data.createdAt === "number"
        ? data.createdAt
        : data.createdAt?.toMillis?.() ?? Date.now();

    if (!dryRun) {
      batch.set(indexRef, {
        boardId,
        authorUid: data.authorUid ?? "",
        grams,
        createdAt,
      });
      inBatch++;
    }
    created++;
    perScope.set(scopeLabel, (perScope.get(scopeLabel) ?? 0) + 1);
  }

  if (inBatch > 0) await batch.commit();
}

console.log("");
for (const [scope, n] of [...perScope].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${scope}: ${n}건`);
}
console.log("");
console.log(`${dryRun ? "[dry-run] " : ""}새로 만든 색인 ${created}건 / 이미 있음 ${already}건 / 제목·본문 없음 ${noText}건`);
if (dryRun) console.log("실제로 쓰려면 --dry-run 없이 다시 실행하세요.");
else if (created > 0) console.log("🔴 며칠 뒤 다시 돌려 「새로 만든 색인 0건」을 확인할 것 (파일 상단 주석 참조).");
