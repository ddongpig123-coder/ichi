// PDF 한 페이지를 PNG로 렌더. 병합셀·중괄호·○표 등 텍스트로 판별 안 되는 건 반드시 이걸로 눈으로 본다.
//   node render.mjs <pdf> <page> [scale=2.5] <out.png>
// ⚠️ pdfjs-dist v4 + @napi-rs/canvas 조합은 ctx.fill(Path2D)에서 깨진다 → v3(alias pdfjs-dist-v3)를 쓴다.
// ⚠️ cMapUrl 없이 렌더하면 글자 없이 罫線만 그려진다(래스터로 오진).
// ⚠️ pdfjs v3는 이미지·마스크가 있는 쪽에서 임시 캔버스를 만들 때 node-canvas(`canvas` 패키지)를 찾는다.
//    `canvas`는 Windows·최신 Node에서 설치가 안 되므로, 이미 쓰는 @napi-rs/canvas로 만든 생성기를 넘긴다.
//    (上智 履修要覧처럼 이미지가 든 PDF에서 "Cannot find module 'canvas'"로 죽던 문제, DATA-MANUAL §9-20)
import fs from 'fs';
import { createCanvas, DOMMatrix } from '@napi-rs/canvas';

// pdfjs가 모듈 로드 시 require('canvas')로 채우려는 전역. 미리 채워 두면 그 시도를 건너뛴다.
if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
const pdfjs = await import('pdfjs-dist-v3/legacy/build/pdf.js');

// pdfjs BaseCanvasFactory와 같은 모양(create/reset/destroy)
class NapiCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(Math.max(1, width), Math.max(1, height));
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(entry, width, height) {
    entry.canvas.width = Math.max(1, width);
    entry.canvas.height = Math.max(1, height);
  }
  destroy(entry) {
    entry.canvas.width = 0;
    entry.canvas.height = 0;
    entry.canvas = null;
    entry.context = null;
  }
}

const [file, pageNo, scaleArg, out] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(file));
const canvasFactory = new NapiCanvasFactory();
const doc = await pdfjs.getDocument({
  data, useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist-v3/cmaps/', cMapPacked: true,
  canvasFactory,
}).promise;
const page = await doc.getPage(Number(pageNo));
const vp = page.getViewport({ scale: Number(scaleArg || 2.5) });
const { canvas, context: ctx } = canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: ctx, viewport: vp, canvasFactory }).promise;
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out, canvas.width + 'x' + canvas.height);
