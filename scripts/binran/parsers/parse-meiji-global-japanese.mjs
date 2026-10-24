// 【예시 파서 ②】 明治 国際日本学部便覧 「3．国際日本学部授業科目配当表」 → 과목 JSON
//   node parsers/parse-meiji-global-japanese.mjs <便覧.pdf>   → gjs-courses.json
// 특징: 필수/선택필수 마크가 「日本人学生」「外国人留学生」 2열로 갈린다 → 트랙별 mark를 따로 보존.
//       配当学年은 "1" / "3・4" / "1～4" 같은 텍스트 → 숫자 배열로 전개.
import fs from 'fs';
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const X_NAME = [90, 262];
const X_MARK_JP = [262, 300];    // 日本人学生
const X_MARK_RYU = [300, 345];   // 外国人留学生
const X_UNITS = [345, 380];
const X_HOURS = [380, 430];
const X_GRADE = [430, 470];
const X_BIKO = 470;

// 便覧 구분 → 요건 마스터(meiji-global-japanese-2026.json)의 track zone id
const TOP = {
  '外国語科目': null,             // 서브 구분(英語/第二外国語)으로 결정
  '日本語科目': 'gakujutsu-nihongo',
  '国際日本学専門科目': 'senmon',
  '総合教育科目': 'sogo-kyoiku',   // mark로 必修/選択必修 분기 (빌더에서)
  '演習科目': 'jiyu',
  '海外留学認定科目': 'jiyu',
  '大学院国際日本学研究科設置科目': null, // 卒業要件外 → 제외
};
const SUB = { '英語': 'eigo', '第二外国語': 'daini-gaikokugo-jiyu' };
const RESEARCH_AREA = /研究領域$/;

const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(process.argv[2] ?? 'gjs-binran-2026.pdf')),
  useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist/cmaps/', cMapPacked: true,
}).promise;

const FROM = Number(process.argv[3] ?? 28), TO = Number(process.argv[4] ?? 36); // 2026便覧의 配当表 페이지
let top = null, zone = null, area = null;
const courses = [], skipped = [];

for (let p = FROM; p <= TO; p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  const rows = new Map();
  for (const it of tc.items) {
    if (!it.str) continue;
    const raw = it.str.replace(/[\u0000-\u001F]/g, ' ');
    if (!raw.trim()) continue;
    const y = Math.round(it.transform[5] * 2) / 2;
    let k = [...rows.keys()].find((q) => Math.abs(q - y) <= 2.5);
    if (k == null) { k = y; rows.set(k, []); }
    rows.get(k).push({ x: +it.transform[4].toFixed(1), s: raw.trim(), raw });
  }

  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const items = rows.get(y).sort((a, b) => a.x - b.x);
    const unitsIt = items.find((i) => i.x >= X_UNITS[0] && i.x < X_UNITS[1] && /^\d+$/.test(i.s));

    if (!unitsIt) {
      const txt = items.filter((i) => i.x < X_MARK_JP[0]).map((i) => i.s).join('').trim();
      if (!txt) continue;
      if (TOP[txt] !== undefined) { top = txt; zone = TOP[txt]; area = null; continue; }
      if (SUB[txt] !== undefined && top === '外国語科目') { zone = SUB[txt]; area = txt; continue; }
      if (RESEARCH_AREA.test(txt) && top === '国際日本学専門科目') { area = txt; continue; }
      continue;
    }
    if (!zone) { skipped.push({ p, text: items.map((i) => i.s).join('') }); continue; }

    const name = items.filter((i) => i.x >= X_NAME[0] && i.x < X_NAME[1]).map((i) => i.raw).join('')
      .replace(/[ \t　]+/g, ' ').trim();
    if (!name) { skipped.push({ p, text: items.map((i) => i.s).join('') }); continue; }

    const mk = (lo, hi) => {
      const s = items.filter((i) => i.x >= lo && i.x < hi).map((i) => i.s).join('');
      return /[○〇]/.test(s) ? '必修' : /△/.test(s) ? '選択必修' : null;
    };
    const hoursIt = items.find((i) => i.x >= X_HOURS[0] && i.x < X_HOURS[1] && /^\d+$/.test(i.s));
    const gradeIt = items.filter((i) => i.x >= X_GRADE[0] && i.x < X_GRADE[1]).map((i) => i.s).join('');
    let years = [];
    if (gradeIt) {
      const m = gradeIt.match(/^(\d)\s*[～~]\s*(\d)$/);
      if (m) { for (let n = +m[1]; n <= +m[2]; n++) years.push(n); }
      else years = (gradeIt.match(/\d/g) || []).map(Number);
    }
    const biko = items.filter((i) => i.x >= X_BIKO).map((i) => i.s).join('').trim();

    courses.push({
      name, units: Number(unitsIt.s), hours: hoursIt ? Number(hoursIt.s) : null,
      gradeRaw: gradeIt || null, years: [...new Set(years)].sort(),
      markDomestic: mk(X_MARK_JP[0], X_MARK_JP[1]), markRyugakusei: mk(X_MARK_RYU[0], X_MARK_RYU[1]),
      zone, kubunJa: top, ...(area ? { area } : {}), ...(biko ? { biko } : {}), page: p,
    });
  }
}

fs.writeFileSync('gjs-courses.json', JSON.stringify({ courses, skipped }, null, 1));
const su = (f) => courses.filter(f).reduce((a, c) => a + c.units, 0);
console.log('courses:', courses.length, '/ skipped:', skipped.length);
console.log('日本人 必修', su((c) => c.markDomestic === '必修'), '/ 留学生 必修', su((c) => c.markRyugakusei === '必修'));
// 기대값(2026便覧): courses 347 / skipped 2 / 日本人 必修 27 / 留学生 必修 11 (= 요건 마스터의 必修 합과 일치해야 함)
