# 카드뉴스 생성기 (`scripts/cardnews/`)

인스타·X용 카드 이미지를 JSON 한 파일로 한 번에 만든다. **글씨 중심 + 사진·일러스트 1점 허용 · 실사 인물 없음 · AI 생성 인물 불허** (디자인 규칙 v1은 [docs/MARKETING.md §3-1](../../docs/MARKETING.md)).
전략·운영 규칙은 [docs/MARKETING.md](../../docs/MARKETING.md) §3·§5, 11월 계획은 [docs/MARKETING-2026-11.md](../../docs/MARKETING-2026-11.md).

## 처음 한 번 (준희 PC)
```bash
cd scripts
npm install
npx playwright install chromium
```

## 쓰는 법
```bash
# Instagram 게시용 — ig(1080×1350)만 (기본값)
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json --handle @daigakunomori

# X·Threads용 — sq(1080×1080)
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json --size sq --handle @daigakunomori

# 전부 (ig + sq + x 16:9)
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json --size all --handle @daigakunomori
```
결과는 `scripts/output/cardnews/` (git에 안 올라감).

| size | 픽셀 | 용도 (2026-11-04 확정) |
|---|---|---|
| `ig` | 1080×1350 | **Instagram 게시는 이것만.** 정사각은 IG 그리드가 세로형이라 위아래 여백이 생긴다 |
| `sq` | 1080×1080 | X · Threads |
| `x` | 1200×675 | X 가로. 필요할 때만 |

- `npm install` 뒤 `package-lock.json`이 바뀌면(playwright 추가분) 그 변경은 커밋해도 된다
## v1 템플릿 (`--template v1`) — 2026-11-05부터 이걸 쓴다
```bash
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w2-v1.json --template v1 --handle @daigakunomori
```
MARKETING §3-1 규칙 ①~⑥ 구현: 제목 2줄 자동 분할(1줄 11자·고아 줄 금지·숫자 덩어리 보호) · 시리즈 칩 고정색 · A/B 그림 슬롯 · 전체 폭 CTA 띠 · 댓글 마커 밑줄 · 리스트 「〇選」 · 상단 브랜드 띠.
v0(`templates.mjs`)는 그대로 남아 있고 기본값이다. 파일명 끝에 `-v1`이 붙는다.

| v1 추가 필드 | 어디에 | 설명 |
|---|---|---|
| `series` | 전부 | 시리즈 칩. `究極の2択` / `大学生あるある` / `留学生の森` / `キャンパス情報` / `今週の話題` (색은 `templates-v1.mjs`의 `SERIES`에 고정. 없는 이름은 검정) |
| `deco: true` | 제목 있는 카드 | 제목 양옆에 「＼ ／」 |
| `aImage` / `bImage` | `balance` | 그림 슬롯 사진. `assets/` 안 파일 이름 또는 JSON 기준 경로. **인물 없는 캠퍼스 사진만** |
| `aEmoji` / `bEmoji` | `balance` | 사진이 없을 때 큰 이모지 |
| `screenshot` | `topic` | 앱 화면 캡처(세로) → 폰 프레임에 들어간다 |
| `highlight` | `topic` (bestComment와 함께) | 댓글 카드에서 노란 마커를 칠할 구절 (댓글 본문에 그대로 포함된 문자열) |
| `type: "list"` + `items[]` | 새 카드 | 랭킹·체크리스트. 최대 7개, 우하단에 「〇選」 자동 |

- 사진·캡처는 `scripts/cardnews/assets/` ([규칙](assets/README.md)). 🔴 AI 생성 인물·실사 인물 금지
- 제목에 `\n`을 직접 넣으면 그 자리에서 끊는다(자동 분할보다 우선)

## JSON 형식
| type | 필드 | 설명 |
|---|---|---|
| `balance` | `question`, `a`, `b`, `tag?`, `cta?` | 밸런스 게임. `\n`으로 줄바꿈 |
| `topic` | `title`, `board?`, `comments?`, `likes?`, `bestComment?`, `tag?`, `cta?` | 앱에서 화제가 된 글. `bestComment`가 있으면 2장째(댓글 카드)가 자동으로 붙는다 |
| `list` (v1만) | `title`, `items[]`, `tag?`, `cta?` | 랭킹·체크리스트 |

- `comments`·`likes`는 **실제 수치만** (MARKETING §5-3). 글이 아직 없으면 빼면 된다 (표시 안 됨)
- 템플릿(색·글꼴·배치)은 `templates.mjs` 한 파일. 글자 수에 따라 제목 크기가 자동으로 줄어든다
- 글꼴: Noto Sans JP(인터넷에서 받아옴) → 없으면 OS 일본어 글꼴로 대체
