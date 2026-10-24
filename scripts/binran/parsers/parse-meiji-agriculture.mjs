// 【예시 파서 ①】 明治 農学部便覧 「Ⅴ 農学部設置科目一覧」 → 과목 JSON
//   node parsers/parse-meiji-agriculture.mjs <便覧.pdf>   → agri-courses.json
// 표 형식: 科目名 | 単位数 | 時間数 | 履修可能年次(1~4年次 ○) | 備考 — ○는 x좌표 bin으로 학년 판정.
// 다른 학부/학교는 이 파일을 복사해 X_* 상수와 ZONE/DEPT 표만 바꾼다 (docs/DATA-MANUAL.md §5).
import fs from 'fs';
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const X_NAME = [108, 300], X_UNITS = [300, 332], X_HOURS = [332, 356];
const YEAR_BINS = [[356, 388, 1], [388, 419, 2], [419, 450, 3], [450, 482, 4]];
const X_BIKO = 482, X_HEADER_MAX = 112, X_MARK = [96, 108];

// 便覧의 科目群 → 요건 마스터(meiji-agriculture-2026.json)의 zone id
const ZONE = {
  '教養科目群': 'kyoyo', '共通専門科目群': 'kyotsu-senmon', '外国語科目群': 'gaikokugo',
  '保健・体育科目群': 'hoken', '総合教育ゼミナール': 'sogo-zemi',
  '基礎科目群': 'kiso', '専攻科目群': 'senko', '卒論関係科目群': 'sotsuron',
  '専攻科目Ⅰ': 'senko1', '専攻科目Ⅱ': 'senko2', '専攻科目Ⅲ': 'senko3',
  '留学認定科目': 'ryugaku-nintei',
};
const DEPT = {
  '農学科': 'nogaku', '農芸化学科': 'nogei-kagaku',
  '生命科学科': 'seimei-kagaku', '食料環境政策学科': 'shokuryo-kankyo',
};

const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(process.argv[2] ?? 'agri-binran-2026.pdf')),
  useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist/cmaps/', cMapPacked: true,
}).promise;

let dept = null, zone = null, zoneJa = null, bunya = null, inTable = false;
const courses = [], skipped = [];

for (let p = 1; p <= doc.numPages; p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  const rows = new Map();
  for (const it of tc.items) {
    if (!it.str) continue;
    // 이 便覧은 단어 구분자로 제어문자 U+0007을 쓴다. 공백으로 정규화하지 않으면 "Agri-FoodScience"가 된다.
    const raw = it.str.replace(/[\u0000-\u001F]/g, ' ');
    const y = Math.round(it.transform[5] * 2) / 2;
    let key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2.5);
    if (key == null) { key = y; rows.set(key, []); }
    rows.get(key).push({ x: +it.transform[4].toFixed(1), w: it.width || 0, s: raw.trim(), raw });
  }

  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const items = rows.get(y).sort((a, b) => a.x - b.x).filter((i) => i.s || i.raw);
    const solid = items.filter((i) => i.s);
    if (!solid.length) continue;
    const text = solid.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();

    // ---- 상태 전이 ----
    const dm = text.match(/^[⑴-⑼]\s*(農学科|農芸化学科|生命科学科|食料環境政策学科)専門科目一覧/);
    if (dm) { dept = DEPT[dm[1]]; inTable = true; zone = null; bunya = null; continue; }
    if (/総合教育科目一覧/.test(text)) { dept = 'common'; inTable = true; zone = null; bunya = null; continue; }
    if (/大学院農学研究科設置科目|履修上の注意事項|カリキュラムツリー|履修モデル|教育目標|カリキュラムの特徴|カリキュラムの概要/.test(text)) {
      inTable = false; continue;
    }

    const head = solid.filter((i) => i.x < X_HEADER_MAX).map((i) => i.s).join('');
    if (solid.every((i) => i.x < 300)) {
      if (ZONE[head]) { zone = ZONE[head]; zoneJa = head; bunya = null; continue; }
      const bm = head.match(/^＜(.+)＞$/);
      if (bm) { bunya = bm[1]; continue; }
      continue;
    }
    if (!inTable || !zone) continue;

    // ---- 과목 행 ----
    const unitsIt = solid.find((i) => i.x >= X_UNITS[0] && i.x < X_UNITS[1]);
    const hoursIt = solid.find((i) => i.x >= X_HOURS[0] && i.x < X_HOURS[1]);
    if (!unitsIt || !hoursIt) continue;
    const unitsRaw = solid.filter((i) => i.x >= X_UNITS[0] && i.x < X_UNITS[1]).map((i) => i.s).join('');
    if (!/^\d/.test(unitsRaw) || !/^\d+$/.test(hoursIt.s)) { skipped.push({ p, text }); continue; }

    // 과목명: 폭0/공백 아이템이 단어 경계 → 라틴 문자 사이에만 공백 복원
    const nameParts = items.filter((i) => i.x >= X_NAME[0] && i.x < X_NAME[1]);
    let name = '', pendingSep = false;
    for (const cur of nameParts) {
      if (!cur.s) { pendingSep = true; continue; }
      const latinJoin = /[A-Za-z0-9)\]]$/.test(name) && /^[A-Za-z0-9(\[]/.test(cur.raw);
      if (pendingSep && latinJoin) name += ' ';
      pendingSep = false;
      name += cur.raw;
    }
    name = name.replace(/[ \t　]+/g, ' ').replace(/\s*：\s*/g, '：').trim();
    if (!name) { skipped.push({ p, text }); continue; }

    const markRaw = solid.filter((i) => i.x >= X_MARK[0] && i.x < X_MARK[1]).map((i) => i.s).join('');
    const mark = /●/.test(markRaw) ? '必修' : /△/.test(markRaw) ? '選択必修' : null;

    const years = [];
    for (const i of solid) {
      if (!/^[〇○]$/.test(i.s)) continue;
      const b = YEAR_BINS.find(([a, z]) => i.x >= a && i.x < z);
      if (b) years.push(b[2]);
    }
    const biko = solid.filter((i) => i.x >= X_BIKO).map((i) => i.s).join('').replace(/\s+/g, ' ').trim();
    const units = /または/.test(unitsRaw) ? unitsRaw : Number(unitsRaw);

    courses.push({
      name, units, hours: Number(hoursIt.s), years: [...new Set(years)].sort(),
      ...(mark ? { mark } : {}), zone, kubunJa: zoneJa, ...(bunya ? { bunya } : {}),
      gakka: dept, ...(biko ? { biko } : {}), page: p,
    });
  }
}

fs.writeFileSync('agri-courses.json', JSON.stringify({ courses, skipped }, null, 1));
console.log('courses:', courses.length, '/ skipped:', skipped.length);
console.log('必修:', courses.filter((c) => c.mark === '必修').length,
            '選択必修:', courses.filter((c) => c.mark === '選択必修').length,
            '配当年次なし:', courses.filter((c) => c.years.length === 0).length);
// 기대값(2026便覧): courses 429 / skipped 8(전부 표 헤더 조각) / 必修 46 / 選択必修 19 / 配当年次なし 0
