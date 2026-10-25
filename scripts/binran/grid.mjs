// 괘선(가로·세로줄) 기반 표 복원 모듈. 병합 셀이 많은 배당표용.
//
// 텍스트 좌표만으로 열을 나누면(§9 함정) 병합 셀 값이 어느 행에 속하는지 추측해야 한다.
// 이 모듈은 PDF에 그려진 괘선으로 칸을 그대로 복원하므로 추측이 없다:
//   1) 헤더 글자(기본 "科目名")를 찾고, 그 높이를 가로지르는 세로줄 = 열 경계
//   2) 열마다 그 열을 가로지르는 가로줄 = 그 열의 칸 경계 (병합 셀은 가로줄이 없다)
//   3) 모든 열의 칸 경계를 합친 것 = 최소 행. 각 행의 각 열 값 = 그 행을 포함하는 칸의 글자
// 사용 예: parsers/parse-waseda-commerce-haitou.mjs
import fs from 'fs';

let pdfjs;
async function lib() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

// cMapUrl은 상대 경로여야 한다(§9: file:// URL이면 일본어가 빈 문자열로 나옴). scripts/binran에서 실행할 것.
export async function openPdf(path) {
  const { getDocument } = await lib();
  return getDocument({
    data: new Uint8Array(fs.readFileSync(path)),
    useSystemFonts: true, cMapUrl: './node_modules/pdfjs-dist/cmaps/', cMapPacked: true,
  }).promise;
}

// 텍스트 아이템. U+0007 등 제어문자는 공백으로(§9 함정).
export async function pageItems(page) {
  const tc = await page.getTextContent();
  return tc.items
    .map((i) => ({
      s: i.str.replace(/[\u0000-\u001f]/g, ' ').trim(),
      x: i.transform[4], y: i.transform[5], w: i.width || 0,
      h: Math.abs(i.transform[3]) || i.height || 7,
    }))
    .filter((i) => i.s);
}

// 괘선. H={y,a:x1,b:x2} V={x,a:y1,b:y2}
// 경로는 하위 도형(moveTo…closePath / rectangle) 단위로 모은 뒤, 다음에 오는 그리기 연산으로 확정한다.
//  - 긋기(stroke): 도형의 수평·수직 변이 전부 괘선
//  - 칠하기(fill)만: 얇은 도형(두께 1.5pt 이하)만 괘선. 큰 도형은 칸 배경색이다.
//    早稲田 商 配当表는 괘선 자체를 '얇은 사각형 칠하기'로 그리고, 秋 행의 주황 배경도 같은 방식으로
//    칠한다. 배경은 병합 셀 안에서도 행마다 따로 칠해져 있어 테두리로 읽으면 병합 셀이 쪼개진다(§9).
export async function pageSegments(page) {
  const { OPS } = await lib();
  const ol = await page.getOperatorList();
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const H = [], V = [];
  const TH = 1.5;
  let subs = []; // 하위 도형들: 변환된 점 배열
  const edges = (pts) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      if (Math.abs(ay - by) < 0.5 && Math.abs(ax - bx) > 0.5) H.push({ y: (ay + by) / 2, a: Math.min(ax, bx), b: Math.max(ax, bx) });
      else if (Math.abs(ax - bx) < 0.5 && Math.abs(ay - by) > 0.5) V.push({ x: (ax + bx) / 2, a: Math.min(ay, by), b: Math.max(ay, by) });
    }
  };
  const thinLine = (pts) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
    if (y2 - y1 <= TH && x2 - x1 > TH) H.push({ y: (y1 + y2) / 2, a: x1, b: x2 });
    else if (x2 - x1 <= TH && y2 - y1 > TH) V.push({ x: (x1 + x2) / 2, a: y1, b: y2 });
  };
  const STROKES = [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke];
  const FILLS = [OPS.fill, OPS.eoFill];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], args = ol.argsArray[i];
    if (STROKES.includes(fn)) { for (const p of subs) { edges(p); thinLine(p); } subs = []; continue; }
    if (FILLS.includes(fn)) { for (const p of subs) thinLine(p); subs = []; continue; }
    if (fn === OPS.endPath) { subs = []; continue; } // 클리핑 경로
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.constructPath) {
      const [ops, coords] = args;
      let c = 0, cur = null;
      const P = (x, y) => ap(ctm, x, y);
      for (const op of ops) {
        if (op === OPS.rectangle) {
          const [x, y, w, h] = coords.slice(c, c + 4); c += 4;
          subs.push([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h), P(x, y)]);
          cur = null;
        } else if (op === OPS.moveTo) { cur = [P(coords[c], coords[c + 1])]; subs.push(cur); c += 2; }
        else if (op === OPS.lineTo) { if (!cur) { cur = []; subs.push(cur); } cur.push(P(coords[c], coords[c + 1])); c += 2; }
        else if (op === OPS.curveTo) { if (cur) cur.push(P(coords[c + 4], coords[c + 5])); c += 6; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { if (cur) cur.push(P(coords[c + 2], coords[c + 3])); c += 4; }
        else if (op === OPS.closePath) { if (cur && cur.length) cur.push(cur[0]); }
      }
    }
  }
  return { H, V };
}

// 가까운 값(이중선 등)을 하나로 합친다. 내림차순 반환.
function mergeVals(vals, tol = 1.5) {
  const s = [...vals].sort((a, b) => b - a);
  const out = [];
  for (const v of s) {
    if (out.length && Math.abs(out[out.length - 1].last - v) <= tol) out[out.length - 1].last = v;
    else out.push({ first: v, last: v });
  }
  return out.map((g) => (g.first + g.last) / 2);
}
const mergeAsc = (vals, tol = 1.5) => mergeVals(vals, tol).reverse();

// 글자 1개의 세로 중심(기준선 + 글자 높이의 약 1/3)
const midY = (it) => it.y + it.h * 0.35;
const midX = (it) => it.x + it.w / 2;

// 칸 안의 글자 → 줄 배열. 같은 줄 안에서는 간격이 있으면 공백으로 잇는다.
export function cellLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const ln = lines.find((l) => Math.abs(l.y - it.y) < 2);
    if (ln) ln.items.push(it); else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => {
    const its = l.items.sort((a, b) => a.x - b.x);
    let s = '';
    for (let k = 0; k < its.length; k++) {
      if (k > 0) {
        const gap = its[k].x - (its[k - 1].x + its[k - 1].w);
        s += gap > 1 ? ' ' : '';
      }
      s += its[k].s;
    }
    return s.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

// 페이지 안의 표들. 각 표 = { headerTop, headerBottom, bottom, right, columns:[{label,x1,x2}], rows:[...], title, outside }
//   row = { top, bottom, cells: { [label]: { id, lines } }, remarks: string[] }
//   outside = 표 오른쪽 바깥(備考 등) 글자를 행에 붙인 것 → row.remarks
export function extractTables(items, segs, { headerKey = '科目名' } = {}) {
  const { H, V } = segs;
  const coversX = (s, x) => s.a <= x + 0.5 && s.b >= x - 0.5;
  const coversY = (s, y) => s.a <= y + 0.5 && s.b >= y - 0.5;
  const hBoundsAt = (x) => mergeVals(H.filter((s) => coversX(s, x)).map((s) => s.y));

  const tables = [];
  for (const hk of items.filter((i) => i.s === headerKey)) {
    const hy = midY(hk), hx = midX(hk);
    const hb = hBoundsAt(hx);
    const above = hb.filter((y) => y > hy), below = hb.filter((y) => y < hy);
    if (!above.length || !below.length) continue;
    const headerTop = Math.min(...above), headerBottom = Math.max(...below);
    const headerMid = (headerTop + headerBottom) / 2;
    const vs = V.filter((s) => coversY(s, headerMid));
    const xs = mergeAsc(vs.map((s) => s.x));
    if (xs.length < 3) continue;
    const bottom = Math.min(...vs.map((s) => s.a));
    const columns = [];
    for (let k = 0; k + 1 < xs.length; k++) {
      const x1 = xs[k], x2 = xs[k + 1];
      if (x2 - x1 < 3) continue;
      const hdr = items.filter((i) => midX(i) > x1 && midX(i) < x2 && midY(i) < headerTop && midY(i) > headerBottom);
      const label = cellLines(hdr).join('').replace(/\s+/g, '');
      columns.push({ label: label || `col${k}`, x1, x2 });
    }
    // 열마다 칸 경계. 열 너비 전체를 가로지르는 선만 인정한다.
    // (글자 폭만큼의 짧은 선 = 밑줄이다. 早稲田 商 配当表 p12의 과목명 밑줄이 행을 쪼갠 사례 → §9)
    const spans = (s, c) => s.a <= c.x1 + 2 && s.b >= c.x2 - 2;
    const colCells = columns.map((c) => {
      const lineYs = mergeVals(H.filter((s) => spans(s, c)).map((s) => s.y));
      const bs = [headerBottom, ...lineYs.filter((y) => y < headerBottom - 1.5 && y > bottom + 1.5), bottom];
      const b = mergeVals(bs);
      const cells = [];
      for (let k = 0; k + 1 < b.length; k++) cells.push({ id: `${c.label}#${k}`, top: b[k], bottom: b[k + 1] });
      for (const cell of cells) {
        const its = items.filter((i) => midX(i) > c.x1 && midX(i) < c.x2 && midY(i) < cell.top && midY(i) > cell.bottom);
        cell.lines = cellLines(its);
      }
      return cells;
    });
    // 최소 행 = 모든 열의 칸 경계 합집합
    const allB = mergeVals(colCells.flatMap((cs) => cs.flatMap((c) => [c.top, c.bottom])));
    const right = xs[xs.length - 1];
    const rows = [];
    for (let k = 0; k + 1 < allB.length; k++) {
      const top = allB[k], bot = allB[k + 1];
      if (top - bot < 3) continue;
      const cy = (top + bot) / 2;
      const cells = {};
      columns.forEach((c, ci) => {
        const cell = colCells[ci].find((x) => x.top >= cy && x.bottom <= cy);
        cells[c.label] = cell ? { id: cell.id, lines: cell.lines, span: cell.top - cell.bottom } : { id: null, lines: [] };
      });
      const rem = items.filter((i) => i.x >= right - 1 && midY(i) < top && midY(i) > bot);
      rows.push({ top, bottom: bot, cells, remarks: cellLines(rem) });
    }
    // 표 제목 = 헤더 바로 위(30pt 이내) 왼쪽의 글자줄
    const titleItems = items.filter((i) => i.y > headerTop && i.y < headerTop + 30 && i.x < xs[0] + 200);
    const tl = cellLines(titleItems);
    tables.push({ headerTop, headerBottom, bottom, right, columns, rows, title: tl[tl.length - 1] || '' });
  }
  return tables.sort((a, b) => b.headerTop - a.headerTop);
}
