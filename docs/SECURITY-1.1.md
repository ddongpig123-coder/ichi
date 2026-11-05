# 출시 직후 보안·개인정보 강화 — 현황과 할 일 (2026-11-06, iOS 배포 직후)

> 준희: "실제 유저가 늘면 해킹·개인정보 보안을 철저히 하고 싶다. 태희에게 맡긴다." → 이 문서가 태희 지시서.
> **현황은 코드·규칙에서 2026-11-06에 확인한 사실.** 추측은 【추측】으로 표시. 규칙·타입·콘솔 설정은 태희 창구, 스크립트는 준희 PC(서비스 계정 키).

## 0. 지금 이미 돼 있는 것 (유지)
- Firestore 규칙: `users`는 본인만 읽기 · `verificationLevel` 자기 승격 차단 · `reports`/`inquiries` 읽기 전면 금지 · `operators` 쓰기 금지(list도 금지) · 쪽지는 `participants` 기반 · 학교 게시판 쓰기 소속 검증(S3) · 글 카운터 ±1·authorUid 변경 차단·글자 수 상한(11/01) · 검색 색인 검증
- 규칙 회귀 테스트 4파일(`scripts/rules-test/`: chats · content-and-boards · post-index · posts-hardening) — 에뮬레이터, 전부 통과
- 비밀번호는 Firebase Auth 직접 전달(앱에 저장·로그 없음) · 성적/학점은 단말 로컬만 · `.env`·서비스 계정 키 커밋 금지(.gitignore) · 학교 메일 인증은 `emailVerified` 플래그만 사용
- 신고 24시간 처리 체계(약관 명문화) · 금칙어 차단 · 차단·숨김 · 계정 삭제 기능 + 공개 안내 페이지

## 1. 🔴 이번 주 — 규칙·콘솔 (태희 창구)
| # | 할 일 | 왜 | 규모 |
|---|---|---|---|
| 1-1 | **#50 리베이스 → 머지 → 규칙 배포** (OTA가 퍼진 **뒤**) | 지금은 수락 없이 친구 관계를 만들 수 있고 좋아요를 여러 번 누를 수 있다(B2·B4). 먼저 배포하면 구앱에서 친구 수락·좋아요가 실패하므로 순서 엄수(OTA-2026-11 §4-7) | 0.5일 |
| 1-2 | **구 `schools/{sd}/chats` 쓰기 허용을 닫는다** | S3에서 OTA 분리를 위해 열어 둔 것(f268599). `migrate-chats-to-global.mjs`가 「옮긴 방 0」 연속이면 닫는다 | 규칙 1줄 + 테스트 |
| 1-3 | **Firebase 콘솔 Auth 설정** (코드 없음): ① **이메일 열거 보호(Email enumeration protection) 켜기** ② 비밀번호 정책(최소 길이 등) ③ **익명 계정 자동 삭제(30일 미사용)** 켜기 — 첫 실행마다 생기는 익명 계정이 쌓이는 것·계정 양산 악용 완화 ④ Authorized domains에 불필요한 도메인 없는지 | 콘솔 30분 |
| 1-4 | **API 키 제한** (Google Cloud 콘솔 → 사용자 인증 정보): Firebase 웹 API 키는 공개되는 게 정상이지만 **iOS 번들 ID `jp.timetable.app` · Android 패키지(+SHA) · HTTP 리퍼러(gh-pages·web.app)** 로 사용처를 제한 | 콘솔 30분 |
| 1-5 | **Firestore 사용량 감시**: 요금제가 **Spark(무료)** 라 일일 한도(읽기 5만·쓰기 2만·삭제 2만, 저장 1GiB)를 넘으면 **그날 앱이 멈춘다.** 콘솔 사용량 탭을 매일 보고, 사용자가 늘기 시작하면 **Blaze + 예산 알림**으로 전환(시간표 OCR·Functions와 같은 결정, TIMETABLE-OCR §2) | 매일 1분 / 전환은 준희(결제) |

## 2. 🟠 2주 안 — 규칙 보강·백업 (태희 + 준희)
| # | 할 일 | 비고 |
|---|---|---|
| 2-1 | **규칙 테스트를 전 컬렉션으로**: 지금 없는 케이스 추가 — 타인 `users` 읽기 거부 / `usersPublic` 타인 uid로 쓰기 거부 / `operators` 쓰기·list 거부 / `reports`·`inquiries` 읽기 거부 / `verificationLevel` 승격 거부 / `timetables` 타인 쓰기 거부 / 익명 체크박스(S4-4) 필드 검증 | `scripts/rules-test/` |
| 2-2 | **쓰기 폭주 완화(규칙 수준)**: `users/{uid}.lastPostAt`을 쓰고 글·댓글·쪽지 create에서 `request.time - lastPostAt >= 10s`류 검사. 【추측】 봇·스팸 1차 방어로 충분, 완전 방어는 App Check(§3) | 규칙 + `src/types/user.ts`(태희) + 서비스 1줄(준희) |
| 2-3 | **Firestore 백업**: Spark에는 자동 백업·PITR이 없다. Admin SDK로 **주 1회 JSON 덤프** 스크립트(`scripts/backup-firestore.mjs`, 키는 로컬·출력은 레포 밖). 복구 절차 1페이지 | 스크립트는 Claude 작성 가능, 실행은 준희 PC |
| 2-4 | **의존성 취약점**: `npm audit --omit=dev` 28건(critical 2·high 12, 2026-11-06). 대부분 Expo 빌드 도구의 전이 의존성이지만 **`@firebase/firestore`·`@grpc/grpc-js` 항목은 확인**. `npx expo install --fix` 범위의 패치는 OTA, 네이티브가 바뀌면 1.2 재빌드 | 태희 조사 → 준희 머지 |
| 2-5 | **로그 점검**: `console.log/warn`에 이메일·uid·본문이 찍히는 곳이 없는지 grep. 있으면 제거(프로덕션 로그는 기기 밖으로 안 나가지만 스크린샷·공유로 샐 수 있음) | 0.5일 |

## 3. 🟡 1.2 재빌드 묶음 — 네이티브가 필요한 것
| # | 할 일 | 왜 지금 못 하나 |
|---|---|---|
| 3-1 | **Firebase App Check** (iOS App Attest · Android Play Integrity) → Firestore·Auth에 강제 | 앱이 Firebase **JS SDK**를 쓰고 있어 App Check 토큰을 네이티브에서 받아 넘기는 모듈이 필요(재빌드). 단계: 1.2에서 모니터링 모드 → 강제. 【추측】 이게 들어가야 "진짜 앱에서 온 요청만" 받는다 — 익명 계정 양산·스크립트 공격의 근본 대책 |
| 3-2 | 서버(Cloud Functions, Blaze) 도입 시 **rate limit·신고 자동 알림·verified 승격** 등 "클라이언트에 못 맡기는 일"을 서버로 | TIMETABLE-OCR §2 와 같은 결정 |
| 3-3 | 학교 메일 인증 게이팅(`verificationLevel`) 강화 | 성장기에 조임(ROADMAP §5) |

## 4. 개인정보·법무 (준희 + 태희)
- **유출 사고 대응 1페이지**: 발견 → 해당 경로 차단(규칙 즉시 배포) → 영향 범위 산정(어느 컬렉션·몇 명) → **個人情報保護委員会 보고**(2022년 개정법상 일정 요건의 누설은 보고·본인 통지 의무) → 본인 통지 문안. MODERATION §4(법적 대응)에 붙인다
- **접근 권한 최소화**: 서비스 계정 키는 준희 PC 1곳(+백업 1곳)만, Firebase·Apple·Google 콘솔 계정 전부 **2단계 인증**, 태희 계정 권한은 필요한 역할만(Editor 대신 세분화)
- **개인정보처리방침 유지**: 제3자 제공(지금 Google/Firebase만) — OCR 등 외부 AI 도입 시 반드시 갱신(TIMETABLE-OCR §4)
- **운영 로그**: `reports`·`inquiries` 처리 결과를 `status`로 남겨 "24시간 내 대응"을 증명할 수 있게(이미 운영 중)

## 5. 하지 않아도 되는 것 (지금 단계에서 과함)
- 전용 WAF·침투 테스트 외주 · 암호화 키 자체 관리 · 모든 글의 서버 측 AI 검열 — 사용자 수 대비 비용이 안 맞는다. App Check·규칙·백업·콘솔 설정이 먼저.

## 6. 태희 전달용 (복붙)
```
태희야, iOS 출시됐으니 보안·개인정보 쪽을 네 창구로 정리하고 싶어. 정리본은 docs/SECURITY-1.1.md 에 있고, 순서만 적으면:
[이번 주] ① #50 리베이스·머지·규칙 배포 — OTA가 퍼진 뒤에(먼저 하면 구앱 친구 수락·좋아요 깨짐)
          ② 구 schools/{sd}/chats 쓰기 허용 닫기 — migrate-chats 0건 연속 확인 후
          ③ Firebase 콘솔 Auth: 이메일 열거 보호 ON · 비밀번호 정책 · 익명 계정 30일 자동 삭제 ON · Authorized domains 정리
          ④ Google Cloud 콘솔: Firebase API 키를 번들ID/패키지/리퍼러로 제한
          ⑤ Firestore 사용량 매일 확인(Spark 일일 한도 넘으면 앱이 멈춤) — 넘을 것 같으면 바로 말해줘, Blaze 전환은 내가
[2주 안] ⑥ rules-test를 전 컬렉션 회귀로 확장(타인 users 읽기·usersPublic 위조·operators 쓰기·reports 읽기·verificationLevel 승격 전부 거부 확인)
          ⑦ 글·댓글·쪽지 create에 lastPostAt 기반 10초 간격 규칙(타입 users에 lastPostAt 추가)
          ⑧ npm audit 28건 중 firebase/grpc 항목 확인, expo install --fix 범위만 OTA
          ⑨ 백업: Spark엔 자동 백업이 없어서 주 1회 Admin SDK 덤프 스크립트 + 복구 절차(스크립트는 Claude가 짜고 실행은 내 PC)
[1.2] ⑩ App Check(App Attest/Play Integrity) — JS SDK라 네이티브 모듈 필요, 재빌드 묶음에 설계부터
끝난 건 SECURITY-1.1.md 체크박스에 날짜 적어줘.
```
