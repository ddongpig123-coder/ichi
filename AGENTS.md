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

## 불변 제약 (보안)
- `.env`는 절대 커밋 금지 (Firebase 키, Microsoft 클라이언트 ID)
- 비밀번호는 Firebase Auth에 직접 전달만. 앱 코드에서 저장·로깅 금지
- `verificationLevel`은 클라이언트에서 생성 시 0 고정, 수정 금지 (규칙 강제)
- 투고의 `authorUid`는 법적 대응용 — 익명화하거나 제거하지 말 것
- 삭제는 hard delete 대신 `deleted: true` 플래그 (Phase 1부터)

## 작업 절차
- 커밋 전 `npx tsc --noEmit` 통과 필수
- UI 변경 시 미리보기(launch.json의 `expo-web`, 포트 8090)로 확인
- 기능 단위로 커밋. 브랜치: 태희 = `taehui`, 준희 = `junhee`, 병합 후 `master` 푸시
- 규칙 배포: `npx firebase-tools deploy --only firestore:rules` (프로젝트 ichi-6b8f7)

## 현재 상태 요약 (2026-07 기준)
- 실데이터: 게시판/쪽지/프로필 학업정보 (Firestore 연동 완료)
- 목업: 친구 목록, 시간표, 친구 시간표 (8월 실데이터 전환 예정 — ROADMAP 참조)
- `src/services/friendRequestService.ts`는 stub — Phase 1에서 실구현
