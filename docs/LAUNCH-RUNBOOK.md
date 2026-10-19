# 출시 런북 (LAUNCH RUNBOOK) — ichi / japan time

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

## 부록 — 코드리뷰 노트 (2026-10-11, 미수정 항목)

출시 전 `/code-review` 결과. **수정됨**: ① 신규투고 댓글배지 ② 와세다 서브도메인 이메일.
아래는 **미수정**(경미/사전존재) — 출시 블로커 아님, 여유 될 때 정리 권장:

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
- **[쪽지 미읽음] 서버/단말 시계 오차**(chatService.isChatUnread): `lastRead`=단말 `Date.now()` vs
  `lastMessageAt`=serverTimestamp 비교라 시계 스큐 시 배지 오작동 가능. serverTimestamp 통일 권장.
- **[졸업화면] calcGrad 2회 실행**(graduation.tsx): 商 외 학부에서도 商용 calc가 매 렌더 2회 실행(결과 미사용).
  마스터가 작아 체감 無. isCommerce 가드 or useMemo로 정리 가능(로직 상관관계 있어 신중히).
- **[알림] persistSeen 死코드**(NotificationsContext): 정의됐으나 미사용. setSeen 내 인라인 저장으로 대체됨 → 제거 가능.
