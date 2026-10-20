# 법적 문서 (약관·방침) — 호스팅 안내

이 폴더에는 스토어 제출용 **약관·개인정보처리방침**이 두 형태로 있습니다.

| 파일 | 용도 |
|---|---|
| `TERMS.md` / `PRIVACY.md` | 정본 텍스트(앱 내 화면 `app/terms.tsx`·`app/privacy.tsx`와 동기) |
| `terms.html` / `privacy.html` | **공개 호스팅용** 독립 HTML (초안 배너 제거, 일/한 토글) |

확정값: 운영자=Lee Junhee / 관할=東京地方裁判所 / 문의=ddongpig123@gmail.com / 최종갱신일=2026年8月24日.

## GitHub Pages로 공개하기

스토어 제출 시 필요한 **공개 URL**을 GitHub Pages로 만들 수 있습니다.

1. GitHub 저장소 → **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `master`(또는 배포 브랜치) · 폴더 **`/docs`** 선택 → Save
4. 몇 분 뒤 아래 URL로 공개됨:
   - 개인정보처리방침: `https://ddongpig123-coder.github.io/ichi/legal/privacy.html`
   - 이용약관: `https://ddongpig123-coder.github.io/ichi/legal/terms.html`

> ⚠️ Pages는 `/docs` 폴더 전체를 공개합니다. 민감 파일이 `docs/`에 없는지 확인하세요(현재 설계·로드맵 문서뿐, 키·비밀 없음).
> 커스텀 도메인을 쓰면 Firebase Authentication → 승인된 도메인에도 그 도메인을 추가할 것.

## 실제 배포 경로 (2026-10-20 현재)

README 위쪽 안내(= `/docs` 폴더 공개)와 달리, 실제로는 **`gh-pages` 브랜치 루트**에서 서비스되고 있습니다.
스토어에 제출하는 URL도 이쪽입니다.

| 공개 URL | 실체 |
|---|---|
| `https://ddongpig123-coder.github.io/ichi/privacy.html` | `gh-pages:privacy.html` ← `docs/legal/privacy.html` 복사본 |
| `https://ddongpig123-coder.github.io/ichi/terms.html` | `gh-pages:terms.html` ← `docs/legal/terms.html` 복사본 |
| `https://ddongpig123-coder.github.io/ichi/index.html` | `gh-pages:index.html` — **master에 원본 없음. gh-pages에서 직접 관리** |
| `https://ddongpig123-coder.github.io/ichi/support.html` | `gh-pages:support.html` — **master에 원본 없음. gh-pages에서 직접 관리** |

`web.app`(Firebase Hosting)에도 같은 문서가 `/legal/terms.html`·`/legal/privacy.html`로 나갑니다.
`scripts/deploy-web.mjs`가 `docs/legal/*.html`을 `dist/legal/`로 복사하므로, **`npm run deploy:web` 한 번이면 그쪽은 갱신**됩니다.

### 이 폴더의 HTML을 고친 뒤 할 일

```sh
# 1) gh-pages 갱신 (스토어 제출 URL)
git checkout gh-pages
git checkout master -- docs/legal/privacy.html docs/legal/terms.html
mv docs/legal/privacy.html privacy.html && mv docs/legal/terms.html terms.html && rm -rf docs
git add -A && git commit -m "gh-pages: 약관·방침 갱신" && git push origin gh-pages
git checkout master

# 2) web.app 갱신
npm run deploy:web
```

> ⚠️ `index.html`·`support.html`은 master에 원본이 없어 위 절차로 안 바뀝니다.
> 앱 이름 등을 바꿨다면 **gh-pages에서 직접 수정**해야 합니다.
## 문서 수정 시

`.md`(정본)와 `app/*.tsx`(앱 화면), `.html`(호스팅)을 **함께** 갱신하세요. HTML은 세션에서 Artifact로도 발행됩니다.
