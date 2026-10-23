# 출시 런북 (LAUNCH RUNBOOK) — ichi / 大学の森

> **목적**: 데스크탑의 Claude(또는 본인)가 **앱 출시까지** 순서대로 따라가는 실행 계획.
> 각 단계에 **[Claude 자동] / [본인] / 🛑 정지선**을 표시했다. 🛑는 되돌릴 수 없으니 **사람 확인 없이 넘지 말 것.**
> 관련: [STORE-CHECKLIST.md](STORE-CHECKLIST.md) · [STORE-LISTING.md](STORE-LISTING.md) · [STORE-PRIVACY-LABELS.md](STORE-PRIVACY-LABELS.md)

작업 브랜치: `claude/app-dev-status-server-lnv2n9` · 번들ID: `jp.timetable.app` · Firebase: `ichi-6b8f7`

---

## 사용법 (데스크탑에서)

1. 레포 폴더에서 Claude Code 실행(데스크탑 앱 또는 `claude`). 이 브랜치 pull.
2. 아래 **권한 세팅**을 1회 적용(자율 세션이 안 멈추게).
3. 권한 드롭다운을 **Auto**로.
4. Claude에게: *"docs/LAUNCH-RUNBOOK.md를 Phase 1부터 따라가. 🛑 정지선에서는 멈추고 나한테 물어봐."*
   (또는 `/loop` 로 반복 수행.)
5. 절전 방지: 맥 `caffeinate -s`, 윈도우 전원설정 "안 꺼짐".

### 권한 세팅 (본인이 1회 적용 — Claude는 자기 권한을 못 바꿈)
`.claude/settings.json`에 아래를 반영(기존 `enabledPlugins`는 유지):
```json
{
  "enabledPlugins": { "expo@claude-plugins-official": true },
  "permissions": {
    "allow": [
      "Bash(npx tsc:*)", "Bash(node:*)", "Bash(python3:*)",
      "Bash(npm install:*)", "Bash(npm run build:*)", "Bash(npm test:*)",
      "Bash(npx expo start:*)", "Bash(npx expo export:*)", "Bash(eas build:*)",
      "Bash(git add:*)", "Bash(git commit:*)", "Bash(git status:*)",
      "Bash(git diff:*)", "Bash(git log:*)", "Bash(git fetch:*)", "Bash(git rebase:*)",
      "Bash(git push -u origin claude/app-dev-status-server-lnv2n9)"
    ],
    "deny": [
      "Bash(eas submit:*)", "Bash(npx firebase-tools deploy:*)", "Bash(firebase deploy:*)",
      "Bash(npm run deploy:web)", "Bash(git push origin master:*)", "Bash(git push origin main:*)"
    ]
  }
}
```
> `deny`에 넣은 것(배포·제출·master push)은 **일부러 자동 금지** = 되돌릴 수 없어 사람이 직접. `/fewer-permission-prompts`로 더 다듬어도 됨.

---

## 전제: 1회 세팅 (본인만 가능 — 비밀값/2FA)

- [ ] **[본인]** `npm i -g eas-cli` → `eas login` (Expo 계정)
- [ ] **[본인]** `eas init` (projectId가 app.json에 기입됨 — 커밋 OK)
- [ ] **[본인]** `.env` 생성(Firebase 키 등) — **커밋 금지**. EAS엔 `eas env:create`로 주입
- [ ] **[본인]** `eas.json`의 `appleId`/`ascAppId`/`appleTeamId`, Android 서비스계정 JSON 경로
- [ ] **[본인]** Firebase 콘솔: 소셜 로그인 프로바이더(구글/X/라인/MS) 활성화 (미설정이면 소셜로그인·소셜 계정삭제 재인증 실패)

---

## Phase 0 — 현재 상태 (이미 완료)

- [x] 전 기능 실데이터(게시판·쪽지·라운지·시간표·강의검색·친구·프로필·테마)
- [x] 졸업 마술사 메이지 **10학부** 영역 진단 + 商·総合数理 배당표/CAN + 法·経営 필수
- [x] 게시판 知恵袋화(해결상태·베스트앤서·조회수·ナイス·태그)
- [x] 약관 동의 동선 · **계정 삭제 기능**(Apple/Google 필수)
- [x] 스토어 문안(일/한) · App Privacy 라벨 매핑 · 방침 gh-pages 배포
- [x] app.json: `jp.timetable.app` / v1.0.0 / build 1

---

## Phase 1 — 코드 프리즈 & QA  [Claude 자동]

- [ ] **[Claude]** `npx tsc --noEmit` 통과 확인
- [ ] **[Claude]** `/code-review` 로 이번 변경분 리뷰 → 버그 있으면 수정·커밋·푸시
- [ ] **[Claude]** 死코드/미사용 import 정리(선택)
- [ ] **[본인 or 태희]** 🛑 **Firestore 규칙 배포**: `npx firebase-tools deploy --only firestore:rules`
      — 조회수(viewCount) 동작에 필요. 규칙 배포는 태희 창구. (미배포여도 앱은 안 깨짐)
- [ ] **[본인]** 🛑 **웹 라이브 배포**: `npm run deploy:web` → `https://ichi-6b8f7.web.app` 에서 신기능 확인
      (졸업 마술사 10학부 / 질문판 베스트앤서 / 계정 삭제)

## Phase 2 — 빌드  [Claude 자동, 데스크탑]

- [ ] **[Claude]** `eas build --profile development -p ios`(또는 android) → dev-client
- [ ] **[본인]** 실기기 설치 → **네이티브 로그인(MS/소셜)·계정삭제 재인증** 동작 확인(Phase 1b 네이티브)
- [ ] **[Claude]** `eas build -p ios --profile production` / `eas build -p android --profile production`
- [ ] 🛑 빌드 성공 확인 후 다음으로

## Phase 3 — 스토어 자산  [본인 / 반자동]

- [ ] **[본인]** 스크린샷(실기기, Firebase 필요): ①시간표+친구겹침 ②강의검색·리뷰 ③질문판(受付中/베스트앤서) ④졸업마술사(학부선택·부족영역) ⑤라운지/쪽지 — **일/한 2세트**
- [ ] **[Claude]** 문안은 STORE-LISTING.md 완성본 사용(필요시 다듬기)
- [ ] **[본인]** 데모 심사계정 생성(이메일/비번) — 비번은 커밋 금지, 심사노트에만

## Phase 4 — 콘솔 입력 & 제출  [본인]

- [ ] **[본인]** App Store Connect / Play Console 앱 생성(EAS가 자동 생성하기도 함)
- [ ] **[본인]** App Privacy / Data Safety = STORE-PRIVACY-LABELS.md 표대로 입력
      (추적 아니요 / Linked 예 / 삭제요청 가능 예)
- [ ] **[본인]** 연령등급 설문(UGC 있음 → 17+ / Teen~Mature)
- [ ] **[본인]** 방침 URL(privacy/terms/support) 입력, 데모계정·심사노트 기재
- [ ] **[Claude]** `eas submit`은 deny라 **본인이** 실행: `eas submit -p ios` / `-p android`
- [ ] 🛑 **[본인] 심사 제출(Submit for Review)** — 되돌릴 수 없음. 최종 확인 후 클릭.

## Phase 5 — 심사 대응  [본인 + Claude]

- [ ] **[본인]** 심사 피드백 수신 → **[Claude]** 코드/문안 수정 → 재빌드 → 재제출
- [ ] 베타(TestFlight/내부테스트) 피드백 반영

---

## OTA 업데이트 (EAS Update) — 심사 없이 내보내기

> **왜 넣었나**: 졸업요건 마스터가 앱 번들 내 코드(`src/data/*.ts`)라서, 학교·학부를 추가하면
> 원래는 재빌드 + 스토어 심사가 필요했다. OTA가 있으면 JS·데이터·버그픽스는 심사 없이 배포된다.
> ⚠️ **프로덕션 빌드에 `expo-updates`가 들어 있어야만 작동** → 그래서 첫 빌드 전인 2026-10-20에 도입했다.

도입 완료분(2026-10-20): `expo-updates ~57.0.26` 설치 · `app.json`에
`runtimeVersion: { policy: "appVersion" }` · `eas.json`은 이미 프로필별 `channel` 보유.

### 1회 세팅 (본인 — Expo 로그인 필요)
- [ ] **[본인]** `eas update:configure` → `app.json`에 `updates.url`, `extra.eas.projectId` 자동 기입(커밋 OK)
      ※ `eas init`을 먼저 했으면 projectId는 이미 있음. **이 설정 없이는 OTA가 동작하지 않는다.**

### 평소 운용
```
eas update --channel production --message "졸업요건: 와세다 商 추가" --environment production
```
- `--environment`는 **SDK 55+에서 필수**.
- 테스트는 `--channel preview`로 먼저. 단말은 앱을 완전히 종료 후 2회까지 재실행하면 적용된다
  (백그라운드 다운로드 → 다음 시작 시 반영).

### OTA로 되는 것 / 안 되는 것
| 되는 것 | 안 되는 것(= 재빌드+심사) |
|---|---|
| 졸업요건 마스터·배당표 등 데이터 추가 | 네이티브 패키지 추가·제거 (expo-* 설치 등) |
| 화면·문구·i18n·버그픽스 | `app.json`의 권한·아이콘·번들ID 변경 |
| 스타일·레이아웃 수정 | SDK 업그레이드 |

- **runtimeVersion = `appVersion` 정책**: `app.json`의 `version`(현재 1.0.0)이 런타임 식별자다.
  **version을 올리면 기존 설치본은 새 OTA를 받지 못한다**(새 빌드를 받아야 함). 반대로 네이티브를
  건드렸는데 version을 안 올리고 OTA를 쏘면 **구버전 네이티브에 신버전 JS가 얹혀 크래시할 수 있다.**
  → 규칙: **네이티브가 바뀌면 version을 올리고 재빌드. JS만 바뀌면 version 그대로 OTA.**
- **스토어 규정**: 버그픽스·콘텐츠·데이터 갱신은 OTA 허용. 앱의 **주 목적·주 기능을 바꾸는** OTA는
  Apple 가이드라인 위반이다. 새 기능은 심사를 통해 낼 것.

---

## 웹 배포는 수동 1단계 (2026-10-20 — pre-push 훅 폐지)

```sh
npm run deploy:web      # → https://ichi-6b8f7.web.app
```

**왜 훅을 없앴나.** 이전에는 태희 PC의 `.githooks/pre-push`가 푸시마다 `npm run deploy:web`을
돌렸다. 문제가 두 가지였다:

1. **브랜치 구분이 없어서** 피처 브랜치 푸시 한 번에 운영이 배포됐다(2026-10-20 실제 발생).
2. **`.claude/settings.json`의 deny를 우회했다.** deny는 Claude의 Bash 호출을 막지만,
   훅은 `git push` 내부에서 git이 실행하므로 걸리지 않는다. 즉 "배포는 사람이"라는 규칙이
   훅 하나로 무력화됐다.

새 브랜치 규칙에서는 master가 **GitHub PR 머지**로 갱신되고 그건 로컬 훅을 아예 안 거치므로,
훅을 master 전용으로 좁혀도 거의 돌지 않는다. 그래서 훅에서 배포를 빼고 **명시적 수동 실행**으로 되돌린다.

> 장차 자동화하려면 GitHub Actions(master 머지 시 배포)로 옮기는 편이 맞다.
> 다만 Firebase 서비스 계정 키 + `EXPO_PUBLIC_*` 7개를 GitHub Secrets에 넣어야 해서
> 출시 주간에 할 일은 아니다. 1.0 이후 과제.

**훅을 이미 켠 PC는 해제할 것** (로컬 설정이라 커밋으로는 안 꺼진다):

```sh
git config --unset core.hooksPath
```
## `eas submit` 시 Apple ID 입력 (eas.json에 안 둠)

`submit.production.ios.appleId`는 **일부러 비워뒀습니다.** 준희님 Apple 계정 이메일이
커밋 이력에 없는 주소라, 공개 저장소에 적으면 그 주소가 새로 노출되기 때문입니다.

제출할 때 둘 중 하나로 넘기세요:

```sh
# (a) 환경변수로
EXPO_APPLE_ID="your@email" eas submit -p ios --profile production

# (b) 그냥 실행하면 대화형으로 물어봅니다
eas submit -p ios --profile production
```

`appleTeamId`(`3498G5A326`)와 `ascAppId`는 비밀값이 아니라 eas.json에 그대로 둡니다
(`ascAppId`는 App Store Connect에서 앱 생성 후 준희님이 채웁니다).

---
## 🛑 정지선 (사람 확인 필수 — Claude 단독 금지)
1. `npm run deploy:web` (프로덕션 웹 배포)
2. `firebase ... deploy` (규칙/호스팅 배포)
3. `eas submit` (스토어 업로드)
4. **Submit for Review** (심사 제출)
5. 결제·약관 동의·2FA·소셜 콘솔 설정

## Claude가 끝까지 할 수 있는 것 (자율)
코드 수정·QA·tsc·리뷰·버그픽스·커밋/푸시(이 브랜치)·eas build·문서 갱신·데이터 반영(便覧 주면).

## Claude가 못 하는 것 (근본적)
스토어 콘솔 폼 제출·심사 클릭·결제·2FA·실기기 스크린샷·Apple/Google 로그인.

---

## 부록 — 코드리뷰 노트 (2026-10-11 → 2026-10-20 전부 처리 완료)

출시 전 `/code-review` 결과. **수정됨**: ① 신규투고 댓글배지 ② 와세다 서브도메인 이메일.
아래 4건은 당시 **미수정**으로 남겼던 항목(경미/사전존재, 출시 블로커 아님).
**2026-10-20에 전부 처리됨** — 3건은 코드 수정, 1건(계정삭제)은 확인만 하고 코드는 그대로 둠:

- **[계정삭제] deleteUser 실패 시 고아 계정**(authService) — **✅ 확인됨(2026-10-20, 코드 수정 없음)**:
  재인증 후라 드물지만, `deleteSelfData` 뒤 `deleteUser`가 네트워크로 실패하면 프로필만 지워지고 Auth 계정은
  남음. 다음 로드 때 `ensureUserProfile`로 최소 프로필 자가복구되나 "삭제했는데 계정 생존" 상태.
  **완전 원자적 삭제는 Cloud Functions 필요**(Blaze) → 1.0 범위 밖.
  **재시도 경로 점검 결과 — 실제로 동작함**:
  ① `account.tsx:runDeleteAccount`의 `finally`가 `busy`를 풀어 삭제 버튼이 다시 눌림.
  ② 실패 시 `goBack()`을 하지 않고 `isGuest`도 false 그대로라 계정 삭제 카드가 화면에 남음.
  ③ 비밀번호 입력값은 성공 시에만 비우므로(`setDeletePassword("")`) 재입력 없이 바로 재시도 가능.
  ④ `deleteSelfData`는 전부 `deleteDoc(...).catch(() => {})`라 **멱등** — 이미 지워진 문서에 다시 돌려도
  실패하지 않음(`updateDoc` 미사용). `clearGradState`도 예외를 삼킴. 재인증에 쓰는 `user.email`은
  Auth 쪽 값이라 Firestore 프로필이 지워져도 남아 있음.
  ⚠️ 단, 실패 알림 문구는 `account.deleteFailed`("削除に失敗しました") + 에러 메시지뿐이고 **"다시 시도하세요"라는
  문장은 없음**(버튼이 그대로 남아 있어 재시도 자체는 가능). 문구 보강은 선택사항.
- **[쪽지 미읽음] 서버/단말 시계 오차**(chatService.isChatUnread) — **✅ 수정됨(2026-10-20)**:
  `lastRead`=단말 `Date.now()` vs `lastMessageAt`=serverTimestamp 비교라 시계 스큐 시 배지 오작동 가능했음.
  `markChatRead`도 `serverTimestamp()`로 통일하고, 읽을 때 `lastRead` 맵을 ms로 정규화(`toMsMap`).
  옛 number 데이터도 그대로 읽히고, 쓰기 직후 로컬 스냅샷(null)은 "지금"으로 쳐서 배지가 되살아나지 않음.
  chats update 규칙은 필드 검증이 없어 **규칙 배포 불필요**.
- **[졸업화면] calcGrad 2회 실행**(graduation.tsx) — **✅ 수정됨(2026-10-20)**:
  `isCommerce` 가드 + `useMemo`로 정리. 商学部일 때만, 입력(master·baseline·records·courseId)이 바뀔 때만 계산.
  `calc`/`projected`가 null일 수 있어 商学部 블록을 `isCommerce && calc && projected` 가드 안으로 넣음.
  **판정 결과는 수정 전후 동일**(회귀 스냅샷 5개 시나리오 완전 일치 + 웹 미리보기에서 商学部 화면 확인).
- **[알림] persistSeen 死코드**(NotificationsContext) — **✅ 수정됨(2026-10-20)**: 제거.
  `setSeen` 내 인라인 저장이 이미 대체하고 있었음.

---

## 부록 — 실기기 계정 삭제 멈춤 버그 (2026-10-23 수정)

**증상**: 실기기 dev 빌드에서 계정 삭제 → 비밀번호 입력 → 확인 팝업 → 「削除する」를 누르면
화면이 그대로 멈추고 성공/실패 알림이 **둘 다 안 뜸**. 이후 같은 메일로 가입하면
"이미 등록된 이메일"이 떠서 **Auth 계정이 안 지워진 것**이 확인됨. Apple 5.1.1(v) 필수 요건.

**진단**: 알림이 하나도 안 뜨는데 확인 팝업까지는 떴다 = `Alert`는 정상, `await`가 영구히
해결되지 않는 상태. 그리고 `deleteUser`(마지막 단계)가 실행되지 않았다 = 그 앞 단계에서 멈춤.
멈출 수 있는 지점이 네이티브에만 두 군데 있었음:
1. **Firestore 쓰기** — `deleteDoc`은 서버 ack가 올 때까지 resolve되지 않는다. 네이티브에서
   스트림이 확립되지 않으면 promise가 영구 pending (`.catch()`로도 안 잡힘 — reject가 아니니까).
   게다가 구현이 **직렬 await**였어서 첫 건(시간표)이 멈추면 나머지 3종도 아예 실행 안 됨.
2. **동적 import** — `await import("./userService")`는 Metro/Hermes의 비동기 청크 해결에
   의존. 웹에서는 번들 스플리팅으로 문제없지만 네이티브 dev 빌드에서 돌아오지 않을 수 있음.

**수정** (`authService.deleteAccount` / `userService.deleteSelfData` / `app/account.tsx`):
- 동적 import 2개 → **정적 import**. (순환 참조 없음 — `authService`는 이미 `userService`를
  정적으로 import 중)
- 모든 단계에 **제한시간**(`withTimeout`): 재인증 15s / Firestore 삭제 8s / 로컬 삭제 3s /
  Auth 삭제 15s. 시간 초과 시 `code = DELETE_TIMEOUT`, `step = <단계명>`으로 reject →
  화면이 반드시 성공 또는 실패 알림으로 끝난다.
- **Firestore 삭제 실패·시간초과로 Auth 삭제를 막지 않는다.** Auth 계정이 남는 쪽이
  심사 요건상 치명적이기 때문(= 이번 증상). 반대로 프로필이 남는 건 본인이 더는 접근할 수 없는
  고아 데이터이고, 완전 원자적 삭제는 Cloud Functions(Blaze) 필요 → 1.0 범위 밖(위 부록 참조).
- `deleteSelfData`를 **병렬(`Promise.allSettled`)**로 바꾸고 민감한 순서대로 던진다
  (emailIndex → users → usersPublic → timetables). 한 건이 멈춰도 나머지는 지워짐.
- 단계별 로그 `[deleteAccount] 1/4 … 4/4`. 비밀번호·메일은 로그에 안 남긴다(AGENTS 불변 제약).
- 화면: 진행 중 버튼 문구 `削除中…`, 이중 탭 가드, 타임아웃/네트워크/시도초과 전용 안내 문구,
  일반 실패 시 "다시 시도해 주세요" 한 줄 추가.

**검증**: `npx tsc --noEmit` 통과 + 스텁(가짜 firebase 모듈)으로 실제 `authService.ts`를 돌려
7개 시나리오 확인 — ①정상 ②Firestore hang→Auth 삭제 실행됨 ③로컬 hang→Auth 삭제 실행됨
④재인증 hang→`DELETE_TIMEOUT(step=reauthenticate)` ⑤Auth 삭제 hang→`DELETE_TIMEOUT(step=deleteUser)`
⑥Firestore reject→Auth 삭제 계속 ⑦비번 미입력→`DELETE_PASSWORD_REQUIRED`.
**실기기 재현 확인은 준희님 몫**(이 환경에 `.env`가 없어 실제 Firebase 연결 테스트 불가).

**실기기에서 다시 확인할 것**:
```
npx expo start --dev-client     # 폰에서 앱 열면 터미널에 로그가 붙음
```
- 삭제가 성공하면 `[deleteAccount] 1/4 … 4/4 … 完了` + 「削除しました」 알림.
- `2/4`에서 8초 타임아웃 로그(`プロフィール削除が未完了`)가 떠도 **계정 삭제 자체는 성공**해야 한다.
  다만 이 로그가 매번 뜬다면 네이티브에서 Firestore 쓰기가 ack를 못 받고 있다는 뜻 →
  다음 레버는 `src/config/firebase.ts`의 `getFirestore(app)`를
  `initializeFirestore(app, { experimentalForceLongPolling: true })`로 바꾸는 것(네이티브 전용).
  앱 전체의 통신 방식이 바뀌므로 **로그로 근거를 확인한 뒤에** 적용할 것.
- `1/4`에서 15초 타임아웃이 뜨면 재인증(= Auth 통신) 자체가 막힌 것 → 기기 네트워크/VPN 확인.
