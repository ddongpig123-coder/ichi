# App Privacy 라벨 매핑 (코드 기준) — v1.0.0

> Apple App Privacy(영양성분표) / Google Play Data Safety 콘솔 입력용.
> **코드 감사 기준**(2026-10-07). 과장·누락 금지 — 심사에서 라벨과 실제 동작이 다르면 리젝 사유.
> 근거: `src/services/*.ts`(firestore 쓰기), `package.json`(SDK), `src/types/user.ts`.

---

## 0. 큰 그림 (먼저 이것만 봐도 됨)

- **서드파티 SDK = Firebase(Auth + Firestore)뿐.** 분석(Analytics)·크래시(Crashlytics)·광고(Ads)·추적 SDK **전무**.
  → 설문 전반에서 **"데이터를 사용자 추적에 사용하지 않음(Data Not Used to Track You)"** 선택.
- **위치·연락처·카메라·마이크 권한 없음.** 사진 **업로드 없음**(firebase/storage 미사용).
- 수집하는 데이터는 **전부 앱 기능(App Functionality) 목적** + **계정(uid)에 연결됨(Linked)**.
- **단말 로컬 전용(수집 아님, 라벨 제외):** 졸업/성적 기록(`gradRecordService` = AsyncStorage, 서버 전송 안 함).
  ⚠️ 단, **시간표는 Firestore 저장**(`users/{uid}/timetables`)이라 **수집 대상**(성적 기록과 혼동 금지).
- **전송 중 암호화 = 예**(Firebase HTTPS/TLS).

---

## 1. 수집 데이터 인벤토리 (코드 근거)

| 데이터 | 저장 위치 | 필수/선택 | 근거 |
|---|---|---|---|
| 이메일 주소 | Auth + `users/{uid}.email` + `emailIndex/{email}` | 가입 시 필수(게스트는 없음) | userService createUserProfile / writeEmailIndex |
| 닉네임(표시명) | `users/{uid}.nickname` (+ usersPublic 미러) | 필수 | userService |
| 프로필 사진 URL | `users/{uid}.photoURL` | 선택(기본 null, 소셜 로그인 아바타 URL일 수 있음) | 업로드 없음·외부 URL |
| 사용자 ID(uid) | Firebase Auth uid | 필수 | 전역 |
| 학교/학부/입학년도 | `users/{uid}.schoolDomain/department/admissionYear` (+공개 미러) | 선택(온보딩·프로필) | userService |
| 학업정보(GPA·취득학점 등) | `users/{uid}.academic` | 선택(프로필에서 직접 입력) | userService updateAcademicInfo |
| 게시글·댓글·강의 리뷰 | `schools/.../posts`, `.../comments`, 리뷰 컬렉션 | 선택(작성 시) | boardService 등 |
| 쪽지(DM) 본문 | `schools/{sd}/chats/{id}/messages.text` | 선택(전송 시, **E2E 아님**) | chatService |
| 시간표 | `users/{uid}/timetables/{학기}` | 선택 | timetableService |
| 친구 관계 | `friendships`, `users/{uid}.friendIds` | 선택 | friend 서비스 |
| 약관 동의 일시 | `users/{uid}.agreedTermsAt` | 필수(EULA 증적) | onboarding |
| **성적/졸업 기록** | **단말 AsyncStorage만(서버 전송 X)** | — | gradRecordService → **라벨 제외** |

> 비밀번호: Firebase Auth로 전달만, 앱이 저장·로깅 안 함 → 별도 라벨 항목 아님.
> authorUid·investigation 목적 보존(신고/법적 대응)은 방침서에 공개(삭제는 soft-delete).

---

## 2. Apple — App Privacy (App Store Connect)

> 질문 순서: ① 데이터 수집하나요? **예** → ② 유형별로 [수집 / 연결(Linked) / 추적(Tracking) / 목적] 선택.
> **공통: Linked to You = 예 / Used to Track You = 아니요 / Purpose = App Functionality.**

| Apple 카테고리 | 세부 유형 | 수집 | 비고 |
|---|---|:--:|---|
| Contact Info | **Email Address** | ✅ | 가입 계정 |
| Contact Info | **Name** | ✅ | 닉네임/표시명(실명 입력 가능성 대비 보수적으로 포함) |
| Identifiers | **User ID** | ✅ | Firebase uid |
| User Content | **Other User Content** | ✅ | 게시글·댓글·강의리뷰·쪽지·시간표·학업정보 |
| User Content | Photos or Videos | △ | photoURL(소셜 아바타 URL). 업로드는 없음 — 넣으려면 "선택"으로 |
| Other Data | **Other Data Types** | ✅ | 학교/학부/입학년도/GPA·학점/친구관계/동의일시 |
| Usage Data | — | ❌ | 분석 없음 |
| Diagnostics | — | ❌ | 크래시 SDK 없음 |
| Location / Financial / Health / Contacts / Browsing·Search History / Purchases | — | ❌ | 해당 없음 |

- **Tracking**: 전 항목 "아니요" → App Tracking Transparency 프롬프트 불필요.
- 각 유형 목적: **App Functionality** 체크(필요 시 "Other purposes"는 체크 안 함).

---

## 3. Google — Data Safety (Play Console)

> 질문: [수집(Collected)/공유(Shared)] · 목적 · [전송 중 암호화] · [사용자가 삭제 요청 가능].
> **공통: Shared = 아니요(제3자 공유 없음) / 전송 중 암호화 = 예 / 수집 = 예.**

| Google 카테고리 | 세부 유형 | 수집 | 목적 |
|---|---|:--:|---|
| Personal info | **Email address** | ✅ | 계정 관리, 앱 기능 |
| Personal info | **Name** | ✅ | 닉네임 — 앱 기능 |
| Personal info | **User IDs** | ✅ | 앱 기능, 계정 관리 |
| Personal info | **Other info** | ✅ | 학교/학부/입학년도/GPA·학점 — 앱 기능 |
| Messages | **Other in-app messages** | ✅ | 쪽지(DM) — 앱 기능 |
| Photos and videos | Photos | △ | photoURL(소셜 아바타). 업로드 없음 — 넣으려면 "선택" |
| App activity | — | ❌ | 분석/검색기록 서버저장 없음 |
| App info & performance | — | ❌ | 크래시/진단 SDK 없음 |
| Location / Financial / Health / Contacts / Calendar / Web browsing / Device IDs | — | ❌ | 해당 없음 |

- 게시글·댓글·리뷰(공개 UGC): Google Data Safety에 전용 카테고리가 없음. 비공개 쪽지는 **Messages**로 선언,
  공개 게시물은 별도 선언 의무가 약함(공개 콘텐츠). 보수적으로 가려면 "Other info"에 포함 설명.
- **공유(Shared) 없음** — 제3자(광고/분석)로 데이터 보내지 않음.

---

## 4. 계정·데이터 삭제 수단 — ✅ 인앱 구현 완료

**Apple·Google 모두 "계정 생성 앱은 계정+데이터 삭제 경로"를 요구** → **인앱 삭제로 구현됨.**

- 위치: **프로필 → 계정(`app/account.tsx`) → "계정 삭제"** (등록 사용자 노출).
- 동작(`authService.deleteAccount`): ① 재인증(이메일=비번 확인 / 소셜=popup, 웹) → ② 본인 식별데이터 삭제
  (`users/{uid}`·`usersPublic/{uid}`·`emailIndex`·`timetables` + 단말 성적기록) → ③ `deleteUser`(Auth 삭제).
- **게시물·댓글·쪽지는 authorUid를 법적대응 위해 보존**(匿名 상태, 본인 연결 해제) — UI·방침에 명시(`account.deleteWarn`).
- rules 변경 불필요(본인 delete 이미 허용). 소셜 재인증은 현재 **웹 전용**(네이티브는 Phase 1b, EAS dev-client).

> **콘솔 입력**: Google Data Safety "사용자가 데이터 삭제를 요청할 수 있음 = **예**". Apple App Review Notes에
> "Account deletion: Profile → Account → Delete account (in-app)" 기재. 별도 삭제 URL 불필요.

---

## 5. 요약 체크 (콘솔 입력 시)

- [ ] Apple: 수집 데이터 7종(Email/Name/UserID/UserContent/OtherData, +선택 Photos) · **Linked 예 / Tracking 아니요 / App Functionality**
- [ ] Google: Email/Name/UserID/OtherInfo/Messages(+선택 Photos) · **Shared 아니요 / 전송중 암호화 예 / 삭제요청 가능 예**
- [x] **계정·데이터 삭제 수단**(§4) — ✅ 인앱 구현 완료(프로필→계정→계정 삭제)
- [ ] 방침서(privacy.html)와 라벨 내용 일치 재확인
