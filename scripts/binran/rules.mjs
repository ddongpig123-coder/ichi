// 한 페이지의 표 괘선(가로줄·세로줄)을 좌표로 덤프. 병합 셀(単位·群 등)의 범위를 정할 때 쓴다.
//   node rules.mjs <pdf> <page> [h|v|all]
// 출력: H y=… x1=… x2=…   (가로줄, y 내림차순)
//       V x=… y1=… y2=…   (세로줄)
// 좌표는 rawxy.mjs와 같은 PDF 좌표계. 추출 로직은 grid.mjs의 pageSegments.
import { openPdf, pageSegments } from './grid.mjs';

const [, , pdf, pageNo, mode = 'all'] = process.argv;
const doc = await openPdf(pdf);
const { H, V } = await pageSegments(await doc.getPage(Number(pageNo)));
const r = (v) => +v.toFixed(1);
if (mode !== 'v') for (const s of H.sort((p, q) => q.y - p.y || p.a - q.a)) console.log(`H\ty=${r(s.y)}\tx1=${r(s.a)}\tx2=${r(s.b)}`);
if (mode !== 'h') for (const s of V.sort((p, q) => p.x - q.x || q.b - p.b)) console.log(`V\tx=${r(s.x)}\ty1=${r(s.a)}\ty2=${r(s.b)}`);
