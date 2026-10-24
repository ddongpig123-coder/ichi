# scripts/binran — 便覧·学則 PDF 추출 도구

졸업요건·배당표를 PDF/HTML에서 뽑는 로컬 도구. **절차는 [docs/DATA-MANUAL.md](../../docs/DATA-MANUAL.md)** 가 정본이고
여기는 실행법만 적는다. 앱 번들과 무관(별도 package.json).

```bash
cd scripts/binran
npm install          # pdfjs-dist(텍스트) + pdfjs-dist-v3 alias(렌더) + @napi-rs/canvas
```

| 도구 | 용도 | 예 |
|---|---|---|
| `pdftext.mjs` | PDF → 행 텍스트 (cMap 포함, 제어문자 정규화) | `node pdftext.mjs x.pdf > x.txt` |
| `rawxy.mjs` | 한 페이지 좌표 덤프 — **표 열 경계(x) 잡을 때** | `node rawxy.mjs x.pdf 34` |
| `render.mjs` | 한 페이지 PNG — **병합셀·중괄호·○표는 반드시 눈으로** | `node render.mjs x.pdf 22 2.6 p22.png` |
| `strip-html.mjs` | 공개 HTML 요건 페이지 → 텍스트 | `node strip-html.mjs page.html > page.txt` |
| `parsers/` | 학부별 예시 파서 4종(농·국제일본·별표1·법정HTML). 복사해서 X_* 상수만 교체 | |
| `builders/` | 파서 출력 → `docs/data` JSON + `src/data` TS 예시 | |

파서·빌더는 **예시**다. 새 학부/학교는 가장 비슷한 것을 복사해 열 좌표와 zone 표만 바꾼다.
각 파일 하단의 「기대값」 주석은 2026년 자료 기준 — 재실행 결과가 그 숫자와 다르면 먼저 원인을 찾는다.
