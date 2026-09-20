# 스토어 제출 체크리스트 (App Store / Google Play)

> 목표: 2027-01-15 App Store 제출(ROADMAP). 이 문서는 **순서대로 따라가는 실행 체크리스트**.
> 문안은 [STORE-LISTING.md](STORE-LISTING.md), 방침은 [legal/](legal/), 신고 대응은 [MODERATION.md](MODERATION.md) 참조.
> 표시명 `japan time - 時間割` / 번들ID `com.japantime.app` (제출 전까지 변경 가능, 제출 후 영구 고정).

---

## ▶ 내일 이어서 할 일 (2026-09-20 기준)

**이미 완료:** Apple 개발자 결제(주문 W1876013199) · Google Play 개발자 계정 생성 · 방침 페이지 gh-pages 배포.

**바로 할 것 — GitHub 방침 URL 살리기 (계정 활성화와 무관, 지금 가능):**
1. **저장소 Public 전환** → `https://github.com/ddongpig123-coder/ichi/settings`
   맨 아래 **Danger Zone → Change repository visibility → Make public** → 저장소명 입력해 확인.
   (보안 스캔 완료: 비밀키·서비스계정 히스토리에 없음 → 공개 안전. Firebase 공개키는 원래 공개값.)
2. **Pages 켜기** → `https://github.com/ddongpig123-coder/ichi/settings/pages`
   Source: `Deploy from a branch` / Branch: **`gh-pages`** / 폴더 **`/(root)`** → Save.
3. 2~5분 뒤 **시크릿창(로그아웃)**으로 열어 공개 확인:
   - `https://ddongpig123-coder.github.io/ichi/privacy.html`
   - `https://ddongpig123-coder.github.io/ichi/terms.html`
   - `https://ddongpig123-coder.github.io/ichi/support.html`

**대기 중 (외부 승인) — 뜨면 진행:**
- Apple 멤버십 활성화 확인 → `https://developer.apple.com/account` 에서 **Active** 뜨는지.
  Active면 → App Store Connect 앱 생성(이름 japan time, 번들ID com.japantime.app) → Team ID/ascAppId를 `eas.json`에.
- Google 신원확인 완료 대기(며칠). 완료되면 내부 테스트 트랙 가능.

**그다음 (본인 맥에서):** `npm i -g eas-cli` → `eas login` → `eas init` → `eas build`.

---

## 0. 개발자 계정 가입 (✅ 둘 다 완료 — 참고용)

> 비용: Apple **$99/년**(매년 갱신) + Google **$25/1회**(평생) = 최초 ~$124 ≈ **17만원 / 1.9만엔**.
> Google 신원확인·폐쇄테스트 요건 때문에 **오늘 바로 시작** 권장.

### 0-A. Apple Developer Program ($99/년)

> 💡 **지역/애플ID 주의 (중요):** "개발자 가입 지역" ≠ "앱스토어 다운로드 지역". **다운로드 지역을 바꿀 필요 없음**
> (바꾸면 구독 취소·한국 앱 다운로드 문제). → **주로 쓰는 애플ID(한국 지역) 그대로 가입**, 지역 건드리지 말 것.
> 가입 시 주소만 실제 일본 주소로 입력(다운로드 지역과 무관). 앱의 일본 출시는 나중에 App Store Connect에서
> **앱별 판매 국가=일본** 체크로 처리(계정 지역이 한국이어도 전 세계 출시 가능). **무료 앱이라 은행/세금 정보도 없음.**
> 비번 잊은 다른 애플ID로 씨름하지 말 것 — 지금 로그인돼 있는 계정 사용.

1. [ ] 사용할 **Apple ID = 지금 폰·맥에 로그인된 것**(비번 확실). 2단계 인증(2FA) 켜기(필수).
2. [ ] https://developer.apple.com/programs/enroll/ 접속 → "Start Your Enrollment".
   (아이폰 **Apple Developer** 앱으로도 가능 — Face ID 신원확인이 더 빠를 때가 있음)
3. [ ] 계정 유형: **Individual(개인)** 선택. → D-U-N-S 번호 불필요, 승인 빠름.
   - ⚠️ 개인 계정은 **개발자 표시명 = 본인 실명(로마자)**이 스토어에 공개됨.
     사업자명으로 감추려면 Organization(법인·D-U-N-S 필요) — 지금은 개인으로 충분.
4. [ ] 법적 이름(재류카드 로마자 = Lee Junhee)·일본 주소(나카노 OK)·전화 입력.
5. [ ] $99 결제(카드). 결제 카드 명의 = 가입 이름과 일치 권장.
6. [ ] 승인 대기 **보통 24~48시간**(가끔 더). 승인 메일 오면 완료.
7. [ ] 승인 후 https://appstoreconnect.apple.com → **Users and Access > 좌하단**에서
   **Apple Team ID(10자리)** 확인 → `eas.json`의 `appleTeamId`에 기입.
8. [ ] App Store Connect에서 **새 앱(App) 생성**(이름 japan time, 번들ID com.japantime.app)
   → 생성되면 URL/화면의 **ascAppId(숫자)** 확인 → `eas.json`의 `ascAppId`에 기입.
   `appleId`에는 로그인 이메일 기입.

### 0-B. Google Play Console ($25/1회)
1. [ ] https://play.google.com/console/signup → Google 계정으로 로그인(만든 그 계정 가능).
2. [ ] 계정 유형: **Personal(개인)** 선택. $25 결제.
3. [ ] **신원 확인(D-U-N-S 아님)** — 여권/재류카드 등으로 본인·주소 확인. **수일 소요 가능**.
4. [ ] ⚠️ **신규 개인 개발자 폐쇄 테스트 요건**(2023.11~ 정책):
   프로덕션 출시 전 **테스터 12명 이상이 20일 연속** 폐쇄(Closed) 테스트에 참여해야
   출시 신청 가능. → **베타 협력자 10~20명이 이 요건을 겸함**. 일정에 반드시 반영.
5. [ ] 결제 프로필(판매자 정보) 등록.

### 0-C. 가입 후 eas.json 채우기 (계정 발급되면)
- [ ] `appleId`(로그인 이메일) / `ascAppId`(숫자) / `appleTeamId`(10자리) 3개.
- [ ] Android: Play Console에서 **서비스 계정 JSON** 발급 → 로컬 경로를 `serviceAccountKeyPath`에.
  (이 JSON은 **절대 커밋 금지** — .gitignore의 serviceAccount*.json 패턴에 해당)

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

> ✅ **gh-pages 브랜치 배포 완료** (방침 페이지만 포함, 내부 문서 노출 없음).
> index/privacy/terms/support.html + .nojekyll. **남은 건 저장소에서 Pages 켜기 1회.**

- [ ] GitHub 저장소 → **Settings → Pages** → Source: **Deploy from a branch** →
      Branch: **`gh-pages`** / 폴더 **`/ (root)`** → Save.
- [ ] 몇 분 뒤 공개 URL (스토어에 그대로 입력):
  - 개인정보처리방침: `https://ddongpig123-coder.github.io/ichi/privacy.html`
  - 이용약관(EULA): `https://ddongpig123-coder.github.io/ichi/terms.html`
  - 지원(Support): `https://ddongpig123-coder.github.io/ichi/support.html`
  - 랜딩: `https://ddongpig123-coder.github.io/ichi/`
- [ ] ⚠️ **비공개 저장소 + 무료 플랜이면 Pages 게시 불가.** 두 선택지:
      ① 저장소를 **Public**으로 전환(주의: **소스코드 전체가 공개**됨. `.env`는 gitignore라 안 올라가지만
      코드·docs는 공개) / ② **GitHub Pro**로 비공개 저장소 Pages 사용.
      코드 비공개 유지가 중요하면 ②, 아니면 ①. (판단 필요 시 알려주세요)
- [ ] 시크릿창(로그아웃)으로 위 URL 열어 **공개 확인**.
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
