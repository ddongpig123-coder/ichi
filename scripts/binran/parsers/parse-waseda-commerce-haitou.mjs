// 早稲田大学 商学部「学科目配当表」PDF → 앱 강의 데이터(Course 타입, src/types/course.ts)
//
// 왜 배당표인가: 와세다 시라버스(wsl.waseda.jp)가 2026-10 현재 접속 불가라 크롤러를 못 만든다
// (DATA-MANUAL §13-1). 商学部는 공개 페이지에 학과목 배당표 PDF(전 수업의 학기·요일·교시·교수)를 올린다.
//
// 실행 (scripts/binran 에서):
//   node parsers/parse-waseda-commerce-haitou.mjs --year 2026 \
//     --pdf <2024年度以降入学者用.pdf> --pdf <2023年度以前入学者用.pdf> --out ../output
// 출력:
//   ../output/courses-waseda-161973-<year>-10.json  (春)
//   ../output/courses-waseda-161973-<year>-20.json  (秋)
//   ../output/waseda-161973-<year>-report.json      (건너뛴 행·충돌·통계)
//
// 규칙 (DATA-MANUAL §13-1에 같은 내용):
//   - 표는 grid.mjs가 괘선으로 복원한다(병합 셀 추측 없음).
//   - 曜日時限① 열이 없는 표(他分野指定科目 = 다른 트랙 수업 재게재, 旧履修 인정표)는 건너뛴다.
//   - （本年度休講） 행, ※5(商学部生は履修できません) 행은 제외.
//   - 학기: 通年→春·秋 둘 다 / 春·夏(春Q·夏Q·夏集中…)→春 / 秋·冬→秋.
//   - 요일·교시가 「無」(온디맨드)거나 없으면(集中) 시간표 칸이 없으므로 제외(메이지 크롤과 같은 규칙).
//   - 주 2회 수업(①②)은 칸마다 1건. 앱은 Course 1건 = 시간표 1칸이기 때문.
//   - 두 PDF에 같은 수업(NFKC 과목명·클래스·학기·요일교시)이 있으면 1건(먼저 준 --pdf 값 유지).
//     단위가 다르면 credits=null(커리큘럼마다 다름), 교수가 다르면 report.conflicts에 기록.
import fs from 'fs';
import path from 'path';
import { openPdf, pageItems, pageSegments, extractTables } from '../grid.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const pdfs = args.flatMap((a, i) => (args[i - 1] === '--pdf' ? [a] : []));
const year = Number(opt('--year'));
const outDir = opt('--out') || '../output';
if (!pdfs.length || !year) {
  console.error('usage: --year 2026 --pdf <a.pdf> [--pdf <b.pdf>] [--out ../output]');
  process.exit(1);
}
const DEPT = '161973'; // 早稲田 시라버스의 商学部 코드(p_gakubu). Firestore deptId로 쓴다.

const VALID_DAYS = ['月', '火', '水', '木', '金', '土'];
const ASCII_END = /[A-Za-z0-9.,:;)\]&'’-]$/;
const ASCII_START = /^[A-Za-z0-9(\[&'‘]/;

// 칸 여러 줄 → 한 문자열. 영문끼리 줄바꿈이면 공백, 일본어 줄바꿈이면 그냥 잇는다.
function joinName(lines) {
  let s = '';
  for (const l of lines) s += s && ASCII_END.test(s) && ASCII_START.test(l) ? ' ' + l : l;
  return s.trim();
}
const cell = (row, label) => (row.cells[label]?.lines || []);

function semesters(raw) {
  const t = raw.normalize('NFKC');
  if (t.includes('通年')) return ['春', '秋'];
  if (/^[春夏]/.test(t)) return ['春'];
  if (/^[秋冬]/.test(t)) return ['秋'];
  return null;
}
function slot(raw) {
  const t = (raw || '').normalize('NFKC').replace(/\s+/g, '');
  const m = t.match(/^([月火水木金土日])([1-7])$/);
  if (/^無/.test(t)) return { ok: false, raw: '無', orig: t }; // 「無そ」(p12 원문 오타)도 無
  if (!m) return { ok: false, raw: t };
  if (!VALID_DAYS.includes(m[1])) return { ok: false, raw: t };
  return { ok: true, day: m[1], period: Number(m[2]) };
}
function makeId(name, cls, sem, day, period) {
  return [name.normalize('NFKC'), cls, sem, `${day}${period}`]
    .filter(Boolean).join('-')
    .replace(/[^\w가-힣ぁ-んァ-ヶー一-龯]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const report = { source: pdfs.map((p) => path.basename(p)), year, dept: DEPT, tables: [], skipped: [], conflicts: [], warnings: [] };
const byKey = new Map(); // 중복 제거 키 → course
const now = Date.now();

for (const pdf of pdfs) {
  const doc = await openPdf(pdf);
  const src = path.basename(pdf);
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tables = extractTables(await pageItems(page), await pageSegments(page));
    for (const t of tables) {
      const labels = t.columns.map((c) => c.label);
      const usable = ['科目名', '担当者', '学期', '単位', '曜日時限①'].every((l) => labels.includes(l));
      report.tables.push({ src, page: p, title: t.title, rows: t.rows.length, used: usable });
      if (!usable) continue;
      for (const r of t.rows) {
        const name = joinName(cell(r, '科目名'));
        const teacherLines = cell(r, '担当者');
        const teacher = teacherLines.join('、');
        const semRaw = cell(r, '学期').join('');
        const cls = cell(r, 'クラス').join('') || null;
        const unitsRaw = cell(r, '単位').join('').normalize('NFKC');
        const remarks = r.remarks.join(' ');
        const where = { src, page: p, title: t.title, name, cls, semRaw };
        if (!name || !semRaw || !teacher) { report.warnings.push({ ...where, why: '빈 칸(과목명·학기·교수 중)', teacher }); continue; }
        if (/休講/.test(teacher + name)) { report.skipped.push({ ...where, why: '本年度休講' }); continue; }
        if (/※\s*5(?![0-9])|※[0-9.]*\.5(?![0-9])/.test(remarks)) { report.skipped.push({ ...where, why: '※5 商学部生は履修できません' }); continue; }
        const sems = semesters(semRaw);
        if (!sems) { report.warnings.push({ ...where, why: `학기 해석 불가: ${semRaw}` }); continue; }
        const credits = /^[0-9]+$/.test(unitsRaw) ? Number(unitsRaw) : null;
        if (credits === null) report.warnings.push({ ...where, why: `단위 해석 불가: "${unitsRaw}"` });
        const slots = [cell(r, '曜日時限①').join(''), cell(r, '曜日時限②').join('')]
          .filter(Boolean).map(slot);
        const good = slots.filter((s) => s.ok);
        const bad = slots.filter((s) => !s.ok);
        if (bad.some((b) => b.raw !== '無')) report.warnings.push({ ...where, why: `요일교시 해석 불가: ${bad.map((b) => b.raw).join(',')}` });
        if (!good.length) {
          report.skipped.push({ ...where, why: /集中/.test(semRaw) ? '集中講義(요일교시 없음)' : `요일교시 없음(${slots.map((s) => s.raw).join(',') || '빈칸'})` });
          continue;
        }
        // 같은 칸이 ①②에 두 번 나오면 1건
        const uniq = [...new Map(good.map((s) => [`${s.day}${s.period}`, s])).values()];
        for (const sem of sems) {
          for (const s of uniq) {
            // 두 PDF의 같은 수업은 표기가 조금 다르다(「Ⅰ」 vs 「I」, 전각 vs 반각) → NFKC로 비교
            const key = [name.normalize('NFKC').replace(/s+/g, ''), cls, sem, s.day, s.period].join('|');
            const prev = byKey.get(key);
            if (prev) {
              const tN = (x) => x.normalize('NFKC').replace(/s+/g, '');
              if (tN(prev.teacher) !== tN(teacher)) {
                report.conflicts.push({ key, why: '교수 다름(먼저 넣은 PDF 값 유지)', teacher: [prev.teacher, teacher], srcs: [prev._src, src] });
              }
              if (prev.credits !== credits && prev.credits !== null) {
                report.conflicts.push({ key, why: '단위 다름 → credits=null', credits: [prev.credits, credits], srcs: [prev._src, src] });
                prev.credits = null; // 커리큘럼마다 단위가 다르다 → 하나로 못 정함
              }
              continue;
            }
            byKey.set(key, {
              id: makeId(name, cls, sem, s.day, s.period),
              name, teacher, day: s.day, period: s.period, semester: sem, year,
              campus: null, courseNumber: null, credits, sourceUrl: null,
              addedBy: 'official', verified: true, createdAt: now,
              _src: src, _page: p, _title: t.title,
            });
          }
        }
      }
    }
  }
}

// id 중복(같은 과목·클래스·학기·칸인데 교수만 다른 경우 등) → 접미사
const courses = [...byKey.values()];
const idCount = new Map();
for (const c of courses) {
  const n = (idCount.get(c.id) ?? 0) + 1;
  idCount.set(c.id, n);
  if (n > 1) { report.warnings.push({ why: 'id 중복 → 접미사', id: c.id, name: c.name, teacher: c.teacher }); c.id = `${c.id}-${n}`; }
}

const strip = ({ _src, _page, _title, ...c }) => c;
fs.mkdirSync(outDir, { recursive: true });
for (const [sem, code] of [['春', '10'], ['秋', '20']]) {
  const list = courses.filter((c) => c.semester === sem).map(strip);
  const f = path.join(outDir, `courses-waseda-${DEPT}-${year}-${code}.json`);
  fs.writeFileSync(f, JSON.stringify(list, null, 1));
  console.log(`${sem}: ${list.length}건 → ${f}`);
}
const cnt = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
report.stats = {
  courses: courses.length,
  bySemester: cnt(courses, (c) => c.semester),
  bySource: cnt(courses, (c) => c._src),
  skippedByReason: cnt(report.skipped, (s) => s.why.replace(/\(.*\)$/, '')),
  warnings: report.warnings.length,
  conflicts: report.conflicts.length,
};
fs.writeFileSync(path.join(outDir, `waseda-${DEPT}-${year}-report.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.stats, null, 1));

// ── 기대값 (2026-10-25 실행, 2026年度 配当表: 2024以降 9/30판 34p + 2023以前 10/19판 26p) ──
// 春 692 + 秋 632 = 1,324건 (2024以降 1,233 + 2023以前 전용 91)
// 제외: 本年度休講 354 / 요일교시 없음(無) 17 / 集中講義 6 / ※5 2 · warnings 0 · conflicts 0
// 요일교시 칸 수: 2024以降 1,234 / 2023以前 1,010 (pdftext 결과를 NFKC 정규식으로 센 값과 같아야 한다)
// 다른 해에 숫자가 크게 다르면 표 구조(열 이름·괘선 그리는 방식)부터 gridtest.mjs로 확인할 것.
