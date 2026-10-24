// 【예시 파서 ③】 明治大学学則＜別表１＞ 학부별 PDF의 「授業科目一覧」 → 과목 JSON
//   node parsers/parse-beppyo1-courselist.mjs <별표1.pdf> <out.json>
// 便覧이 비공개인 학부(理工·情コミ)의 대체 출처. 과목명·単位·科目群·○△마크는 있지만
// ⚠️ 配当年次가 없다 → 앱 CAN(학년 필터)에는 못 쓰고 과목→科目群 사전으로만 쓴다.
import fs from 'fs';
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const X_HEADER_MAX = 78;   // 科目群 견출(좌단)
const X_NAME = [74, 380];
const X_UNITS = [380, 430];
const X_BIKO = 430;
const ZEN = { '０': 0, '１': 1, '２': 2, '３': 3, '４': 4, '５': 5, '６': 6, '７': 7, '８': 8, '９': 9 };
const num = (s) => { const t = s.replace(/[０-９]/g, (c) => String(ZEN[c])); return /^\d+$/.test(t) ? Number(t) : null; };

const file = process.argv[2], outName = process.argv[3] ?? 'beppyo-courses.json';
const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(file)),
  useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist/cmaps/', cMapPacked: true,
}).promise;

let group = null, subgroup = null, section = null, done = false;
const courses = [], skipped = [], groups = new Set();

for (let p = 1; p <= doc.numPages && !done; p++) {
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
    const text = items.map((i) => i.s).join('');
    if (/^卒業要件$/.test(text)) { done = true; break; }   // 조문에 들어가면 종료
    if (/^授業科目|単位数|^備考$/.test(text) && items.length <= 3) continue;

    const unitsIt = items.find((i) => i.x >= X_UNITS[0] && i.x < X_UNITS[1] && num(i.s) != null);
    if (!unitsIt) {
      const head = items.filter((i) => i.x < 200).map((i) => i.s).join('').trim();
      if (!head || /（.*印は/.test(head)) continue;
      // 학과/전공 견출은 x와 무관하게 먼저 판정 (理工의 機械情報工学科가 x 차이로 누락됐던 함정)
      if (/^各学科共通$|^[^ ]{2,12}学科$|^（.+専攻）$/.test(head)) { section = head.replace(/^（|）$/g, ''); subgroup = null; continue; }
      const lead = items[0].x;
      if (lead < X_HEADER_MAX) {
        if (/科目群$|科目$|群$/.test(head)) { group = head; subgroup = null; groups.add(head); }
      } else if (lead < 95) { subgroup = head; }
      continue;
    }

    let name = items.filter((i) => i.x >= X_NAME[0] && i.x < X_NAME[1]).map((i) => i.raw).join('')
      .replace(/[ \t　]+/g, ' ').trim();
    const mark = /^[○〇]/.test(name) ? '必修' : /^△/.test(name) ? '選択必修' : null;
    name = name.replace(/^[○〇△▲]/, '').trim();
    if (!name) { skipped.push({ p, text }); continue; }
    const biko = items.filter((i) => i.x >= X_BIKO).map((i) => i.s).join('').trim();

    courses.push({
      name, units: num(unitsIt.s), mark, kubunJa: group,
      ...(subgroup ? { bunya: subgroup } : {}), ...(section ? { section } : {}),
      ...(biko ? { biko } : {}), page: p,
    });
  }
}

fs.writeFileSync(outName, JSON.stringify({ courses, skipped, groups: [...groups] }, null, 1));
console.log(outName, '→ courses:', courses.length, '/ skipped:', skipped.length);
const by = {};
for (const c of courses) { const k = (c.section ?? '-') + ' | ' + (c.kubunJa ?? '?'); by[k] = (by[k] || 0) + 1; }
for (const [k, v] of Object.entries(by)) console.log('  ', k, '=>', v);
// 기대값: 理工 1268과목(各学科共通 93 + 9학과·전공 각 123~136) / 情コミ 337과목(必修 2)
