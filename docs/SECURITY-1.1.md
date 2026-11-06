# 출시 직후 보안·개인정보 강화 — 현황과 할 일 (2026-11-06, iOS 배포 직후)

> 준희: "실제 유저가 늘면 해킹·개인정보 보안을 철저히 하고 싶다. 태희에게 맡긴다." → 이 문서가 태희 지시서.
> **현황은 코드·규칙에서 2026-11-06에 확인한 사실.** 추측은 【추측】으로 표시. 규칙·타입·콘솔 설정은 태희 창구, 스크립트는 준희 PC(서비스 계정 키).

## 0. 지금 이미 돼 있는 것 (유지)
- Firestore 규칙: `users`는 본인만 읽기 · `verificationLevel` 자기 승격 차단 · `reports`/`inquiries` 읽기 전면 금지 · `operators` 쓰기 금지(list도 금지) · 쪽지는 `participants` 기반 · 학교 게시판 쓰기 소속 검증(S3) · 글 카운터 ±1·authorUid 변경 차단·글자 수 상한(11/01) · 검색 색인 검증
- 규칙 회귀 테스트 **7파일 216케이스**(`scripts/rules-test/`: anonymity · chats · content-and-boards · courses-and-metas · post-index · posts-hardening · privacy) — 에뮬레이터, 전부 통과. `npm test` 가 폴더의 `*.test.mjs` 를 자동으로 다 돌린다
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
| 2-1 | ✅ **완료 (2026-11-07, 태희)** — 규칙 테스트를 전 컬렉션으로. 새 파일 2개 **82케이스** 추가: `privacy.test.mjs`(타인 `users` 읽기·`verificationLevel` 승격·`usersPublic` 사칭·`emailIndex` list·타인 시간표 쓰기·차단목록·스크랩·`operators` 쓰기/list·`reports`·`inquiries` 읽기 전부 거부) / `courses-and-metas.test.mjs`(공식 강의 수정·삭제 금지, `verified:true` 생성 금지, `confirms` 1인1회, 강의평 1인1평·rating 범위, 게시판 메타, **글·댓글 물리삭제 금지**). 익명 체크박스는 `anonymity.test.mjs`(S4-4)에서 이미 커버. 🔑 **돌연변이 테스트로 검증** — 규칙 5곳을 일부러 약하게 만들어 의도한 9케이스만 FAIL 로 뒤집히는 것을 확인(방법은 `scripts/rules-test/README.md` 말미) | `scripts/rules-test/` |
| 2-2 | **쓰기 폭주 완화(규칙 수준)**: `users/{uid}.lastPostAt`을 쓰고 글·댓글·쪽지 create에서 `request.time - lastPostAt >= 10s`류 검사. 【추측】 봇·스팸 1차 방어로 충분, 완전 방어는 App Check(§3) | 규칙 + `src/types/user.ts`(태희) + 서비스 1줄(준희) |
| 2-3 | ✅ **완료 (2026-11-07, 태희)** — `scripts/backup-firestore.mjs` + 복구 절차 [docs/BACKUP.md](BACKUP.md). `--estimate`(읽기 비용을 집계 쿼리로 미리 셈) / 덤프 / `--restore`(기본 미리보기·있는 문서는 건너뜀). `courses`·`postIndex` 는 **기본 제외** — 다시 만들 수 있고 둘이 전체의 대부분이라 받으면 Spark 읽기 한도를 날린다. 에뮬레이터 왕복 시험 통과(§6). 🔴 **실행은 키가 있는 준희 PC** | 스크립트 완료 / 실행은 준희 PC |
| 2-4 | ✅ **조사 완료 (2026-11-07, 태희) — 지금 당장 고칠 것은 없다.** 28건을 **앱 번들에 들어가는지**로 갈라 봤다(빌드된 `dist` 번들에서 각 라이브러리 고유 문자열을 grep). **26건은 빌드·CLI 도구**(`@expo/*`·`shell-quote`←react-devtools·`node-forge`·`browserslist`…)로 **출하되는 앱에 안 들어간다.** 🔑 지시서가 확인하라고 한 `@firebase/firestore`·`@grpc/grpc-js` 는 **grpc 자체가 번들에 없다**(0히트 / `webchannel` 2히트 — 웹·RN 은 WebChannel 전송을 쓰고 grpc 는 Node 전용) = **앱 영향 없음**. 🔴 `npm audit` 이 제안하는 「수정」은 **firebase 9.14.0 다운그레이드**(12.14.0 → 9.x)라 **절대 따르면 안 된다**. 실제로 번들에 들어가는 유일한 건 `decode-uri-component`(←`query-string`←`expo-router`, URL 파싱). 패치판 0.5.1 을 `overrides` 로 넣어 봤는데 **0.5.1 이 ESM 전용이라 `query-string@7` 의 `require()` 가 깨져 앱의 모든 URL 파싱이 터진다**(실제로 재현). CJS 패치판은 없다 → **expo-router 58(SDK 58) = 1.2 재빌드까지 보류.** 리스크: 악성 링크를 탭한 본인의 앱이 멈추는 DoS. 데이터 노출 없음 | 조사 완료 → 1.2 로 |
| 2-5 | ✅ **완료 (2026-11-07, 태희) — 고칠 곳 없음.** `src/`·`app/` 의 `console.*` 63곳 전수 확인. 민감어로 걸린 17곳은 전부 **정적 메시지 + 에러 객체**(`console.warn("email lookup failed:", e)` 형태)로, 이메일·uid·본문·비밀번호 값이 들어가는 곳은 **0건**. `authService` 의 `[deleteAccount] 1/4 再認証（パスワード）` 도 단계 이름일 뿐 값이 아니다 | 확인 완료 |

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
[OTA 전] ⑪ 11/02에 물어본 commentCount 건은 ①+② 둘 다로. ② 앱 쪽(댓글 배치 + lastCommentId)은 준희 쪽에서 했고
          단계1 규칙(加算만)도 같은 PR에 넣었으니 검토해줘 → 준희가 OTA 전에 배포. 단계2(existsAfter/getAfter 게이트 + 하한 ①)는 #50에 — SECURITY-1.1 §7
끝난 건 SECURITY-1.1.md 체크박스에 날짜 적어줘.
```

## 7. 댓글 수(`commentCount`) 게이트 — 2단계 (2026-11-06, 태희 #50 리뷰 지적)

**문제**: `likeCount`는 조였지만 `commentCount`는 「±1」만 검사해서, 댓글을 쓰지 않고도 누구나 올리고 내릴 수 있었다(태희가 에뮬레이터에서 공격 확인). 표시만이 아니라 `NotificationsContext`가 「내 글의 commentCount > 전에 본 수」로 빨간 점을 켜므로, 남의 글에 +1을 반복하면 알림이 영구히 울리고, 음수로 내리면 진짜 댓글이 달려도 알림이 안 온다.

**왜 좋아요처럼 못 막나**: 댓글 id가 자동 생성이라 규칙이 「이 쓰기에서 생긴 댓글」의 경로를 모른다. → 클라이언트가 id를 먼저 만들고 글 문서에 `lastCommentId`로 같이 써서 규칙이 그 경로를 보게 한다.

### 단계1 — 이 PR (OTA **전** 배포, 加算만, 구앱 무해)
| 어디 | 무엇 |
|---|---|
| `boardService.createComment` · `loungeService.createLoungeComment` | `doc(commentsCol)`로 id 생성 → **배치**로 댓글 set + 글 `{ commentCount: +1, lastCommentId: id }` |
| `boardService.softDeleteComment` · `loungeService.softDeleteLoungeComment` | **트랜잭션**: 댓글 `deleted:true` + 글 `{ commentCount: -1, lastCommentId: id }`. 글의 count가 이미 0이면 카운터는 안 건드림(0 미만 방지, 옛 데이터 보호) |
| `firestore.rules` `isValidCommentCountChange()` | `affectedKeys.hasOnly(['commentCount','lastCommentId'])` + ±1 + `lastCommentId is string`. **commentCount만 바꾸는 구앱도 통과** |
| 타입 | `Post.lastCommentId?: string` · `LoungePost.lastCommentId?: string` — 태희 창구(#78처럼 한 줄) |

🔴 **배포 순서**: 이 규칙이 OTA보다 먼저 올라가야 한다. 없으면 새 번들의 댓글 쓰기가 `changedOnly('commentCount')`에 걸려 전부 거부된다 → [OTA-2026-11 §4](OTA-2026-11.md) 0번.

### 단계2 — #50 (OTA **후**, 태희)
`lastCommentId`를 필수로 하고 「정말 댓글이 생겼/지워졌나」를 본다. 형태(태희가 다듬어 넣을 것):

```
// canUpdatePost(likePath, commentsPath) — commentsPath 는 '…/posts/{postId}/comments' 문자열
function isValidCommentCountChange(commentsPath) {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  let before = resource.data.get('commentCount', 0);
  let after  = request.resource.data.get('commentCount', 0);
  let id     = request.resource.data.get('lastCommentId', '');
  return changed.hasOnly(['commentCount', 'lastCommentId'])
    && id is string && id.size() > 0
    && (
      // +1: 이 배치에서 새로 생긴 댓글일 때만
      (after == before + 1
        && !exists(path(commentsPath + '/' + id)) && existsAfter(path(commentsPath + '/' + id)))
      ||
      // -1: 이 트랜잭션에서 deleted 가 false→true 로 바뀐 댓글일 때만. 하한 0 (① 포함)
      (after == before - 1 && after >= 0
        && get(path(commentsPath + '/' + id)).data.get('deleted', false) == false
        && getAfter(path(commentsPath + '/' + id)).data.get('deleted', false) == true)
    );
}
```

에뮬레이터 케이스(`scripts/rules-test`): 댓글 없이 +1 → 거부 / 남이 쓴 기존 댓글 id로 +1 → 거부 / 삭제 안 된 댓글 id로 -1 → 거부 / 0에서 -1 → 거부 / 정상 배치(새 댓글 + +1) → 통과 / 정상 트랜잭션(삭제 + -1) → 통과 / `lastCommentId` 없는 구앱 쓰기 → **단계2부터 거부**(OTA 후라 OK).

### 그 밖에 (태희 제안, #50에 같이)
- `tag` 글자 수 상한(`isAuthorEditOfPost`에 `d.tag.size() <= 30`류)
- `likeCount` 하한 0은 옛 데이터(좋아요 문서는 있는데 카운터 0)가 걸릴 수 있어 **카운터 재계산 스크립트 후** 넣는다(태희가 쓰겠다고 함)

### 단계1 동안 남는 구멍
댓글 없이 +1은 여전히 가능(지금과 같음). 음수는 코드 쪽에서 안 내려가지만 규칙 하한은 단계2. 봇(`post-next.mjs`, Admin SDK)은 규칙과 무관.
