// PDF 한 페이지를 PNG로 렌더. 병합셀·중괄호·○표 등 텍스트로 판별 안 되는 건 반드시 이걸로 눈으로 본다.
//   node render.mjs <pdf> <page> [scale=2.5] <out.png>
// ⚠️ pdfjs-dist v4 + @napi-rs/canvas 조합은 ctx.fill(Path2D)에서 깨진다 → v3(alias pdfjs-dist-v3)를 쓴다.
// ⚠️ cMapUrl 없이 렌더하면 글자 없이 罫線만 그려진다(래스터로 오진).
import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
const pdfjs = await import('pdfjs-dist-v3/legacy/build/pdf.js');

const [file, pageNo, scaleArg, out] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({
  data, useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist-v3/cmaps/', cMapPacked: true,
}).promise;
const page = await doc.getPage(Number(pageNo));
const vp = page.getViewport({ scale: Number(scaleArg || 2.5) });
const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: ctx, viewport: vp }).promise;
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out, canvas.width + 'x' + canvas.height);
