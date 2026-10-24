// 【예시 파서 ④ — HTML】 法政大学 「卒業要件（卒業所要単位）」 공개 페이지 → 전 학부 전사
//   1) curl로 HTML 저장 → 2) scripts/binran/strip-html.mjs 로 텍스트화 → 3) 이 스크립트
//   node parsers/parse-hosei-all-faculties.mjs hosei.txt   → hosei-all.json
// 형식: <학부/학과 견출> → "卒業所要単位(数)は◯◯単位で、…" → "<区分> <数>単位(以上|以下)" 반복
// ⚠️ 「（但し、…N単位以上）」 보충행이 숫자를 품고 있어 먼저 걸러야 한다(안 그러면 그 학과의 구분이 끊긴다).
import fs from 'fs';

const txt = fs.readFileSync(process.argv[2] ?? 'hosei.txt', 'utf8').split(/\r?\n/);
const start = txt.findIndex((l) => /学部の卒業所要単位数は法政大学大学学則により規定/.test(l));
const lines = txt.slice(start + 1);
const ZEN = (s) => s.replace(/[０-９]/g, (c) => String('０１２３４５６７８９'.indexOf(c)));
const entries = [];
let pendingName = null, section = '一般';

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i].replace(/[　]/g, ' ').trim();
  if (!raw) continue;
  if (/^SSI卒業所要単位$/.test(raw)) { section = 'SSI'; pendingName = null; continue; }
  if (/^GBP・SCOPE・IGESS卒業所要単位$/.test(raw)) { section = 'GBP/SCOPE/IGESS'; pendingName = null; continue; }
  if (/^卒業所要単位$/.test(raw)) { section = '一般'; pendingName = null; continue; }

  const tot = ZEN(raw).match(/卒業所要単位(?:数)?は\s*(\d+)\s*単位/);
  if (tot) {
    const zones = [];
    for (let j = i + 1; j < lines.length; j++) {
      const r = ZEN(lines[j].replace(/[　]/g, ' ').trim());
      if (!r) continue;
      if (/卒業所要単位(?:数)?は/.test(r)) break;
      if (/^[（(]/.test(r) || /^但し|^ただし/.test(r)) continue;   // 보충행(숫자 포함)은 먼저 제외
      const m = r.match(/^(.+?)\s*(\d+)\s*単位(以上|以下)?/);
      if (!m) { if (/含む/.test(r)) continue; break; }
      const name = m[1].replace(/\s+/g, '').replace(/[（(].*$/, '');
      if (!name || name.length > 24) break;
      zones.push({ nameJa: name, units: Number(m[2]), bound: m[3] ?? 'exact', noteJa: /[（(]/.test(r) ? r : undefined });
    }
    entries.push({ name: pendingName, section, totalRequired: Number(tot[1]), zones, note: raw });
    pendingName = null;
    continue;
  }
  if (/学部|学科|GIS|RSP|SSI/.test(raw) && raw.length <= 40 && !/単位|但し|ただし|含む|選択|科目$/.test(raw)) pendingName = raw;
}

fs.writeFileSync('hosei-all.json', JSON.stringify(entries, null, 1));
console.log('entries:', entries.length);
for (const e of entries) {
  const lo = e.zones.reduce((a, z) => a + (z.bound === '以下' ? 0 : z.units), 0);
  const hi = e.zones.reduce((a, z) => a + z.units, 0);
  console.log((e.section + ' / ' + (e.name ?? '?')).padEnd(42), 'total', String(e.totalRequired).padStart(3),
    '| zones', e.zones.length, '| 下限合計', String(lo).padStart(3), '| 上限込', String(hi).padStart(3),
    lo === e.totalRequired ? '✓' : hi === e.totalRequired ? '△caps' : '—');
}
// 기대값(2026-10): 39 entries. 합계가 안 맞는 학부가 많은 건 「以上」 적립식 구조라서 정상 → sumCheck로 분류만.
