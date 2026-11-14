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

## 2. 어떻게 켜나 (사용자)

- **처음 글·댓글·쪽지를 쓴 직후에 한 번만** 「コメントが付いたら通知しましょうか？」 → 「通知を受け取る」를 누를 때 비로소 OS 허락 창이 뜬다(갑자기 띄우지 않음)
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
- Firestore 트리거는 **리전을 안 적었다** → 배포 도구가 DB 위치를 보고 같은 곳에 둔다(트리거는 DB 와 같은 리전이어야 만들어진다)
- 🔴 옛 앱 보호: `expo-notifications` 는 맨 위에서 import 하지 않는다(AGENTS.md). iOS 번들에서 알림 부품 6개가 `pushService` 의 지연 `require` 로만 닿는 것 확인(11/14)

## 4. 시험 (11/14)

- 함수 에뮬레이터 **18건**(가짜 Expo 서버): 로그인·형식 검사 / 내 글에 내 댓글 → 없음 / 남의 댓글 → 기기 2대 / 없는 기기 토큰 삭제 / 답글 → 한국어 / 차단 → 없음 / 댓글 알림 끔 → 없음 / 숲 댓글 / 쪽지(내용 없음) / 1분 내 두 번째 → 없음 / 참가자 아닌 사람 → 무시 / 남의 토큰 해제 불가 / 기기 주인 바뀜 / 계정 삭제 → 토큰·기록 삭제
- 단위 11건(`cd functions && npm test`) · 시간표 읽기 15건 재확인 · 웹: 알림 메뉴 숨김·오류 0 · `npx tsc --noEmit`
- ⏳ **실기기**: 개발용 빌드로 확인(§6)

## 5. 준희가 할 것 — 처음 한 번

### 5-1. 서버 (지금)
1. PR 머지 뒤 `cd ~/ichi && git checkout master && git pull`
2. `npm run deploy:functions` — 처음 Firestore 트리거를 만들 때 Google Cloud 기능(Eventarc 등)을 켜겠냐고 물으면 Yes.
   「권한이 아직 준비 안 됐다(service agent)」 오류가 나면 **5분 뒤 같은 명령을 다시** — 처음 한 번 흔한 일

### 5-2. iOS (개발용 빌드 때 자동)
- `eas build` 중 **「Set up Push Notifications?」 → Yes**. EAS 가 Apple 푸시 키를 만든다(팀 단위 1개, 본 앱·dev 앱 공용)

### 5-3. Android (1.1.0 빌드 전까지)
1. Firebase 콘솔 → 프로젝트 설정 → 「앱 추가」 → Android → 패키지 이름 `jp.timetable.app` → **`google-services.json` 다운로드**
2. expo.dev → 프로젝트 → **Environment variables** → Add → 이름 `GOOGLE_SERVICES_JSON`, 종류 **File**, 파일 선택, 환경 production(+preview) → 저장
   (저장소에는 올리지 않는다 — `.gitignore` 등록됨)
3. FCM 발송용 키: Google Cloud 콘솔 → IAM → 서비스 계정 → **새로 만들기**(역할 「Firebase Cloud Messaging API 관리자」만) → 키(JSON) 만들기
   → 터미널 `eas credentials` → Android → production → Google Service Account → **FCM V1** → 그 JSON 업로드
   🔑 `scripts/keys/serviceAccount.json`(DB 전체 권한)을 쓰지 말 것 — Expo 에 맡기는 키는 **알림 권한만** 있는 것으로

## 6. 개발용 빌드 (실기기 시험) — 아이폰

> 사진 고르기·알림은 웹·Expo Go 로 못 본다. **개발용 앱 「大学の森 dev」** 를 따로 깐다(스토어 앱은 그대로 남는다 — 다른 번들 ID `jp.timetable.app.dev`).

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
