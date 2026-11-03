# 카드뉴스 생성기 (`scripts/cardnews/`)

인스타·X용 **글씨 중심 카드 이미지**를 JSON 한 파일로 한 번에 만든다. 실사 인물 없음.
전략·운영 규칙은 [docs/MARKETING.md](../../docs/MARKETING.md) §3·§5, 11월 계획은 [docs/MARKETING-2026-11.md](../../docs/MARKETING-2026-11.md).

## 처음 한 번 (준희 PC)
```bash
cd scripts
npm install
npx playwright install chromium
```

## 쓰는 법
```bash
# 인스타 피드용 (1080×1350)
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json

# X용 (1200×675) / 전부
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json --size x
node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json --size all --handle @daigakunomori
```
결과는 `scripts/output/cardnews/` (git에 안 올라감).

## JSON 형식
| type | 필드 | 설명 |
|---|---|---|
| `balance` | `question`, `a`, `b`, `tag?`, `cta?` | 밸런스 게임. `\n`으로 줄바꿈 |
| `topic` | `title`, `board?`, `comments?`, `likes?`, `bestComment?`, `tag?`, `cta?` | 앱에서 화제가 된 글. `bestComment`가 있으면 2장째(댓글 카드)가 자동으로 붙는다 |

- `comments`·`likes`는 **실제 수치만** (MARKETING §5-3). 글이 아직 없으면 빼면 된다 (표시 안 됨)
- 템플릿(색·글꼴·배치)은 `templates.mjs` 한 파일. 글자 수에 따라 제목 크기가 자동으로 줄어든다
- 글꼴: Noto Sans JP(인터넷에서 받아옴) → 없으면 OS 일본어 글꼴로 대체
