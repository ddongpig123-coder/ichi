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

## 문서 수정 시

`.md`(정본)와 `app/*.tsx`(앱 화면), `.html`(호스팅)을 **함께** 갱신하세요. HTML은 세션에서 Artifact로도 발행됩니다.
