// 한 페이지의 모든 텍스트 아이템을 좌표(y, x, 폭)와 함께 덤프. 표의 열 경계(x)를 정할 때 쓴다.
//   node rawxy.mjs <pdf> <page>
// 출력 1줄 = 1아이템: y=… x=… w=… <텍스트>   (y 내림차순 = 페이지 위→아래)
import fs from 'fs';
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(process.argv[2])),
  useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist/cmaps/', cMapPacked: true,
}).promise;
const page = await doc.getPage(Number(process.argv[3]));
const tc = await page.getTextContent();
const items = tc.items
  .filter((i) => i.str && i.str.trim())
  .map((i) => ({ x: +i.transform[4].toFixed(1), y: +i.transform[5].toFixed(1), w: +(i.width || 0).toFixed(1), s: i.str.trim() }))
  .sort((a, b) => b.y - a.y || a.x - b.x);
for (const i of items) console.log(`y=${i.y}\tx=${i.x}\tw=${i.w}\t${i.s}`);
