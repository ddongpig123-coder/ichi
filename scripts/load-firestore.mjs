// ============================================================
// 크롤 JSON → Firestore 적재 (Firebase Admin SDK)
// 로드맵 Phase 1c. 적재 경로(firestore.rules와 1:1):
//   schools/{schoolDomain}/departments/{deptId}/courses/{courseId}
//
// 사용법:
//   node load-firestore.mjs --file output/courses-12-2026-10.json --dept 12 --dry-run
//   node load-firestore.mjs --file output/courses-12-2026-10.json --dept 12 \
//        --school meiji.ac.jp --key keys/serviceAccount.json
//
//   --dry-run : Admin SDK 없이 데이터 검증 + 적재 시뮬레이션만 (키 불필요)
//   --school  : schoolDomain (기본 meiji.ac.jp)
//               ※ 2026-07 태희와 합의: schoolDomain = "meiji.ac.jp" 확정.
//                 실제 적재 시점은 검색 UX(10월 3주차) 착수 직전.
//   --dept    : deptId (기본: 파일명의 category 코드. 예: 12=商学部)
//   --key     : 서비스 계정 키 경로 (기본 keys/serviceAccount.json)
//               ⚠️ 키는 절대 커밋 금지 (.gitignore 등록됨)
// ============================================================

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Course 타입 검증 (src/types/course.ts와 1:1) ─────────
const VALID_DAYS = ["月", "火", "水", "木", "金", "土"];
const VALID_PERIODS = [1, 2, 3, 4, 5, 6, 7];
const VALID_SEMESTERS = ["春", "秋"];

// ⚠️ src/utils/ngram.ts의 makeBigrams와 동기화할 것 ⚠️
// scripts/는 앱과 별도 패키지라 import가 불가능해 복제한다. 어느 한쪽만 고치면
// 적재된 gram과 앱이 만드는 검색 gram이 어긋나 검색이 조용히 0건이 된다.
// 사양 (2026-07-21 태희·준희 합의):
//   정규화: NFKC → 소문자 → 공백 제거
//   생성:   인접 2글자 슬라이딩 → 중복 제거
// 앱은 array-contains로 대표 gram 1개를 매칭한 뒤 클라이언트에서 전문 포함 재필터한다.
function makeBigrams(text) {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const grams = new Set();
  for (let i = 0; i < normalized.length - 1; i++) {
    grams.add(normalized.slice(i, i + 2));
  }
  return [...grams];
}

function validateCourse(c, i) {
  const errs = [];
  if (!c.id || typeof c.id !== "string") errs.push("id 없음");
  if (!c.name || typeof c.name !== "string") errs.push("name 없음");
  if (typeof c.teacher !== "string") errs.push("teacher 타입 오류");
  if (!VALID_DAYS.includes(c.day)) errs.push(`day 오류: ${c.day}`);
  if (!VALID_PERIODS.includes(c.period)) errs.push(`period 오류: ${c.period}`);
  if (!VALID_SEMESTERS.includes(c.semester)) errs.push(`semester 오류: ${c.semester}`);
  if (typeof c.year !== "number") errs.push("year 타입 오류");
  if (c.campus !== null && typeof c.campus !== "string") errs.push("campus 타입 오류");
  if (c.courseNumber !== null && typeof c.courseNumber !== "string") errs.push("courseNumber 타입 오류");
  if (c.credits !== null && typeof c.credits !== "number") errs.push("credits 타입 오류");
  if (c.sourceUrl !== null && typeof c.sourceUrl !== "string") errs.push("sourceUrl 타입 오류");
  if (c.addedBy !== "official") errs.push(`addedBy는 "official"이어야 함: ${c.addedBy}`);
  if (c.verified !== true) errs.push("공식 크롤 데이터는 verified: true여야 함");
  // confirmCount는 Course 타입에서 제거됨 (2026-07-21) — 승격 판정은
  // courses/{id}/confirms/{uid} 서브컬렉션의 문서 수로 파생한다.
  // 기존 크롤 JSON에는 아직 남아 있으므로 적재 시 제거한다(재크롤 불필요).
  if (typeof c.createdAt !== "number") errs.push("createdAt 타입 오류");
  return errs.length ? `[${i}] ${c.name ?? "?"}: ${errs.join(", ")}` : null;
}

// Firestore 문서 ID로 쓸 수 없는 문자 방지 ("/" 등)
function safeDocId(id) {
  return id.replace(/\//g, "-");
}

// 크롤 JSON 1건 → 적재할 Firestore 문서.
// confirmCount 제거 + 검색용 nameGrams 추가. 크롤 JSON 자체는 건드리지 않는다.
function toFirestoreDoc(c) {
  const { confirmCount, ...rest } = c;
  return { ...rest, nameGrams: makeBigrams(c.name) };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith("--") ? next : true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error("사용법: node load-firestore.mjs --file output/courses-12-2026-10.json --dept 12 [--dry-run] [--school meiji.ac.jp] [--key keys/serviceAccount.json]");
    process.exit(1);
  }

  const filePath = isAbsolute(args.file) ? args.file : join(__dirname, args.file);
  const school = args.school ?? "meiji.ac.jp";
  // dept 기본값: 파일명 courses-{category}-... 에서 추출
  const dept = args.dept ?? (filePath.match(/courses-(\w+)-/)?.[1] ?? null);
  if (!dept) {
    console.error("--dept를 지정하세요 (파일명에서 category를 추출하지 못함)");
    process.exit(1);
  }

  const courses = JSON.parse(await readFile(filePath, "utf-8"));
  console.log(`\n📦 적재 대상: ${courses.length}과목`);
  console.log(`   경로: schools/${school}/departments/${dept}/courses/{id}`);

  // ── 검증 ──
  const errors = courses.map(validateCourse).filter(Boolean);
  if (errors.length) {
    console.error(`\n❌ Course 타입 검증 실패 ${errors.length}건:`);
    errors.slice(0, 10).forEach((e) => console.error("   " + e));
    if (errors.length > 10) console.error(`   ... 외 ${errors.length - 10}건`);
    process.exit(1);
  }
  const ids = new Set(courses.map((c) => safeDocId(c.id)));
  if (ids.size !== courses.length) {
    console.error(`❌ 문서 ID 중복: ${courses.length - ids.size}건`);
    process.exit(1);
  }
  console.log(`   ✓ Course 타입 검증 통과 (오류 0, id 중복 0)`);

  // 정규화 후 1글자인 강의명은 2-gram이 0개 = array-contains로 영영 검색되지 않는다.
  // 실데이터에 있으면 검색에서 누락되므로 눈에 띄게 경고한다.
  const noGrams = courses.filter((c) => makeBigrams(c.name).length === 0);
  if (noGrams.length) {
    console.warn(`\n⚠️  2-gram 0개(=검색 불가) 강의 ${noGrams.length}건:`);
    noGrams.slice(0, 5).forEach((c) => console.warn(`   ${c.id} / "${c.name}"`));
    console.warn(`   → 검색에서 누락됩니다. 태희와 처리 방침 확인 필요.`);
  }

  if (args["dry-run"]) {
    console.log(`\n🔍 dry-run 모드 — 실제 쓰기 없음. 샘플 3건:`);
    for (const c of courses.slice(0, 3)) {
      const doc = toFirestoreDoc(c);
      console.log(`   schools/${school}/departments/${dept}/courses/${safeDocId(c.id)}`);
      console.log(`     → ${c.name} / ${c.teacher} / ${c.day}${c.period} / ${c.credits ?? "?"}単位`);
      console.log(`     nameGrams(${doc.nameGrams.length}): ${doc.nameGrams.slice(0, 8).join(" ")}${doc.nameGrams.length > 8 ? " …" : ""}`);
      console.log(`     confirmCount 제거됨: ${!("confirmCount" in doc)}`);
    }
    const gramCounts = courses.map((c) => makeBigrams(c.name).length);
    const avg = (gramCounts.reduce((a, b) => a + b, 0) / gramCounts.length).toFixed(1);
    console.log(`\n   nameGrams 평균 ${avg}개 / 최대 ${Math.max(...gramCounts)}개`);
    console.log(`\n✅ dry-run 완료. 실제 적재는 --dry-run 빼고 서비스 계정 키와 함께 실행.`);
    return;
  }

  // ── 실제 적재 (Admin SDK는 여기서만 로드 — dry-run은 키 불필요) ──
  const keyPath = isAbsolute(args.key ?? "") ? args.key : join(__dirname, args.key ?? "keys/serviceAccount.json");
  // firebase-admin v10+ 의 modular API를 쓴다.
  // (구 네임스페이스 API `admin.credential.cert`는 v14 ESM에서 undefined — 2026-07 확인)
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
    console.error("Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → scripts/keys/serviceAccount.json 으로 저장 (커밋 금지)");
    process.exit(1);
  }

  const app = initializeApp({ credential: cert(key) });
  const db = getFirestore(app);
  const col = db.collection("schools").doc(school).collection("departments").doc(dept).collection("courses");

  // Firestore batch는 500건 제한 → 400건씩 커밋
  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < courses.length; i += CHUNK) {
    const batch = db.batch();
    for (const c of courses.slice(i, i + CHUNK)) {
      batch.set(col.doc(safeDocId(c.id)), toFirestoreDoc(c));
    }
    await batch.commit();
    written += Math.min(CHUNK, courses.length - i);
    console.log(`   적재 ${written}/${courses.length}`);
  }

  console.log(`\n✅ 적재 완료: ${written}과목 → schools/${school}/departments/${dept}/courses`);
}

main().catch((e) => {
  console.error("❌ 적재 실패:", e);
  process.exit(1);
});
