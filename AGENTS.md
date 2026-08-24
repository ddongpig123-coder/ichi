# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# ichi 프로젝트 규칙 (모든 세션 공통)

일본 대학 커뮤니티 앱. 전략·일정은 [docs/ROADMAP.md](docs/ROADMAP.md),
신고/차단·법적 대응은 [docs/MODERATION.md](docs/MODERATION.md) 참조. 재론 금지 결정사항은 ROADMAP §5.

## 언어
- 대화·커밋 메시지: 한국어 / **앱 UI 문자열: 일본어만** (i18n 도입 전까지)
- 코드 주석: 일본어 또는 한국어 (기존 파일의 스타일 유지)

## 아키텍처
- Expo Router 파일 기반 라우팅: `app/(tabs)/` = 탭 화면, `app/` 직하 = 스택 화면
- 데이터 접근은 반드시 `src/services/*.ts` 경유 (화면에서 Firestore 직접 호출 금지)
- Firestore 경로: 학교 스코프는 `schools/{schoolDomain}/...`, 전국 스코프는 `lounges/...`
- 타입은 `src/types/`에 정의하고 `firestore.rules`의 검증 조건과 1:1 일치시킬 것
- 신규 컬렉션 추가 시 **규칙(firestore.rules) 먼저, 코드 나중** — 규칙에 없는 컬렉션 접근은 전부 거부됨
- **크롤러/적재 스크립트 출력은 반드시 `src/types/course.ts`의 `Course` 타입을 따를 것** — 앱 강의 검색 UX가 이 형식을 기준으로 동작함. 임의 필드 구조 금지. 공식 크롤 데이터는 `addedBy: "official"`, `verified: true`, Firestore 경로 `schools/{schoolDomain}/departments/{deptId}/courses/{courseId}`
- 크롤러 등 로컬 스크립트는 `scripts/` 폴더에 둘 것 (앱 번들에 포함 안 됨)

## 불변 제약 (보안)
- `.env`는 절대 커밋 금지 (Firebase 키, Microsoft 클라이언트 ID)
- 비밀번호는 Firebase Auth에 직접 전달만. 앱 코드에서 저장·로깅 금지
- `verificationLevel`은 클라이언트에서 생성 시 0 고정, 수정 금지 (규칙 강제)
- 투고의 `authorUid`는 법적 대응용 — 익명화하거나 제거하지 말 것
- 삭제는 hard delete 대신 `deleted: true` 플래그 (Phase 1부터)
- **Firebase Admin SDK 서비스 계정 JSON 키는 절대 커밋 금지** (유출 시 DB 전체 권한 탈취). `.gitignore`에 `serviceAccount*.json`, `scripts/keys/` 등록됨. 키는 로컬에만 두고 경로를 env로 주입

## 작업 절차
- 커밋 전 `npx tsc --noEmit` 통과 필수
- UI 변경 시 미리보기(launch.json의 `expo-web`, 포트 8090)로 확인
- 기능 단위로 커밋. 브랜치: 태희 = `taehui`, 준희 = `junhee`, 병합 후 `master` 푸시
- 규칙 배포: `npx firebase-tools deploy --only firestore:rules` (프로젝트 ichi-6b8f7)

## 병렬 작업 축 (충돌 방지)
- 태희 축: 인증/시간표/친구/i18n·온보딩 — `authService`, `timetableService`, `friendRequestService`, 관련 화면
- 준희 축: 게시판/쪽지/라운지/신고·차단/테마 — `boardService`, `loungeService`, `chatService`, 관련 화면
- `firestore.rules`·`src/types/` 변경과 규칙 배포는 태희 창구로 일원화
- **크롤러(scripts/) 작업 시**: 적재 데이터는 반드시 `src/types/course.ts`의 `Course` 타입을 따를 것.
  서비스 계정 키는 절대 커밋 금지 (.gitignore에 패턴 등록됨)

## 현재 상태 요약 (2026-08-24 기준) — 다음 세션은 여기부터 읽을 것

**진행도: 11월 Phase 2 전 주차 완료.** 다음 관문은 12월 스토어 준비(TestFlight/EAS·자산).
상세·완료 이력은 [docs/ROADMAP.md](docs/ROADMAP.md). 목업은 전부 제거됨(실데이터화 완료).

> **🆕 2026-08-24 세션 변경분 (다음 세션은 이것부터 반영)**
> - **선배 시간표 폐기 + 강의평 집중** 확정(ROADMAP §5). `app/senior-timetables.tsx`·홈 버튼·
>   `listDepartmentTimetables`/`SeniorTimetable`/`gradeFromAdmissionYear` 삭제. **시간표 공개범위=`private`/`friends` 2택**
>   (`department`/`public` 삭제). 친구 겹침 표시는 존치. 관련 죽은 i18n 키 정리됨.
> - **소셜 로그인(구글/X/라인) 코드 추가** — `authService.linkAnonymousWithSocial`/`signInWithSocial`(웹 전용 popup,
>   Microsoft와 동일). **각 프로바이더 Firebase 콘솔 설정 필요**(미설정 시 `auth/operation-not-allowed`) →
>   [docs/SOCIAL-LOGIN-SETUP.md](docs/SOCIAL-LOGIN-SETUP.md). 라인은 OIDC(`oidc.line`).
> - **학교 목록 10개교로 확장**(`src/data/schools.ts`, 한국인 유학생 많은 순 근사). 와세다·게이오는 `.ac.jp` 미사용이라
>   `authService.isUniversityEmail` 예외 도메인 등록.
> - **거래게시판 → 「教科書ゆずり」(교과서 물려받기)** 라벨 확정(boardId `trade` 유지).
> - **약관·방침 자리표시자 전부 확정**: 운영자=Lee Junhee / 관할=東京地方裁判所 / 문의=ddongpig123@gmail.com /
>   최종갱신일=2026年8月24日. `app/terms.tsx`·`app/privacy.tsx`·`docs/legal/*.md`. 스토어 제출용 웹페이지는 Artifact로 발행됨.
> - **verificationLevel 게이팅은 1.0에서 열어둠**(§5 정책, 성장기에 조임) — 코드 변경 없음.
> - **미착수(외부/결정 대기)**: 소셜로그인 콘솔 설정(사용자), 친구 초대 링크(유니버설링크+호스팅→12월 EAS),
>   아이콘 이모지 깨짐(실기기 스크린샷 필요).

> **📌 준희 복귀 인계 (2026-07-27) — 준희 세션은 이 블록부터 읽을 것**
> 준희 휴가 동안 태희 축만 진행(Phase 2 1·2주차 = 공개범위 UI·선배 시간표). 준희 축은 안 건드림.
> **복귀 후 태희와 조율할 것 (우선순위 순):**
> 1. **schoolDomain "global" 부채 — 태희 축(AuthContext) 완료(2026-07-27), 준희 잔여만 남음.**
>    `AuthContext`가 이제 실제 `users.schoolDomain`을 제공: **`schoolDomain: string | null`**(null=「기타」미선택)
>    **+ `schoolReady: boolean`**(프로필 로드 완료) **+ `refreshSchoolDomain()`**(온보딩 저장 후 호출, 이미 연결됨).
>    게시판 화면들은 전부 `if (!schoolDomain) return` 가드가 있어 **null이어도 안 깨짐**(tsc·런타임 확인). 메이지
>    유저는 `schools/meiji.ac.jp/...` 실교 스코프로 동작(기존 global 테스트 데이터는 폐기). **규칙 변경 없음**
>    (경로 와일드카드 그대로). **결정된 정책**: 기타(schoolDomain=null) 유저는 학교 게시판 대신 **유학생 라운지**로.
>    → **준희 잔여**: schoolReady까지 로딩 후, `null`이면 학교 게시판 자리에 "학교 선택" 유도 UI(라운지는 사용 가능)
>    표시. 지금은 가드로 빈 화면만 나옴(크래시 없음). **이걸로 학점관리(Phase 3)도 언락**(CREDIT-TRACKING §6-4).
> 2. **Phase 1b 잔여 (준희 축)** — MODERATION §6: posts/comments 하드삭제(`allow delete`) 규칙 제거,
>    금칙어 리스트 확충, 쪽지(messages) 삭제·금칙어 미적용.
> 3. 태희가 이번에 추가한 것(참고): `timetables.visibility` UI, 선배 시간표(`usersPublic` 학부 쿼리 방식,
>    규칙 배포 없음), `admissionYear` 필드(usersPublic 미러), 학점관리 가드레일(CREDIT-TRACKING §6).

> **📍 ROADMAP 미리보기 안내 (2026-07-26 추가) — pull 후 꼭 읽을 것**
> `docs/ROADMAP.md`가 **항상 source of truth**. 완료=가로줄+초록 체크 배지, 미완료=빈 체크박스로
> 보기 좋게 렌더한 뷰는 `node scripts/roadmap-view.mjs` 실행 → OS 임시폴더에 생성된 HTML을
> **Artifact로 발행**하면 옆 패널에 뜬다(체크박스 `[ ]`→`[x]` 바꾸면 자동으로 완료 스타일).
> ⚠️ **렌더된 미리보기(Artifact)는 발행한 사용자 계정에만 private이라 `git pull`로는 공유 안 됨.**
> 준희 쪽에서 미리보기가 필요하면 pull 후 위 스크립트를 직접 돌려 각자 발행할 것.
> 미리보기가 안 떠도 원본 `docs/ROADMAP.md`를 읽으면 내용은 완전히 동일하니 작업엔 지장 없음.
>
> (이번 세션 추가: 학점관리 아키텍처 가드레일 확정 — [docs/CREDIT-TRACKING.md](docs/CREDIT-TRACKING.md) §6.
> 독립 서브시스템·E2E 저장·입학년도 단일화·global 부채 선행. Phase 3 유지.)

- **실데이터 연동 완료(전부 Firestore)**: 게시판·쪽지·라운지·신고/차단·프로필·테마,
  시간표(`users/{uid}/timetables/{학기키}`)·친구(`friendships`/`friendRequests`)·
  친구 겹침·강의검색(`schools/{sd}/departments/{dept}/courses`, nameGrams 중간일치)·
  크라우드소싱(courses `verified:false` 기여 + `confirms` 서브컬렉션).
- `friendRequestService`는 **실구현 완료**(더 이상 stub 아님). 강의 데이터 20,022건 적재됨.
- 인증: 게스트(익명)→이메일/Microsoft 계정연결(uid 유지). Microsoft 네이티브는 12월 EAS로 이관.

### 다음 세션 시작점 — 12월 스토어 준비 (Phase 2 완료됨)
- [완료] Phase 2 전 주차: 공개범위 UI / (선배 시간표는 폐기) / 강의 한줄평 / 강의 상세.
- **다음: 12월 스토어 준비** — ① TestFlight 베타(EAS Build, 이때 Microsoft·소셜 네이티브 대응) →
  ② 베타 피드백 → ③ 스토어 자산(스크린샷 일/한·앱 설명·방침 공개 URL·심사용 데모 계정) → ④ 12/31 기능 동결.
- 병행 가능(결정 없이): 스토어 문안(앱 설명/키워드) 초안, 소셜로그인 콘솔 설정 가이드는 이미 작성됨.
- 이후: **Phase 2.5 시간표 작성 도우미(2~3월 신입생 시즌)** → **Phase 3 학점관리(5월~, CREDIT-TRACKING)**.

### 반드시 알아야 할 함정 (안 그러면 헤맴)
- **schoolDomain "global" 고정 부채**: `AuthContext.schoolDomain`이 `"global"` 하드코딩.
  게시판은 global 스코프인데 강의는 `meiji.ac.jp` 적재 → 강의검색·**선배 시간표**만 `users.schoolDomain`
  직접조회로 우회 중. 게시판까지 실교 스코프 통일은 미완(ROADMAP 기술부채). **준희 복귀 → 지금 조율 대상**
  (위 📌 인계 블록 1번). 학점관리 Phase 3 착수 선행조건이기도 함(CREDIT-TRACKING §6-4).
- **미래 학기 차단**: `isSemesterAvailable`이 현재보다 미래 학기를 막음. 7월(春학기)엔
  "2026 秋"가 선택 불가 → 秋에 저장한 데이터는 홈에서 안 보임. **검증은 현재 유효 학기(春)로**.
- **verified 승격 방식**: `courses.verified`는 클라가 못 바꿈(규칙). 크라우드소싱은
  `confirms` 개수로 클라가 파생 판정. 서버 자동승격 필요 시 Cloud Functions(Blaze) 필요.
- **웹 검증 시 Metro 재연결**: preview 재시작 후 코드 반영 안 되면 `location.reload()`.
  Alert는 웹에서 no-op이라 화면마다 `notify`/`window.alert` 폴백 씀.

### 협업 상태
- **준희 복귀함(2026-07-27).** 위 📌 준희 복귀 인계 블록 참조 — schoolDomain 부채 해소가 최우선 조율감.
  규칙·`src/types/` 변경·배포는 여전히 **태희 창구 일원화**(준희는 게시판 코드 정합).
- 사용자 직접 처리 대기(§6): 실계정 메일 인증 테스트, 폰 통합 테스트, 약관 자리표시자 3종,
  **선배 시간표 2계정 E2E**(ROADMAP §6, 리스트 population·뷰어 렌더 미검증).
