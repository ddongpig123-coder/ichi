// 투고·댓글의 좋아요 수·댓글 수를 실제 문서 수로 다시 센다 (docs/SECURITY-1.1.md §7).
//
//   node recount-counters.mjs                        # 점검만 (기본. 아무것도 안 쓴다)
//   node recount-counters.mjs --write                # 어긋난 것만 고친다
//   node recount-counters.mjs --write --key keys/serviceAccount.json
//   node recount-counters.mjs --scope lounges        # schools | lounges (기본: 둘 다)
//
// 왜 필요한가:
//   규칙에 카운터 **하한 0**(likeCount >= 0)을 넣으려면 먼저 옛 데이터를 맞춰야 한다.
//   카운터가 실제보다 큰 글이 남아 있으면, 그 글의 좋아요를 취소하는 정상 조작이
//   하한에 걸려 거부된다(사용자에게는 "좋아요가 안 풀린다"로 보인다).
//   어긋남이 생긴 경로:
//     ① 1.0 까지 좋아요 문서와 카운터를 **따로** 썼다 → 앱이 중간에 죽으면 한쪽만 남는다
//     ② 댓글 수는 1.1 전까지 아무나 ±1 할 수 있었다 (#80 단계1 / #50 단계2 로 차단)
//     ③ 예약 게시 봇(Admin SDK)은 규칙을 안 타므로 카운터를 틀리게 쓸 수 있다
//
// 성질:
//   - **기본은 점검 전용.** 쓰기는 `--write` 를 줄 때만 한다
//   - 멱등하다. 어긋난 문서만 고치고, 맞는 문서는 건드리지 않는다
//   - 🔴 트래픽이 적은 시간에 돌리고, **끝나면 한 번 더 돌려** 「어긋남 0건」을 확인할 것.
//     세는 동안 누가 좋아요를 누르면 그 1건이 다시 어긋날 수 있다(그래서 재실행이 확인 수단)
//   - 카운터 외의 필드는 절대 건드리지 않는다. deleted 플래그도 그대로 둔다
//
// 세는 기준 (앱과 일치시킬 것):
//   likeCount    = likes 서브컬렉션의 문서 수
//   commentCount = comments 문서 수 − deleted:true 인 문서 수
//                  (softDeleteComment 가 -1 하므로 "지워지지 않은 댓글 수"가 맞다.
//                   목록에는 삭제된 댓글도 남지만 수에는 안 센다)
//
// 키: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
//     → scripts/keys/serviceAccount.json (⚠️ 커밋 금지. .gitignore에 등록됨)

import { readFile } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --플래그 [값]. 다음 토큰이 또 플래그면 값 없는 스위치로 본다
// （`--write --key x` 에서 --write 가 "--key" 를 값으로 먹지 않게. 실제로 한 번 당했다）
const args = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const v = argv[i + 1];
    args[argv[i].slice(2)] = v !== undefined && !v.startsWith("--") ? v : true;
  }
}
const write = args.write === true || args.write === "true";
const scope = typeof args.scope === "string" ? args.scope : "all";
if (!["all", "schools", "lounges"].includes(scope)) {
  console.error(`--scope 는 all | schools | lounges 중 하나여야 합니다 (받은 값: ${scope})`);
  process.exit(1);
}
// 동시에 날리는 집계 쿼리 수. 올리면 빠르지만 Firestore 쪽 부하가 커진다
const CONCURRENCY = Number(args.concurrency ?? 10) || 10;

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

// ── 공통 ────────────────────────────────────────────────────
const count = async (q) => (await q.count().get()).data().count;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// 동시 실행 제한. Promise.all 로 전부 한꺼번에 던지면 문서가 늘었을 때 터진다
async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await fn(items[i]);
      }
    })
  );
}

// 경로에서 스코프 라벨을 만든다. 모르는 모양이면 null (건드리지 않는다)
//   투고   schools/{sd}/boards/{b}/posts/{p}        = 6 세그먼트 / lounges/{l}/posts/{p} = 4
//   댓글   …/posts/{p}/comments/{c}                 = 8 세그먼트 / …                     = 6
function scopeOf(path, kind) {
  const seg = path.split("/");
  const [school, lounge] = kind === "post" ? [6, 4] : [8, 6];
  if (seg[0] === "schools" && seg[2] === "boards" && seg.length === school) {
    return scope === "lounges" ? null : { label: `${seg[1]} / ${seg[3]}` };
  }
  if (seg[0] === "lounges" && seg.length === lounge) {
    return scope === "schools" ? null : { label: `森 / ${seg[1]}` };
  }
  return null;
}

const drift = [];     // 고쳐야 하는 것
const negatives = []; // 음수로 저장돼 있는 것 (하한 0 의 직접 방해물)
const missing = [];   // 필드가 아예 없는 것
const perScope = new Map();

function note(label, field) {
  const m = perScope.get(label) ?? { likeCount: 0, commentCount: 0 };
  m[field]++;
  perScope.set(label, m);
}

// 저장값과 실제값을 비교해 기록한다
function compare(ref, label, field, stored, real) {
  if (stored === null) missing.push({ path: ref.path, field, real });
  else if (stored < 0) negatives.push({ path: ref.path, field, stored, real });
  if ((stored ?? 0) === real) return;
  drift.push({ ref, path: ref.path, field, stored, real, label });
  note(label, field);
}

// ── 1) 투고: likeCount · commentCount ───────────────────────
console.log("투고를 모으는 중…");
const postDocs = (await db.collectionGroup("posts").get()).docs;
const posts = postDocs
  .map((d) => ({ doc: d, scope: scopeOf(d.ref.path, "post") }))
  .filter((p) => p.scope);
console.log(`투고 ${postDocs.length}건 중 대상 ${posts.length}건 (집계 쿼리 ${posts.length * 3}회)`);

await mapLimit(posts, CONCURRENCY, async ({ doc: d, scope: sc }) => {
  const data = d.data();
  const comments = d.ref.collection("comments");
  const [likes, allComments, deletedComments] = await Promise.all([
    count(d.ref.collection("likes")),
    count(comments),
    count(comments.where("deleted", "==", true)),
  ]);
  compare(d.ref, sc.label, "likeCount", num(data.likeCount), likes);
  compare(d.ref, sc.label, "commentCount", num(data.commentCount), Math.max(0, allComments - deletedComments));
});

// ── 2) 댓글: likeCount ──────────────────────────────────────
console.log("댓글을 모으는 중…");
const commentDocs = (await db.collectionGroup("comments").get()).docs;
const comments = commentDocs
  .map((d) => ({ doc: d, scope: scopeOf(d.ref.path, "comment") }))
  .filter((c) => c.scope);
console.log(`댓글 ${commentDocs.length}건 중 대상 ${comments.length}건 (집계 쿼리 ${comments.length}회)`);

await mapLimit(comments, CONCURRENCY, async ({ doc: d, scope: sc }) => {
  const real = await count(d.ref.collection("likes"));
  compare(d.ref, `${sc.label} (댓글)`, "likeCount", num(d.data().likeCount), real);
});

// ── 3) 보고 ─────────────────────────────────────────────────
console.log("");
if (drift.length === 0) {
  console.log("✅ 어긋남 0건. 카운터가 실제 문서 수와 모두 일치합니다.");
} else {
  const total = (m) => m.likeCount + m.commentCount;
  for (const [label, m] of [...perScope].sort((a, b) => total(b[1]) - total(a[1]))) {
    const parts = [];
    if (m.likeCount) parts.push(`좋아요 ${m.likeCount}`);
    if (m.commentCount) parts.push(`댓글수 ${m.commentCount}`);
    console.log(`  ${label}: ${parts.join(" / ")}`);
  }
  console.log("");
  // 실제보다 큰 것이 하한 0 을 막는다(취소가 거부된다). 몇 건인지 따로 센다
  const tooHigh = drift.filter((x) => (x.stored ?? 0) > x.real).length;
  console.log(`어긋남 ${drift.length}건 (실제보다 큼 ${tooHigh} / 작음 ${drift.length - tooHigh})`);
  for (const x of drift.slice(0, 20)) {
    console.log(`  ${x.field} ${x.stored ?? "(없음)"} → ${x.real}  ${x.path}`);
  }
  if (drift.length > 20) console.log(`  … 그 밖에 ${drift.length - 20}건`);
}
if (negatives.length) {
  console.log("");
  console.log(`🔴 음수로 저장된 카운터 ${negatives.length}건 — 규칙 하한 0 을 넣기 전에 반드시 고칠 것:`);
  for (const x of negatives.slice(0, 10)) console.log(`  ${x.field} = ${x.stored}  ${x.path}`);
}
if (missing.length) {
  console.log("");
  console.log(`필드가 없는 문서 ${missing.length}건 (규칙은 get(…, 0) 으로 0 취급하므로 실제 0 이면 둬도 된다)`);
}

// ── 4) 쓰기 ─────────────────────────────────────────────────
if (!write) {
  console.log("");
  console.log(drift.length ? "점검 전용 모드입니다. 고치려면 --write 를 붙여 다시 실행하세요." : "점검 전용 모드입니다.");
  process.exit(0);
}
if (drift.length === 0) process.exit(0);

console.log("");
console.log(`${drift.length}건을 고칩니다…`);
// 같은 문서의 두 필드는 한 번에 쓴다 (좋아요·댓글 수가 둘 다 어긋난 투고)
const byDoc = new Map();
for (const x of drift) {
  const e = byDoc.get(x.path) ?? { ref: x.ref, fields: {} };
  e.fields[x.field] = x.real;
  byDoc.set(x.path, e);
}

let fixed = 0;
let failed = 0;
const entries = [...byDoc.values()];
for (let i = 0; i < entries.length; i += 400) {
  const chunk = entries.slice(i, i + 400);
  const batch = db.batch();
  for (const e of chunk) batch.update(e.ref, e.fields);
  try {
    await batch.commit();
    fixed += chunk.length;
  } catch (e) {
    // 배치는 전부 아니면 전무. 1건씩 다시 써서 원인 문서를 찍고 나머지는 살린다
    console.warn(`배치 실패(${chunk.length}건) → 1건씩 다시 씁니다: ${e?.message ?? e}`);
    for (const one of chunk) {
      try {
        await one.ref.update(one.fields);
        fixed++;
      } catch (e2) {
        failed++;
        console.error(`  ✗ ${one.ref.path}: ${e2?.message ?? e2}`);
      }
    }
  }
}
console.log("");
console.log(`고친 문서 ${fixed}건${failed ? ` / 🔴 실패 ${failed}건` : ""}`);
console.log("🔴 잠시 뒤 --write 없이 한 번 더 돌려 「어긋남 0건」을 확인할 것 (세는 동안의 좋아요가 남아 있을 수 있음).");
