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
//               ※ 현재 앱 AuthContext는 "global" 사용 중 — 검색 UX 붙일 때(10월 3주차)
//                 태희와 schoolDomain 정책 확정 후 실제 적재할 것
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
  if (typeof c.confirmCount !== "number") errs.push("confirmCount 타입 오류");
  if (typeof c.createdAt !== "number") errs.push("createdAt 타입 오류");
  return errs.length ? `[${i}] ${c.name ?? "?"}: ${errs.join(", ")}` : null;
}

// Firestore 문서 ID로 쓸 수 없는 문자 방지 ("/" 등)
function safeDocId(id) {
  return id.replace(/\//g, "-");
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

  if (args["dry-run"]) {
    console.log(`\n🔍 dry-run 모드 — 실제 쓰기 없음. 샘플 3건:`);
    for (const c of courses.slice(0, 3)) {
      console.log(`   schools/${school}/departments/${dept}/courses/${safeDocId(c.id)}`);
      console.log(`     → ${c.name} / ${c.teacher} / ${c.day}${c.period} / ${c.credits ?? "?"}単位`);
    }
    console.log(`\n✅ dry-run 완료. 실제 적재는 --dry-run 빼고 서비스 계정 키와 함께 실행.`);
    return;
  }

  // ── 실제 적재 (Admin SDK는 여기서만 로드 — dry-run은 키 불필요) ──
  const keyPath = isAbsolute(args.key ?? "") ? args.key : join(__dirname, args.key ?? "keys/serviceAccount.json");
  let admin;
  try {
    admin = await import("firebase-admin");
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

  admin.default.initializeApp({ credential: admin.default.credential.cert(key) });
  const db = admin.default.firestore();
  const col = db.collection("schools").doc(school).collection("departments").doc(dept).collection("courses");

  // Firestore batch는 500건 제한 → 400건씩 커밋
  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < courses.length; i += CHUNK) {
    const batch = db.batch();
    for (const c of courses.slice(i, i + CHUNK)) {
      batch.set(col.doc(safeDocId(c.id)), c);
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
