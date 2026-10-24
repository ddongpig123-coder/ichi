// PDF → 행 단위 텍스트 덤프. 같은 y(±1.5pt)의 글자를 한 줄로 묶고 x순으로 이어 붙인다.
//   node pdftext.mjs <pdf> [fromPage] [toPage]  > out.txt
// ⚠️ cMapUrl 은 반드시 **상대 FS 경로**. file:// URL을 주면 CID 폰트(대부분의 일본 便覧)가
//    통째로 비어 "래스터 PDF"로 오진하게 된다. (docs/DATA-MANUAL.md §9-1)
// ⚠️ 일부 便覧은 단어 구분자로 제어문자(U+0007)를 쓴다 → 공백으로 정규화. (§9-2)
import fs from 'fs';
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await getDocument({
  data, useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist/cmaps/', cMapPacked: true,
}).promise;
const from = Number(process.argv[3] || 1), to = Number(process.argv[4] || doc.numPages);
console.log('numPages', doc.numPages);

for (let p = from; p <= Math.min(to, doc.numPages); p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  const rows = new Map();
  for (const it of tc.items) {
    const s = (it.str ?? '').replace(/[\u0000-\u001F]/g, ' ');
    if (!s.trim()) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push([it.transform[4], s]);
  }
  console.log(`\n===== PAGE ${p} =====`);
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const line = rows.get(y).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' ').replace(/\s+/g, ' ').trim();
    if (line) console.log(line);
  }
}
