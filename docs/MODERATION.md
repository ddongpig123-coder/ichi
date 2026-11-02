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
  → **2026-11-02부터 경고가 아니라 차단** (App Store 1.2 리젹 대응, §7). 글·댓글·쪽지·강의평·닉네임·게시판명 전부
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

- [x] 하드 삭제 경로 차단 — **이미 완료됨 (7/28 확인)**. `firestore.rules`의 게시판·라운지
      posts/comments는 전부 `allow delete: if false` (225·231·275·281줄, 各에 물리삭제 금지 주석).
      6개월 보존 원칙이 규칙으로 강제됨. 이 체크리스트 항목이 갱신 안 된 것이었음(실제 규칙과 불일치).
- [ ] 금칙어 리스트 확충: 현재는 시드(ja 12 / ko 10 / 공통 2). 운영하며 통보 내용을
      보고 키울 것. 리스트는 `src/data/bannedWords.ts` 한 곳 (운영 중 상시 작업)
- [x] ~~**쪽지(messages) 금칙어 미적용 확정 (2026-07-27 준희 결정)**~~ → **2026-11-02 뒤집음: 쪽지도 금칙어 차단 적용** (App Store 1.2 리젹, §7). 아래는 당시 근거 기록
  - 근거: 1:1 사적 대화라 공개 게시물 대비 objectionable content 확산 리스크가 낮음.
    Apple 1.2 "필터링 방법" 요건은 게시판/라운지 금칙어 경고 + **전역 신고/차단 + 24시간 대응**으로
    이미 충족(금칙어 자동필터는 심사 필수 아님). 따라서 쪽지에 금칙어 필터는 넣지 않는다.
  - 대신 **신고로 사후 대응** — 이미 구현됨: 쪽지 화면(`messages/[chatId].tsx`) 상대 아바타 탭 →
    `ModerationMenu`(`targetType="message"`, 6종 사유) → `reports` 컬렉션. 차단도 동일 메뉴에서 가능.
  - 쪽지 soft delete: 미적용 유지. `authorUid`는 보존되므로 발신자 정보 개시청구 대응 근거는 확보됨.


## 7. App Store 심사 리젹 대응 기록 (Guideline 1.2 — 2026-10-31 빌드 4)

심사관 메시지: "The app enables users to post content anonymously but does not have the proper
precautions in place." 아래 8개를 **전부** 구현해야 한다고 명시(일부가 아니라 all of the following).

| # | Apple 요구 | 빌드 4 상태 | 빌드 5 조치 (2026-11-02) | 앱 내 위치 (심사 답장에 쓸 것) |
|---|---|---|---|---|
| 1 | Age rating 18+ | ASC 13+ | **ASC에서 18+로 상향** (준희, 메타데이터) | ASC → 앱 정보 → 연령 등급 |
| 2 | EULA 동의 + 무관용 명시 | 동의 화면 있음, 무관용 문구 없음 | 약관 제4조·제7조에 무관용·24h 삭제·추방 명문화. 온보딩 요약에 동일 문구 | 첫 실행 → 言語 → **利用規約への同意**(동의 없이는 진입 불가) · プロフィール → 利用規約 |
| 3 | 필터링 방법 | 금칙어 **경고만** (그대로 투고 가능) | **금칙어 포함 시 투고 차단** (글·댓글·쪽지·강의평·닉네임·게시판명) | 글쓰기에서 금칙어 입력 → 「不適切な表現が含まれています」 → 투고 불가 |
| 4 | 신고 | 있음 | 유지. 완료 메시지에 24시간 대응·삭제·추방 명시 | 글/댓글 「⋯」 → 通報する → 사유 6종 |
| 5 | 차단 | 있음 | 유지 | 「⋯」 → ブロックする · プロフィール → ブロックリスト |
| 6 | 피드에서 즉시 제거 | **없음** | 신고 즉시 해당 글·댓글이 내 화면에서 사라짐 + 「⋯」 → **非表示にする** | 같은 메뉴 |
| 7 | 24시간 내 삭제·추방 | 약관에만 | 약관·신고 완료 메시지·문의 화면에 명시. 운영: `reports` 당번제(§2) | — (운영 약속) |
| 8 | 앱 내 연락처 | 문의 폼은 있으나 메일 주소 비노출 | 문의 화면에 **ddongpig123@gmail.com** 표시(탭→메일 앱) + 24h 대응 문구 | プロフィール → お問い合わせ · 利用規約 말미 · プライバシーポリシー §10 |

- 비표시(hidden)는 **단말 로컬(AsyncStorage)** — 본인 외엔 의미 없는 정보라 Firestore 규칙 변경 불필요(태희 창구 거치지 않음).
  key `hiddenContent:v1`, 대상 id = 문서 경로의 마지막 세그먼트(글 id / 댓글 id / 강의평 uid).
- 금칙어 차단으로 바뀌면서 **오탐이 곧 투고 불가**가 됐다. `src/data/bannedWords.ts`에 넣을 단어는 「어떤 문맥에서도
  허용 안 되는 것」만. 일반 단어와 겹치는 표현은 넣지 말 것.
- 운영 의무: **신고 24시간 내 처리**를 약관에 썼으므로 지켜야 한다. Firebase 콘솔 `reports` 확인 → 글 `deleted: true` →
  반복·악질은 Auth에서 계정 비활성화(disable). 처리 결과는 `reports.status`로 남긴다.
- 공개 약관 페이지(gh-pages `terms.html`)도 `docs/legal/terms.html` 기준으로 **준희가 재배포**해야 ASC EULA URL과 앱 내 약관이 일치한다.
