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
