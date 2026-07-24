# 신고·차단·운영 대응 설계 (Phase 0 확정본)

> 목적: (1) App Store 심사 요건(가이드라인 1.2 — UGC 앱) 충족,
> (2) 익명 커뮤니티의 법적 의무(일본 프로바이더책임제한법) 대응,
> (3) 익명성 유지 — 이 세 가지를 동시에 만족하는 구조.

## 1. 원칙: "대외적 익명, 운영상 특정 가능"

- 사용자 간에는 완전 익명 (에브리타임 방식: 글 내 익명 번호는 작성자별 고정)
- 모든 투고는 `authorUid`를 서버에 보존 (이미 구현됨) — 발신자 정보 개시 청구,
  수사기관 요청 등 법적 대응의 근거
- 삭제된 글은 hard delete 하지 않고 `deleted: true` 플래그 + 일정 기간(6개월) 보존
  → **Phase 1 구현 시 삭제 로직을 플래그 방식으로 변경할 것** (현재는 hard delete)

## 2. 신고 (Report)

### 데이터 모델 (`reports/{reportId}` — 규칙 배포 완료)
```ts
{
  reporterUid: string;      // 신고자 (본인 명의만 생성 가능, 규칙 강제)
  targetType: "post" | "comment" | "message" | "user";
  targetPath: string;       // 대상 문서의 전체 경로 (조사용)
  targetAuthorUid: string;  // 피신고자
  reason: "spam" | "abuse" | "defamation" | "privacy" | "illegal" | "other";
  detail: string | null;    // 자유 기술 (선택)
  status: "pending" | "reviewed" | "actioned" | "dismissed";
  createdAt: number;
}
```
- 읽기 전면 금지 (`allow read: if false`) — 신고자·피신고자 모두 열람 불가, 운영자만 콘솔/Admin SDK
- UI: 글/댓글/쪽지의 "…" 메뉴 → 通報する → 사유 선택 → 완료 토스트

### 24시간 대응 체계 (Apple 요건)
- Firebase 콘솔에서 `reports` 컬렉션의 `status == "pending"`을 1일 1회 확인 (당번제: 태희/준희 격일)
- 조치: 해당 글 `deleted: true` 처리 / 반복 위반자는 차단 목록 등재
- MVP 단계에서는 콘솔 수동 운영으로 충분. 신고 급증 시 Cloud Functions 알림(Slack/메일) 추가

## 3. 차단 (Block)

### 데이터 모델 (`users/{uid}/blocks/{blockedUid}` — 규칙 배포 완료)
```ts
{ blockedUid: string; createdAt: number; }
```
- 본인만 읽기/쓰기 — 상대방은 차단당한 사실을 알 수 없음
- **필터링은 클라이언트에서 수행**: 앱 시작 시 내 blocks를 로드 → 게시글/댓글/쪽지
  렌더링 시 `authorUid`가 차단 목록에 있으면 "ブロックしたユーザーの投稿です"로 접기
- Firestore 쿼리 레벨 제외는 불가(not-in 10개 제한)하므로 시도하지 않는다

### UI
- 글/댓글 "…" 메뉴 → ブロック / 프로필 설정에 차단 목록 관리 화면 (해제 가능)

## 4. 법적 대응 절차 (프로바이더책임제한법)

- **삭제 요청·발신자 정보 개시 청구 접수 창구**: 앱 내 문의 메일 주소를 이용약관에 명시
- 접수 시: (1) 대상 글 특정 → `authorUid` 확인, (2) 요청의 법적 근거 검토
  (명예훼손 등 권리침해의 명백성), (3) 임시 조치로 글 비공개 처리 가능
- 로그 보존: `authorUid` + `createdAt`은 투고에 이미 포함. IP 주소는 수집하지 않음
  (Firebase Auth 메타데이터로 간접 대응 가능. 과잉 수집은 APPI 리스크가 더 큼)
- 대응 기록: 처리한 신고/요청은 `reports.status`로 이력 관리

## 5. 콘텐츠 필터링 (Apple 요건 "objectionable content")

- Phase 1: 금칙어 리스트 기반 투고 시 경고 (클라이언트, 일/한 리스트)
- Phase 2 이후: 신고 누적 자동 임시 숨김 (동일 글 신고 N건 → `deleted: true` 대기 상태)
- EULA 동의를 온보딩 첫 화면에 배치 (미동의 시 진입 불가) — Apple이 명시적으로 요구

## 6. 구현 체크리스트 (Phase 1, 9월 3주차)

- [x] 신고 UI (글/댓글/쪽지 "…" 메뉴) + `reportService.ts` — 공통 `ModerationMenu`로 통합 (완료 7/14)
- [x] 차단 UI + `blockService.ts` + 클라이언트 필터링 (`BlockContext.isBlocked`) — 게시글/댓글/쪽지 접기 (완료 7/14)
- [x] 차단 목록 관리 화면 (프로필 → ブロックリスト) (완료 7/14)
- [x] 삭제를 `deleted: true` 플래그 방식으로 (posts/comments) — 완료 7/21.
      게시판·라운지 양쪽에 `softDelete*` 추가, `ModerationMenu`에 본인 글 한정 「삭제하기」,
      목록에서 제외 + 상세/댓글은 묘비 표시. **규칙 변경 불필요**(`canUpdatePost()`가
      본인 업데이트를 이미 허용). 웹 E2E: 삭제 후 같은 URL 재접근 시 문서 잔존 확인
- [x] 금칙어 경고 (투고 전 검사) — 완료 7/21. `bannedWords.ts`(ja/ko 시드) +
      `contentFilter.ts`(NFKC·소문자·공백제거 후 부분일치) + `BannedWordWarning` 모달.
      글·댓글 4개 경로(게시판/라운지 × 작성/댓글)에 연결. 경고이며 차단은 아님
- [x] ~~온보딩 EULA 동의 화면~~ — 이미 9월 1주차에 완료됨 (7/15, `app/onboarding.tsx`
      1단계). 이 체크리스트가 갱신 안 된 것이었음 (7/21 확인)

### 잔여 (다음 세션)

- [ ] 하드 삭제 경로 차단: `firestore.rules`의 posts/comments에 아직 `allow delete`가
      남아 있다. 앱은 호출하지 않지만, 6개월 보존 원칙을 규칙으로도 강제하려면
      제거해야 함 — **태희 창구**(규칙 변경)
- [ ] 금칙어 리스트 확충: 현재는 시드(ja 12 / ko 10 / 공통 2). 운영하며 통보 내용을
      보고 키울 것. 리스트는 `src/data/bannedWords.ts` 한 곳
- [ ] 쪽지(messages)에는 삭제·금칙어 미적용 (1:1이라 우선순위 낮다고 판단)
