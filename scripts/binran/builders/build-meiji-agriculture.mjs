// 【예시 빌더】 파서 출력(agri-courses.json) → ① docs/data 배당표 JSON  ② src/data 앱 TS
//   node builders/build-meiji-agriculture.mjs
// 다른 학부는 이 파일을 복사해 DEPT_JA / 요건표 회계 규칙(resolveZone) / 메타만 바꾼다.
import fs from 'fs';
const { courses, skipped } = JSON.parse(fs.readFileSync('agri-courses.json', 'utf8'));
const DEPT_JA = { nogaku: '農学科', 'nogei-kagaku': '農芸化学科', 'seimei-kagaku': '生命科学科', 'shokuryo-kankyo': '食料環境政策学科' };

// ---------- ① docs/data 용 JSON (便覧 그대로 보존) ----------
const clean = courses.map((c) => {
  const o = { name: c.name, units: c.units, hours: c.hours, years: c.years, mark: c.mark ?? null, zone: c.zone, kubunJa: c.kubunJa };
  if (c.bunya) o.bunya = c.bunya;
  o.scope = c.gakka === 'common' ? 'common' : c.gakka;
  if (c.biko) o.biko = c.biko;
  if (/（交換留学生/.test(c.name)) o.exchangeOnly = true;
  if (/メディア授業科目併設/.test(c.biko || '')) o.media = true;
  return o;
});
const pool = {};
for (const c of clean) {
  const k = c.scope + '|' + c.zone;
  pool[k] = pool[k] || { courses: 0, units: 0, required: 0, selectRequired: 0 };
  pool[k].courses++; pool[k].units += (+c.units || 0);
  if (c.mark === '必修') pool[k].required += (+c.units || 0);
  if (c.mark === '選択必修') pool[k].selectRequired += (+c.units || 0);
}
const json = {
  _meta: {
    source: '明治大学 2026年度 農学部便覧「Ⅴ 農学部設置科目一覧及び履修上の注意事項」',
    sourceUrl: 'https://www.meiji.ac.jp/agri/student/6t5h7p00000gpn31-att/nouhandbook2026.pdf',
    extractedAt: new Date().toISOString().slice(0, 10),
    tool: 'scripts/binran/parsers/parse-meiji-agriculture.mjs',
    faculty: 'agriculture', facultyNameJa: '農学部', schoolDomain: 'meiji.ac.jp', admissionYear: 2026,
    requirementMaster: 'meiji-agriculture-2026.json',
    verification: '(docs/DATA-MANUAL.md §6 체크리스트 결과를 여기에 적는다: 必修 합계가 요건표·별표1과 일치하는지 등)',
    skippedRows: skipped.length,
  },
  departments: Object.entries(DEPT_JA).map(([id, nameJa]) => ({ id, nameJa })),
  poolSummary: pool,
  courses: clean,
};
fs.writeFileSync('meiji-agriculture-allocation-2026.json', JSON.stringify(json, null, 1));

// ---------- ② src/data 용 TS (앱 CAN) ----------
// 요건표의 회계 규칙에 맞춰 zone을 해결한다. 최저단위 0인 구분은 AGRICULTURE_CAN_EXTRA_ZONES로 표시만.
const ZONE_JA = { sotsuron: '卒論関係科目群', senko3: '専攻科目Ⅲ（教職関係）' };
function resolveZone(c, dep) {
  if (c.zone === 'ryugaku-nintei') return null;                        // 留学認定枠: CAN에 안 냄
  if (c.zone === 'sotsuron' && dep === 'nogei-kagaku') return 'senko'; // 요건표 ※1: 農芸化学만 専攻에 가산
  return c.zone;
}
const MARK = { '必修': '"必修"', '選択必修': '"選必"' };
const esc = (s) => JSON.stringify(s);
const L = [];
L.push('// 農学部 科目配当表（総合教育科目＋各学科専門科目）。');
L.push('// 出典: 2026年度 農学部便覧（公開PDF）Ⅴ 農学部設置科目一覧。抽出JSON: docs/data/meiji-agriculture-allocation-2026.json。');
L.push('// 交換留学生専用科目・大学院先取履修科目・留学認定枠は除外（正規生の卒業要件CAN用）。');
L.push('import type { AllocCourse } from "./allocationInterdisciplinaryMath";');
L.push('');
L.push('export const AGRICULTURE_ALLOCATION: Record<string, AllocCourse[]> = {');
const extra = {};
for (const [dep, nameJa] of Object.entries(DEPT_JA)) {
  const list = clean.filter((c) => !c.exchangeOnly && (c.scope === 'common' || c.scope === dep))
    .map((c) => ({ ...c, z: resolveZone(c, dep) })).filter((c) => c.z);
  extra[dep] = [...new Set(list.map((c) => c.z))].filter((z) => ZONE_JA[z]);
  L.push(`  // ${nameJa}（共通${list.filter((c) => c.scope === 'common').length} + 専門${list.filter((c) => c.scope !== 'common').length}）`);
  L.push(`  ${esc(dep)}: [`);
  for (const c of list) {
    const parts = [`name: ${esc(c.name)}`, `units: ${typeof c.units === 'number' ? c.units : 0}`,
      `mark: ${c.mark ? MARK[c.mark] : 'null'}`, `years: [${c.years.join(', ')}]`, `zone: ${esc(c.z)}`];
    if (c.media) parts.push('media: true');
    L.push(`    { ${parts.join(', ')} },`);
  }
  L.push('  ],');
}
L.push('};');
L.push('');
L.push('// 要件マスターに無い（最低単位0の）区分。CANの表示順の末尾に足すため学科別に持つ。');
L.push('export const AGRICULTURE_CAN_EXTRA_ZONES: Record<string, { id: string; nameJa: string }[]> = {');
for (const dep of Object.keys(DEPT_JA)) L.push(`  ${esc(dep)}: [${extra[dep].map((z) => `{ id: ${esc(z)}, nameJa: ${esc(ZONE_JA[z])} }`).join(', ')}],`);
L.push('};');
L.push('');
fs.writeFileSync('allocationAgriculture.ts', L.join('\n'));
console.log('wrote meiji-agriculture-allocation-2026.json (' + clean.length + ') + allocationAgriculture.ts');
console.log('→ 각각 docs/data/ 와 src/data/ 로 복사한 뒤 §7(풀≥최저단위 검증) → §8(앱 연동) 진행');
