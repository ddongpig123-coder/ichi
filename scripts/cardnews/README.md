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
- **v1 템플릿(`--template v1`)은 구현 예정.** 제목 2줄 규칙·시리즈 라벨 칩·A/B 그림 슬롯(캠퍼스 사진 > 큰 이모지)·전체 폭 CTA 띠·댓글 마커 밑줄·상단 브랜드 띠. v0는 그대로 남긴다. 사진은 `scripts/cardnews/assets/`에 (인물 없는 것만)

## JSON 형식
| type | 필드 | 설명 |
|---|---|---|
| `balance` | `question`, `a`, `b`, `tag?`, `cta?` | 밸런스 게임. `\n`으로 줄바꿈 |
| `topic` | `title`, `board?`, `comments?`, `likes?`, `bestComment?`, `tag?`, `cta?` | 앱에서 화제가 된 글. `bestComment`가 있으면 2장째(댓글 카드)가 자동으로 붙는다 |

- `comments`·`likes`는 **실제 수치만** (MARKETING §5-3). 글이 아직 없으면 빼면 된다 (표시 안 됨)
- 템플릿(색·글꼴·배치)은 `templates.mjs` 한 파일. 글자 수에 따라 제목 크기가 자동으로 줄어든다
- 글꼴: Noto Sans JP(인터넷에서 받아옴) → 없으면 OS 일본어 글꼴로 대체
