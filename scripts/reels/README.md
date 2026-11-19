# 릴스 조립 도구 (마케팅)

AI로 뽑은 실사 클립 + 앱 화면 + 자막을 세로 릴스(1080x1920)로 조립한다. 앱 번들에 포함되지 않는다.

- `capgen.cjs` — 자막 PNG 생성(Playwright). 스타일 `k`(영상 위 큰 흰 글씨·핵심어 노랑) / `c`(앱 화면 위 제목)
- `mkreel.py` — 조립. `python3 mkreel.py spec.json`
  - `clip`: 클립의 `ss`부터 `t`초, 자막 여러 개를 `from`~`to`에 표시. `speech:false`면 음량만 살짝 올림
  - `app`: 앱 화면 이미지(1170x1992)를 폰 틀에 넣고 천천히 확대
  - `file`: 미리 만든 구간(끝 화면 등)을 그대로 이어 붙임

작업 폴더에 `bg.png`(배경) · `mask.png`(둥근 모서리) · `mascot-bear.png` · 클립 폴더가 있어야 한다.
영상·음성 원본과 마스코트 이미지는 공개 저장소에 올리지 않는다(`.gitignore`).
진행 상황은 [docs/MARKETING-VIDEO-PLAN.md](../../docs/MARKETING-VIDEO-PLAN.md).
