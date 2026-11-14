# 푸시 알림 (RELEASE-PLAN N2) — 2026-11-14

> **결정(준희)**: 처음에는 **댓글이 달리거나 쪽지가 왔을 때만** 알린다. **공지·광고성 알림은 보내지 않는다.**
> 1.1.0 스토어 빌드에 들어간다(새 네이티브 부품 `expo-notifications`). 옛 앱(1.0.0)에선 알림 메뉴가 안 보인다.

## 1. 무엇을 알리나

| 종류 | 누구에게 | 제목 (일 / 한) | 본문 | 누르면 |
|---|---|---|---|---|
| 내 글에 댓글 | 글쓴이 | 新しいコメント / 새 댓글 | 「글 제목」 + 댓글 앞부분 | 그 글 |
| 내 댓글에 답글 | 답글 대상 | あなたのコメントに返信がありました / 내 댓글에 답글이 달렸어요 | 同上 | 그 글 |
| 쪽지 | 받는 사람 | 新しいメッセージ / 새 쪽지 | **내용 없음**(「메시지가 도착했어요」) | 그 쪽지방 |

- 학교 게시판·みんなの森·留学生の森 모두. 내가 쓴 댓글엔 안 알린다. **차단한 사람**의 댓글·쪽지는 안 알린다
- 쪽지는 **같은 방 1분에 1번**(대화 중에 한 통마다 울리지 않게). 그 방을 보고 있으면 앱 안에선 안 띄운다
- 🔑 **쪽지 내용은 알림에 넣지 않는다** — 알림 문구는 Expo·Apple·Google 서버를 지나고 잠금화면에도 뜬다. 댓글은 게시판에서 누구나 읽는 내용이라 앞부분을 넣는다
- 알림 언어 = 그 기기의 앱 언어(일/한)

## 2. 어떻게 켜나 (사용자) — **기본은 켜짐** (11/14 준희 「기본은 켜고, 끌 수 있게」)

> 아이폰은 앱이 마음대로 알림을 켤 수 없다(OS 허락 1번 필수). 그래서 「기본 켜짐」 = **일찍 한 번 묻고, 허락하면 댓글·쪽지 둘 다 켠 상태로 시작**.

- **새 사용자**: 처음 설정에 **④ 알림** 단계(① 학교 → ② 시간표 → ③ 친구 → ④ 通知 → 사용법). 「通知をオンにする」 → OS 허락 창 → 허락하면 둘 다 켬. 「あとで」·「スキップ」 가능
- **기존 사용자**(1.1.0 으로 업데이트한 사람): 업데이트 후 처음 열 때 **한 번만** 같은 카드(「新しい機能」)
- 둘 다 OS 허락이 아직 안 정해졌을 때만 나온다(이미 허락·거부했으면 안 나옴). 알림 부품이 없는 옛 앱·웹에선 ④ 없이 3단계
- 허락은 했는데 설정을 아직 안 만졌으면 **둘 다 켬으로 취급**(안드로이드 12 이하는 허락 창 없이 바로 켜짐)
- 위에서 「あとで」 한 사람에겐 **처음 글·댓글·쪽지를 쓴 직후에 한 번 더** 「コメントが付いたら通知しましょうか？」
- **프로필 → 通知**: 「コメント・返信」·「メッセージ」 각각 켜고 끄기. 「お知らせや広告の通知は送りません」 표시. OS 에서 꺼 두었으면 「設定を開く」
- 설정은 **기기별**. 로그아웃하면 그 기기의 알림을 끊는다(다음 사람에게 앞 사람 알림이 안 가게)

## 3. 구조

| 파일 | 하는 일 |
|---|---|
| `functions/index.js` | `registerPushToken` / `unregisterPushToken`(호출형, 도쿄) · `pushOnBoardComment` / `pushOnLoungeComment` / `pushOnChatMessage`(Firestore 트리거) · `cleanupOnUserDelete`(계정 삭제 시 토큰·기록 삭제) |
| `functions/push.js` | 알림 문구·토큰 형식 검사(단위 시험 `functions/test/push.test.js`) |
| `src/services/pushService.ts` | 권한·토큰 받기·등록/해제·기기 설정·알림 표시·탭 처리 |
| `src/components/push/PushManager.tsx` | 탭 레이아웃에 1개. 시작할 때 토큰 다시 등록(바뀌었을 때만) · 알림 탭 → 화면 이동 |
| `src/components/push/offerPush.ts` | 첫 글·댓글·쪽지 뒤 1회 안내 |
| `app/notification-settings.tsx` | 프로필 → 通知 |
| `app.config.js` | 개발용 빌드 = 별도 앱(「大学の森 dev」) · 안드로이드 `google-services.json` 을 EAS 환경변수로 |

- 기기 토큰은 `pushTokens/{토큰 해시}` = `{uid, token, platform, lang, comments, messages}`. **규칙에 match 가 없다 = 앱이 직접 못 읽고 못 쓴다.** 등록·해제는 호출형 함수로만 → **firestore.rules 변경 없음**
- 같은 기기에서 다른 계정으로 바꾸면 문서 ID(토큰 해시)가 같아서 주인이 바뀐다. 1인 기기 10대까지
- Expo 가 「없는 기기」라고 답한 토큰은 지운다
- Firestore 트리거 함수는 **`asia-northeast1`(도쿄)로 명시** — DB 가 도쿄에 있다(11/14 첫 배포 로그의 트리거 위치로 확인).
  처음엔 리전을 안 적었는데, 그러면 이벤트 트리거만 DB 위치(도쿄)에 생기고 **함수 본체는 기본값 us-central1** 에 만들어져 댓글 내용이 매번 미국을 오간다 → 고침
- 🔴 옛 앱 보호: `expo-notifications` 는 맨 위에서 import 하지 않는다(AGENTS.md). iOS 번들에서 알림 부품 6개가 `pushService` 의 지연 `require` 로만 닿는 것 확인(11/14)

## 4. 시험 (11/14)

- 함수 에뮬레이터 **18건**(가짜 Expo 서버): 로그인·형식 검사 / 내 글에 내 댓글 → 없음 / 남의 댓글 → 기기 2대 / 없는 기기 토큰 삭제 / 답글 → 한국어 / 차단 → 없음 / 댓글 알림 끔 → 없음 / 숲 댓글 / 쪽지(내용 없음) / 1분 내 두 번째 → 없음 / 참가자 아닌 사람 → 무시 / 남의 토큰 해제 불가 / 기기 주인 바뀜 / 계정 삭제 → 토큰·기록 삭제
- 단위 11건(`cd functions && npm test`) · 시간표 읽기 15건 재확인 · 웹: 알림 메뉴 숨김·오류 0 · `npx tsc --noEmit`
- ⏳ **실기기**: TestFlight 시험 빌드로 확인(§6, 11/14 준희 결정)

## 5. 준희가 할 것 — 처음 한 번

### 5-1. 서버 (지금)
1. PR 머지 뒤 `cd ~/ichi && git checkout master && git pull`
2. `npm run deploy:functions` — 처음 Firestore 트리거를 만들 때 Google Cloud 기능(Eventarc 등)을 켜겠냐고 물으면 Yes.
   「권한이 아직 준비 안 됐다(service agent)」 오류가 나면 **5분 뒤 같은 명령을 다시** — 처음 한 번 흔한 일
   - 11/14 1회차: 호출형 2개·`cleanupOnUserDelete`·`readTimetable` 성공, **Firestore 트리거 3개(`pushOn…`)만 실패** —
     `firebase-debug.log` 에 「Permission denied while using the Eventarc Service Agent … may take a few minutes」 = **처음 한 번의 권한 전파 지연**.
     같은 로그에서 트리거 위치가 `asia-northeast1` → DB 는 도쿄. 함수가 us-central1 로 가려던 것을 도쿄로 명시(PR #120)한 뒤 재배포
   - 재배포 때 「us-central1 의 pushOn… 를 지울까요?」라고 물으면 **Yes**(실패해서 반쯤 남은 것)
   - 실패하면 `firebase-debug.log` 가 생긴다 → 원인 확인 후 지운다(`.gitignore` 등록됨, 계정 정보가 섞일 수 있어 공유 금지)

### 5-2. iOS (개발용 빌드 때 자동)
- `eas build` 중 **「Set up Push Notifications?」 → Yes**. EAS 가 Apple 푸시 키를 만든다(팀 단위 1개, 본 앱·dev 앱 공용)

### 5-3. Android (1.1.0 빌드 전까지)
1. Firebase 콘솔 → 프로젝트 설정 → 「앱 추가」 → Android → 패키지 이름 `jp.timetable.app` → **`google-services.json` 다운로드**
2. expo.dev → 프로젝트 → **Environment variables** → Add → 이름 `GOOGLE_SERVICES_JSON`, 종류 **File**, 파일 선택, 환경 production(+preview) → 저장
   (저장소에는 올리지 않는다 — `.gitignore` 등록됨)
3. FCM 발송용 키: Google Cloud 콘솔 → IAM → 서비스 계정 → **새로 만들기**(역할 「Firebase Cloud Messaging API 관리자」만) → 키(JSON) 만들기
   → 터미널 `eas credentials` → Android → production → Google Service Account → **FCM V1** → 그 JSON 업로드
   🔑 `scripts/keys/serviceAccount.json`(DB 전체 권한)을 쓰지 말 것 — Expo 에 맡기는 키는 **알림 권한만** 있는 것으로

## 6. 실기기 시험

| 방법 | 사진 읽기 | 푸시 알림 | 비고 |
|---|---|---|---|
| **TestFlight 시험 빌드(추천, §6-0)** | ✅ | ✅ 출시와 같은 조건 | 기기 등록·개발자 모드·맥 서버 불필요. 고칠 때마다 다시 빌드 |
| Expo Go (`npx expo start --go --tunnel`) | ✅ (Expo Go 에 사진 부품이 들어 있다) | ⚠️ 불확실(와도 「Expo Go」 이름) | 빌드 불필요 |
| 개발용 빌드 「大学の森 dev」(§6-1) | ✅ | ✅ | 코드 수정이 바로 반영. 처음 준비가 많다 |

### 6-0. TestFlight 시험 빌드 (11/14 준희 선택)
> 이미 출시된 **1.0.0 에는 새 빌드를 올릴 수 없다** → `eas.json` 의 **`beta`** 프로필이 그 빌드에만 버전 **1.1.0** 을 붙인다(`app.config.js` `APP_VERSION_OVERRIDE`).
> 🔴 **`app.json` 의 `version` 은 출시 때까지 1.0.0 그대로.** 바꾸면 `npm run ota` 가 1.1.0 으로 나가 스토어 1.0.0 사용자에게 OTA 가 끊긴다.
> 시험 빌드는 채널 `beta` 라 OTA 를 받지 않는다(내장 코드로만 돈다) — 고친 걸 보려면 다시 빌드.
> 설치하면 폰의 스토어 앱이 TestFlight 판으로 바뀐다(데이터 유지). App Store 에서 다시 받으면 원래대로.

1. `cd ~/ichi && git checkout master && git pull && npm install`
2. (알림 시험 전) `npm run deploy:functions` 가 **트리거까지 성공**했는지
3. `eas build --profile beta --platform ios` — Apple 로그인 → 「Set up Push Notifications?」 **Yes** → 20~30분
4. `eas submit --platform ios --latest` → App Store Connect 처리 10~30분 → 폰의 **TestFlight** 앱에 「大学の森 1.1.0」 → 설치
5. 확인: ① 사진 읽기 ② 프로필 → 通知 → 켜기 → 다른 계정(웹 등)으로 내 글에 댓글 → 알림 → 누르면 그 글 ③ 쪽지 → 알림(내용 없음)

- **시험판에 JS 수정만 보내기(다시 빌드 안 해도 됨)**: `npm run ota -- --beta "무엇을 바꿨나"` → 시험판(1.1.0, 채널 beta)에만 간다. 스토어 1.0.0 사용자에겐 안 간다. 앱을 완전히 닫고 2번 열면 반영
- ✅ 11/14 시험판 1.1.0(빌드 7) TestFlight 설치 → **사진 읽기·댓글 알림·쪽지 알림 모두 실기기 확인(준희)**

### 6-1. 개발용 빌드 (코드를 자주 고치며 볼 때)

> **개발용 앱 「大学の森 dev」** 를 따로 깐다(스토어 앱은 그대로 남는다 — 다른 번들 ID `jp.timetable.app.dev`).

1. `cd ~/ichi && git checkout master && git pull && npm install`
2. 아이폰 등록(처음 한 번): `eas device:create` → **Website** 선택 → 나온 주소(또는 QR)를 아이폰 Safari 로 열기 → 프로파일 다운로드 → 아이폰 **설정** 맨 위 「프로파일이 다운로드됨」 → 설치
3. `eas build --profile development --platform ios` — Apple 로그인(2단계 인증) → 기기 선택에서 내 아이폰 → 「Set up Push Notifications?」 Yes → 20~30분
4. 끝나면 나오는 주소·QR 을 아이폰으로 열어 설치 → 홈 화면에 「大学の森 dev」
5. 처음 열 때 「개발자 모드」가 필요하다고 나오면: 아이폰 **설정 → 개인정보 보호 및 보안 → 개발자 모드 → 켜기** → 재시동 → 「켜기」
6. 맥에서 `npx expo start --dev-client` → 나온 QR 을 아이폰 카메라로 → 「大学の森 dev」로 열린다(맥과 아이폰이 **같은 와이파이**. 안 되면 `npx expo start --dev-client --tunnel`)
7. 그 뒤 코드 수정은 저장하면 바로 폰에 반영(다시 빌드할 필요 없음 — 새 네이티브 부품을 넣을 때만 다시 빌드)

확인할 것: ① 처음 설정 ② / 홈 빈 시간표 → 「スクショから読み込む」 → 사진 선택 → 결과 → 저장 ② 프로필 → 通知 → 켜기(허락 창) → 다른 계정(웹 등)으로 내 글에 댓글 → 알림 → 누르면 그 글 ③ 쪽지 → 알림(내용 없음)
※ dev 앱은 새로 깐 앱이라 **새 게스트 계정**으로 시작한다. 내 계정으로 보려면 프로필 → 계정에서 로그인
※ 초대 링크(`uni-community://`)는 dev 앱이 아니라 스토어 앱을 연다(dev 앱의 스킴은 `uni-community-dev`). 초대 링크 시험은 스토어 앱·웹으로
