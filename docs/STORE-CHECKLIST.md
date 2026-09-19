# 스토어 제출 체크리스트 (App Store / Google Play)

> 목표: 2027-01-15 App Store 제출(ROADMAP). 이 문서는 **순서대로 따라가는 실행 체크리스트**.
> 문안은 [STORE-LISTING.md](STORE-LISTING.md), 방침은 [legal/](legal/), 신고 대응은 [MODERATION.md](MODERATION.md) 참조.
> 표시명 `japan time - 時間割` / 번들ID `com.japantime.app` (제출 전까지 변경 가능, 제출 후 영구 고정).

---

## 0. 개발자 계정 가입 (사용자 — 지금 없음, 제일 먼저)

- [ ] **Apple Developer Program** 가입 ($99/년) — https://developer.apple.com/programs/
  - 개인(Individual) or 법인(Organization). 개인이 빠름(D-U-N-S 불필요). 승인 수 시간~1일.
  - 가입 후 **Apple Team ID**(10자리) 확보 → `eas.json`의 `appleTeamId`에 기입.
- [ ] **Google Play Console** 가입 ($25 1회) — https://play.google.com/console/signup
  - 개인 계정도 2024년부터 신원확인 필요(수일 소요 가능) → **여유 있게 미리**.
- [ ] Apple: **App Store Connect**에서 앱 레코드 생성 → `ascAppId`(숫자) 확보 → `eas.json`에 기입.

## 1. EAS 준비 (사용자 로컬 — 클라우드 환경에선 불가)

- [ ] `npm i -g eas-cli`
- [ ] `eas login` (Expo 계정 = 이미 만든 그 계정 사용 가능)
- [ ] `eas init` → 프로젝트 생성, `app.json`에 `extra.eas.projectId` 자동 기입됨(커밋 OK)
- [ ] `.env`는 커밋 금지 유지. **EAS 빌드에 env 주입**: `eas env:create`(또는 eas.json `env`)로
      `EXPO_PUBLIC_FIREBASE_*` 6개 + `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` 등록
      (EXPO_PUBLIC_ 접두사는 클라 공개값이라 빌드에 포함되어야 함).

## 2. 네이티브 이관 작업 (12월 1주차, ROADMAP)

- [ ] Microsoft/소셜 **네이티브 로그인** — Expo Go(JS SDK)로는 불가. dev-client + 네이티브 연동 필요.
  - 참고: 현재 소셜은 웹 팝업 전용. 폰 네이티브는 EAS dev-client에서 재구현 대상.
  - 학교 이메일 인증이 배지 경로를 커버하므로 소셜 네이티브는 후순위 가능.
- [ ] `eas build --profile development` (dev-client) → 실기기 설치 후 네이티브 동작 확인.

## 3. 빌드 & 베타 (TestFlight / 내부테스트)

- [ ] `eas build -p ios --profile production`
- [ ] `eas build -p android --profile production`
- [ ] `eas submit -p ios --profile production` → **TestFlight** 자동 업로드
- [ ] `eas submit -p android --profile production` → Play **내부 테스트** 트랙
- [ ] 협력자 10~20명 초대(유학생회 등), 크래시/치명버그 우선 피드백.

## 4. App Privacy (개인정보 라벨) — 심사 필수 입력

Apple "App Privacy" / Google "Data safety"에 아래대로 신고:

| 데이터 종류 | 수집? | 용도 | 신원연결(Linked) | 트래킹 |
|---|---|---|---|---|
| 이메일 주소 | 예(가입 시. 게스트는 X) | 계정·인증 | 연결됨 | 아니오 |
| 사용자 콘텐츠(투고·댓글·쪽지) | 예 | 앱 기능 | 연결됨 | 아니오 |
| 프로필(닉네임·아바타URL) | 예 | 앱 기능 | 연결됨 | 아니오 |
| 사용자 ID(uid) | 예 | 앱 기능·법적대응 | 연결됨 | 아니오 |
| 학교/학부/입학년도 | 예(선택 입력) | 앱 기능(스코프) | 연결됨 | 아니오 |
| 위치·연락처·사진첩·카메라 | **아니오** | — | — | — |
| 광고·분석 추적 | **아니오** | — | — | — |

- [ ] **"Data Not Used to Track You"** 선택(광고·서드파티 트래킹 없음).
- [ ] 비밀번호는 Firebase Auth로만 전달·저장(앱이 보관 안 함) — 신고 항목 아님.

## 5. 연령 등급 (Age Rating)

- [ ] Apple 설문: **User-Generated Content = 있음** → 통상 **17+**.
  - 통보/차단/필터 있음을 근거로 문항 정확히 답변(과장 금지).
- [ ] Google 설문(IARC): 소셜/UGC 반영 → Teen~Mature 예상.
- [ ] EULA(이용약관 동의) 화면 — UGC 앱 필수. 현재 `app/terms.tsx` 존재 → 온보딩/가입 동선에 동의 체크 연결 확인.

## 6. 방침 웹페이지 공개 (URL 필수)

- [ ] `docs/legal/TERMS.md` / `PRIVACY.md` → **공개 URL**로 게시(GitHub Pages 등).
- [ ] App Store/Play의 Privacy Policy URL 칸에 기입.
- [ ] 문의 이메일: ddongpig123@gmail.com / 운영자: Lee Junhee / 관할: 東京地方裁判所 (약관과 일치 확인).

## 7. 스크린샷 (사용자 — 실기기/시뮬레이터 캡처)

- [ ] iPhone **6.9"(또는 6.7")** 필수: 1290×2796(6.9") or 1284×2778(6.5"). 3~10장.
- [ ] iPad 12.9"(supportsTablet=true라 요구될 수 있음) — 필요 시.
- [ ] Android: 폰 스크린샷 2~8장(최소 320px~).
- [ ] 추천 컷: ①시간표+친구겹침 ②강의검색/리뷰 ③게시판 ④졸업요건 마술사 ⑤쪽지/라운지.
- [ ] 일본어 UI 캡처 기본, 한국어 스토어용은 언어 전환 후 별도 캡처(선택).

## 8. 심사용 데모 계정 & 리뷰 노트

- [ ] 데모 계정 생성(제출 직전) → App Review Notes에 이메일/비번 기입(**파일 커밋 금지**).
- [ ] 리뷰 노트 문안: [STORE-LISTING.md](STORE-LISTING.md) §4 사용.
- [ ] "게스트로 대부분 열람 가능"을 노트에 명시(심사관 편의).

## 9. 신고 대응 체계 (익명 UGC 앱 리젝 방지 핵심)

- [ ] 앱 내 **통보/차단** 동작 최종 확인(모든 투고·댓글·쪽지).
- [ ] **신고 후 24시간 내 대응 체계** 문서화 → [MODERATION.md](MODERATION.md)에 절차 명시.
- [ ] 금칙어 필터 동작 확인. hard delete 비활성(`deleted:true` 플래그) 확인.

## 10. 제출 직전 최종 점검

- [ ] `app.json` version(1.0.0)/buildNumber/versionCode 정합.
- [ ] `.env`(Firebase 실키) EAS에 주입됨 — 빌드가 실서버 붙는지 확인.
- [ ] 실기기 스모크 테스트: 가입→시간표→게시판→쪽지→신고→차단 1사이클.
- [ ] 방침 URL·데모계정·스크린샷·개인정보 라벨·연령등급 전부 입력 완료.
- [ ] Apple 제출 → 리젝 1~2회 각오(익명 UGC), 메타데이터 수정 수준 대응 예상.

---

### 지금 완료된 것 (이 세션)
- [x] `app.json` 스토어 식별정보(표시명·번들ID·buildNumber·versionCode) 정리
- [x] `eas.json` 빌드/제출 프로필 생성(값 일부는 계정 발급 후 기입)
- [x] 스토어 문안(일/한) — STORE-LISTING.md
- [x] 개인정보 라벨·연령등급·리뷰노트 초안 — 본 문서
