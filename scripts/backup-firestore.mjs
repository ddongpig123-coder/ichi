// Firestore 백업·복구 (docs/SECURITY-1.1.md §2-3 / 절차는 docs/BACKUP.md)
//
//   node backup-firestore.mjs --estimate                   읽기 몇 건 드는지만 센다(덤프 안 함)
//   node backup-firestore.mjs --out ../../../ichi-backup   덤프
//   node backup-firestore.mjs --restore <덤프폴더>          복구 미리보기(기본은 쓰기 0)
//   node backup-firestore.mjs --restore <덤프폴더> --write  실제 복구
//
// 🔴 왜 필요한가: 요금제가 **Spark(무료)** 라 자동 백업도 PITR(시점 복구)도 없다.
//    실수로 컬렉션을 지우거나 스크립트가 잘못 돌면 **되돌릴 방법이 전혀 없다.**
//    규칙으로 물리삭제를 막아 뒀지만(MODERATION §1) Admin SDK 스크립트는 규칙을 안 거친다
//    — 즉 가장 위험한 건 우리가 돌리는 스크립트다.
//
// 🔴 읽기 한도에 주의: Spark 는 **하루 읽기 5만 건**이고, 넘으면 그날 앱이 멈춘다.
//    전수 덤프는 모든 문서를 1건씩 읽으므로 그대로 돌리면 한도를 날릴 수 있다. 그래서
//      ① 강의(courses)·검색색인(postIndex)은 **기본 제외**한다 — 둘 다 다시 만들 수 있다
//         (강의: 크롤 + docs/data, 색인: backfill-post-index.mjs). 합쳐 2만 건이 넘는다.
//      ② --max-reads(기본 20000)를 넘기면 **중단**한다. 먼저 --estimate 로 재 보는 걸 권한다.
//
// 성질:
//   - 읽기 전용(복구 모드 외). 같은 날 여러 번 돌려도 데이터는 안 변한다
//   - 서브컬렉션까지 재귀로 따라간다(listCollections)
//   - 타임스탬프·참조·바이트는 형을 보존해서 적는다(복구할 때 문자열로 변하지 않게)
//   - 복구는 **있는 문서는 건드리지 않는다**(덮어쓰려면 --overwrite). 되살리는 게 목적이고
//     지금 쓰이는 데이터를 과거로 되돌리는 게 목적이 아니다
//
// 출력: <out>/<UTC타임스탬프>/ 안에
//   manifest.json      — 언제·무엇을·몇 건 받았나 (복구 전에 이걸 먼저 볼 것)
//   <컬렉션>.jsonl     — 한 줄 = 한 문서 {"path":"users/ab","data":{…}}
//
// 키: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
//     → scripts/keys/serviceAccount.json (⚠️ 커밋 금지. .gitignore 에 등록됨)
// ⚠️ 덤프 결과는 개인정보(이메일·쪽지 본문·초대 토큰)가 그대로 들어 있다.
//    **저장소 밖**에 두고, 다른 사람에게 보내지 말 것. 기본 --out 도 저장소 밖이다.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { isAbsolute, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldPath } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --플래그 [값]. 다음 토큰이 또 플래그면 값 없는 스위치로 본다
// （`--write --key x` 에서 --write 가 "--key" 를 값으로 먹지 않게）
const args = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const v = argv[i + 1];
    args[argv[i].slice(2)] = v !== undefined && !v.startsWith("--") ? v : true;
  }
}
const flag = (name) => args[name] === true || args[name] === "true";

const estimate = flag("estimate");
const restoreDir = typeof args.restore === "string" ? args.restore : null;
const write = flag("write");
const overwrite = flag("overwrite");
const maxReads = Number(args["max-reads"] ?? 20000);
const only = typeof args.only === "string" ? args.only : null;

// 다시 만들 수 있는 큰 컬렉션은 기본 제외(위 ① 참조). --all 로 포함할 수 있다
const SKIP_DEFAULT = ["courses", "postIndex"];
const skip = flag("all")
  ? []
  : typeof args.skip === "string"
    ? args.skip.split(",").map((s) => s.trim()).filter(Boolean)
    : SKIP_DEFAULT;

const keyPathRaw = typeof args.key === "string" ? args.key : "keys/serviceAccount.json";
const keyPath = isAbsolute(keyPathRaw) ? keyPathRaw : join(__dirname, keyPathRaw);
// 기본 출력은 **저장소 밖**(scripts/../../ichi-backup). 개인정보가 들어가므로 커밋될 곳에 두지 않는다
const outRoot = typeof args.out === "string"
  ? (isAbsolute(args.out) ? args.out : join(process.cwd(), args.out))
  : join(__dirname, "..", "..", "ichi-backup");

const svc = JSON.parse(await readFile(keyPath, "utf8"));
initializeApp({ credential: cert(svc), projectId: svc.project_id });
const db = getFirestore();

// ── 형 보존 인코딩 ────────────────────────────────────────────
// JSON 으로 그냥 적으면 Timestamp 가 {_seconds,_nanoseconds} 같은 내부 모양으로 굳어
// 복구할 때 「시각」이 아니라 「객체」로 들어간다. 날짜 정렬이 전부 깨진다.
function enc(v) {
  if (v === null || typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : { __type__: "num", value: String(v) };
  if (Array.isArray(v)) return v.map(enc);
  if (v instanceof Timestamp) return { __type__: "ts", value: v.toDate().toISOString() };
  if (v instanceof Date) return { __type__: "ts", value: v.toISOString() };
  if (Buffer.isBuffer(v)) return { __type__: "bytes", value: v.toString("base64") };
  if (typeof v === "object" && typeof v.path === "string" && typeof v.id === "string" && v.firestore) {
    return { __type__: "ref", value: v.path };            // DocumentReference
  }
  if (typeof v === "object" && typeof v.latitude === "number" && typeof v.longitude === "number") {
    return { __type__: "geo", lat: v.latitude, lng: v.longitude };
  }
  if (typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = enc(x);
    return o;
  }
  return null;
}

function dec(v) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(dec);
  if (typeof v.__type__ === "string") {
    if (v.__type__ === "ts") return Timestamp.fromDate(new Date(v.value));
    if (v.__type__ === "bytes") return Buffer.from(v.value, "base64");
    if (v.__type__ === "ref") return db.doc(v.value);
    if (v.__type__ === "geo") return { latitude: v.lat, longitude: v.lng };
    if (v.__type__ === "num") return Number(v.value);
  }
  const o = {};
  for (const [k, x] of Object.entries(v)) o[k] = dec(x);
  return o;
}

// ── 세기(estimate) ───────────────────────────────────────────
// 🔑 재귀로 세지 않는 이유: 서브컬렉션은 문서마다 listCollections 를 해야 알 수 있고
//    listDocuments 는 문서 1건당 읽기 1건으로 과금된다 → 「재 보는 것」이 「덤프」와
//    같은 값이 돼서 의미가 없어진다. 그래서 **컬렉션 그룹 집계**로 센다.
//    collectionGroup(id).count() 는 경로 깊이와 무관하게 그 이름의 모든 컬렉션을 한 번에 세고,
//    집계는 색인 1000건당 읽기 1건이라 사실상 공짜다.
//
// 🔴 **새 컬렉션을 만들면 여기에 이름을 추가할 것.** 빠뜨리면 세는 값만 적게 나온다
//    (덤프 자체는 listCollections 로 전부 따라가므로 누락되지 않는다).
//    목록 근거: firestore.rules 의 match 경로 = src/types/*.
const GROUPS = [
  "users", "timetables", "blocks", "scraps", "usersPublic", "emailIndex",
  "friendRequests", "friendships", "reports", "inquiries",
  "chats", "messages",
  "posts", "comments", "likes", "postIndex", "boardMetas",
  "courses", "confirms", "reviews",
  "operators", "contentQueue",
];
// 최상위 컬렉션 중 위 목록으로 설명되지 않는 것이 있으면 경고한다(새 컬렉션 감지)
const KNOWN_ROOTS = [
  "users", "usersPublic", "emailIndex", "friendRequests", "friendships",
  "reports", "inquiries", "chats", "schools", "lounges", "operators", "contentQueue",
];

// ── 덤프 ─────────────────────────────────────────────────────
let reads = 0;
function budget(n) {
  reads += n;
  if (reads > maxReads) {
    throw new Error(
      `읽기 ${reads}건 > --max-reads ${maxReads}. 중단했다.\n` +
      `   Spark 한도(하루 5만)를 날리지 않으려는 안전장치다. --estimate 로 먼저 재거나 --max-reads 를 올릴 것`
    );
  }
}

// 🔴 여기에 함정이 하나 있다(처음 판에서 실제로 당했다):
//    `schools/{학교}` · `schools/{학교}/boards/{게시판}` · `lounges/{숲}` 은 **문서가 아니다.**
//    경로의 중간 토막일 뿐이고 그 아래 서브컬렉션에만 데이터가 있다. 쿼리(get)는 「없는 문서」를
//    돌려주지 않으니, 쿼리 결과만 따라가면 schools·lounges 가 **0건으로 나오고 글이 통째로 빠진다.**
//    → listDocuments() 는 그런 가상 부모의 참조도 돌려준다. 쿼리로 본문을 받고,
//      쿼리에 없던 id(=가상 부모)는 서브컬렉션만 따라 들어간다.
async function dumpCollection(col, sink, stats) {
  if (skip.includes(col.id)) { stats.skipped.add(col.id); return; }

  // 가상 부모까지 포함한 전체 id 목록(문서 id 읽기로 과금된다)
  const refs = await col.listDocuments();
  budget(refs.length);
  const seen = new Set();

  let last = null;
  for (;;) {
    let q = col.orderBy(FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    budget(snap.size);
    for (const d of snap.docs) {
      seen.add(d.id);
      sink.write(JSON.stringify({ path: d.ref.path, data: enc(d.data()) }) + "\n");
      stats.docs++;
      for (const sub of await d.ref.listCollections()) await dumpCollection(sub, sink, stats);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }

  // 쿼리에 안 나온 것 = 실체가 없는 경로 토막. 본문은 없고 아래만 있다
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    for (const sub of await ref.listCollections()) await dumpCollection(sub, sink, stats);
  }
}

async function runBackup() {
  const roots = (await db.listCollections()).filter((c) => !only || c.id === only);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(outRoot, stamp);
  await mkdir(dir, { recursive: true });

  const manifest = { project: svc.project_id, startedAt: new Date().toISOString(), collections: {}, skipped: [] };
  for (const col of roots) {
    if (skip.includes(col.id)) { manifest.skipped.push(col.id); continue; }
    const file = join(dir, `${col.id}.jsonl`);
    const sink = createWriteStream(file, { encoding: "utf8" });
    const stats = { docs: 0, skipped: new Set() };
    await dumpCollection(col, sink, stats);
    await new Promise((res, rej) => sink.end((e) => (e ? rej(e) : res())));
    manifest.collections[col.id] = { file: basename(file), docs: stats.docs };
    manifest.skipped.push(...stats.skipped);
    console.log(`  ${col.id.padEnd(16)} ${stats.docs}건`);
  }
  manifest.skipped = [...new Set(manifest.skipped)];
  manifest.finishedAt = new Date().toISOString();
  manifest.reads = reads;
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const total = Object.values(manifest.collections).reduce((a, c) => a + c.docs, 0);
  console.log(`\n✅ ${total}건 저장 (읽기 ${reads}건)\n   ${dir}`);
  if (manifest.skipped.length) {
    console.log(`   제외: ${manifest.skipped.join(", ")} — 다시 만들 수 있는 컬렉션. 전부 받으려면 --all`);
  }
  console.log("   ⚠️ 개인정보가 들어 있다. 저장소 밖에 두고 공유하지 말 것");
}

// ── 복구 ─────────────────────────────────────────────────────
async function runRestore() {
  const dir = isAbsolute(restoreDir) ? restoreDir : join(process.cwd(), restoreDir);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
  if (files.length === 0) throw new Error(`${dir} 에 .jsonl 이 없다`);

  console.log(write ? "🔴 실제로 씁니다" : "미리보기 (쓰지 않음. 실제로 넣으려면 --write)");
  console.log(overwrite ? "   있는 문서도 덮어씁니다(--overwrite)" : "   있는 문서는 건너뜁니다");

  let created = 0, skippedExisting = 0, pending = [];
  const flush = async () => {
    if (pending.length === 0) return;
    const batch = db.batch();
    for (const { ref, data } of pending) batch.set(ref, data);
    await batch.commit();
    pending = [];
  };

  for (const f of files) {
    if (only && basename(f, ".jsonl") !== only) continue;
    const rl = createInterface({ input: createReadStream(join(dir, f), "utf8"), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const { path, data } = JSON.parse(line);
      const ref = db.doc(path);
      if (!overwrite) {
        // 🔑 1건씩 존재 확인하므로 복구도 읽기를 쓴다. 전수 복구면 읽기가 문서 수만큼 든다
        if ((await ref.get()).exists) { skippedExisting++; continue; }
      }
      created++;
      if (write) {
        pending.push({ ref, data: dec(data) });
        if (pending.length >= 400) await flush();
      }
    }
    console.log(`  ${f}`);
  }
  if (write) await flush();
  console.log(`\n${write ? "넣은" : "넣을"} 문서 ${created}건 / 이미 있어서 건너뜀 ${skippedExisting}건`);
  if (!write) console.log("실제로 넣으려면 같은 명령에 --write 를 붙일 것");
}

// ── 실행 ─────────────────────────────────────────────────────
try {
  if (restoreDir) {
    await runRestore();
  } else if (estimate) {
    console.log(`읽기 비용을 셉니다 (프로젝트 ${svc.project_id}) — 집계 쿼리라 거의 공짜`);
    let total = 0, skippedTotal = 0;
    for (const id of GROUPS) {
      const n = (await db.collectionGroup(id).count().get()).data().count;
      if (n === 0) continue;
      if (skip.includes(id)) { skippedTotal += n; console.log(`  ${id.padEnd(16)} ${n}건  (제외)`); continue; }
      console.log(`  ${id.padEnd(16)} ${n}건`);
      total += n;
    }
    console.log(`\n덤프 대상 ${total}건 / 제외 ${skippedTotal}건 (Spark 하루 읽기 한도 50,000)`);
    if (total > maxReads) console.log(`🔴 --max-reads ${maxReads} 보다 많다. 덤프하려면 --max-reads 를 올릴 것`);
    const unknown = (await db.listCollections()).map((c) => c.id).filter((id) => !KNOWN_ROOTS.includes(id));
    if (unknown.length) {
      console.log(`\n🔴 목록에 없는 최상위 컬렉션: ${unknown.join(", ")}`);
      console.log("   덤프에는 들어가지만 이 숫자에는 안 세졌다. 이 파일의 GROUPS/KNOWN_ROOTS 에 추가할 것");
    }
  } else {
    console.log(`덤프 시작 (프로젝트 ${svc.project_id})`);
    await runBackup();
  }
} catch (e) {
  console.error(`\n🔴 ${e.message}`);
  process.exit(1);
}
