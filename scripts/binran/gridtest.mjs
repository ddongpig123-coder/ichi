// 격자 복원 결과를 사람이 확인하는 덤프. 파서 작성 전 열 이름·병합 셀이 맞게 잡히는지 본다.
//   node gridtest.mjs <pdf> <page> [headerKey=科目名]
// 출력: 표마다 열 이름, 그리고 행마다 "열=값 | 열=값 …"  (병합 셀 값은 행마다 반복돼 보인다)
import { openPdf, pageItems, pageSegments, extractTables } from './grid.mjs';

const [, , pdf, pageNo, headerKey = '科目名'] = process.argv;
const doc = await openPdf(pdf);
const page = await doc.getPage(Number(pageNo));
const tables = extractTables(await pageItems(page), await pageSegments(page), { headerKey });
for (const t of tables) {
  console.log(`### 표: ${t.title} | 열: ${t.columns.map((c) => c.label).join(' / ')} | 행 ${t.rows.length}`);
  for (const r of t.rows) {
    const parts = t.columns.map((c) => `${c.label}=${r.cells[c.label].lines.join('⏎')}`);
    console.log(parts.join(' | ') + (r.remarks.length ? `  [備考: ${r.remarks.join(' ')}]` : ''));
  }
}
