# 친구 초대 링크 — https 링크 + 자동 친구 추가

> 작성 2026-11-05 (준희 결정) · 코드: `src/services/friendInvite.ts` · `app/add-friend.tsx` · `friendRequestService.addFriendByInvite`
> 관련: [MY-TASKS §10-2](MY-TASKS.md) · [OTA-2026-11 §3·§4](OTA-2026-11.md) · [DECISIONS 2026-11-05](DECISIONS.md)

## 0. 결정 (재론 금지)

| 항목 | 결정 |
|---|---|
| 링크 형식 | **https** (`https://ichi-6b8f7.web.app/add-friend?u=<uid>&k=<token>`). 커스텀 스킴(`uni-community://`)은 LINE·카톡에서 파란 링크가 안 돼 폐기 |
| 친구 되는 방식 | **초대한 쪽 승인 없음** (링크를 직접 공유한 것이 본인의 의사표시이므로, 준희). 단 **링크를 연 쪽은 확인 버튼 1번** — 「〇〇さんと友達になりますか？」 → [友達になる] (2026-11-10 변경, §8) |
| 웹에서 열렸을 때 | 친구를 만들지 **않는다**. 사파리의 게스트 계정은 앱 계정과 다른 사람이라 엉뚱한 계정에서 친구가 생기기 때문. 「アプリで開く」와 스토어 버튼만 |
| 유니버설 링크 (탭하면 바로 앱) | ~~1.2 재빌드에서~~ → **1.1.0 빌드에 포함**(N3, 11/14 코드). 네이티브 설정이라 OTA 불가 — §5 |
| 게스트 | 게스트도 친구 추가됨(기능 제한 없음). 추가 직후 「계정 등록 권장」 한 줄 + 버튼 |

## 1. 받는 사람에게 무슨 일이 생기나

| 받는 사람 상황 | 탭하면 |
|---|---|
| 앱 있음 · 링크를 앱 안(쪽지 등)에서 열음 | 앱의 `/add-friend` → 「〇〇さんと友達になりますか？」 → [友達になる] → 「〇〇さんと友達になりました」 → 友達一覧へ ([やめる]면 아무것도 안 생김) |
| 앱 있음 · LINE에서 탭 (iOS) | 사파리에 받는 페이지 → 「アプリで開く」 탭 → 앱이 열리며 위와 동일 |
| 앱 있음 · LINE에서 탭 (Android) | Chrome에 받는 페이지 → 「アプリで開く」(intent URL) → 앱 |
| 앱 없음 (iOS) | 받는 페이지 → 「App Storeでダウンロード」. **설치 후 링크를 한 번 더 탭**해야 친구가 됨 (설치 전 정보를 앱까지 넘기려면 외부 서비스 필요) |
| 앱 없음 (Android) | Play 비공개 테스트 중이라 「Android版は近日公開予定」. 공개되면 `PLAY_STORE_PUBLIC = true` + 웹 재배포 |
| PC | 「スマホで開いてください」 |
| 이미 친구 | 「すでに友達です」 |
| 본인 링크 | 「あなた自身の招待リンクです」 |
| 토큰 불일치·오래된 링크 | 「無効な招待リンク」 (#50 규칙 배포 후부터 실제로 걸러짐) |

## 2. 구현

- **`users/{uid}.inviteToken`** (본인만 읽는 비공개 문서) — `getOrCreateInviteToken`이 처음 공유할 때 `expo-crypto` UUID로 만들어 저장. 링크의 `k=`가 이 값. **「링크 무효화」가 필요해지면 이 값을 새로 만들면 된다** (UI는 추후)
- 받는 쪽은 `friendships/{pairId}`에 `{ participants, createdAt, via: "invite", inviteToken }`을 **직접 생성**. 현재 배포 규칙(11/02)은 participants·pairId만 보므로 그대로 통과
- 상대가 나에게 보낸 `pending` 신청이 남아 있으면 `accepted`로 정리 (내가 보낸 것은 규칙상 못 건드림)
- 웹 받는 페이지는 같은 `app/add-friend.tsx`의 `Platform.OS === "web"` 분기. 상수(`WEB_ORIGIN`·`APP_STORE_URL`·`PLAY_STORE_PUBLIC`)는 `friendInvite.ts`

## 3. ✅ 규칙의 초대 경로 — #50 에 반영 완료 (2026-11-06, 태희)

#50 은 「승인된 `friendRequest` 가 있어야만 `friendships` 생성」으로 조이는 PR 이라, 그대로 배포하면 초대 링크가 전부 `permission-denied` 로 죽는다. `firestore.rules` 의 `match /friendships/{pairDocId}` 를 **(b) 초대 링크 || (a) 승인된 신청** 으로 바꿔 넣었다. 실제로 들어간 조건:

```
function otherOf(me, parts) { return parts[0] == me ? parts[1] : parts[0]; }

function isInviteFriendship(d) {
  let token = d.get('inviteToken', '');
  return d.get('via', '') == 'invite'
    && token is string
    && token.size() >= 16
    && token == get(/databases/$(database)/documents/users/$(otherOf(request.auth.uid, d.participants))).data.get('inviteToken', '');
}

allow create: if isSignedIn()
  && request.resource.data.participants.size() == 2
  && request.auth.uid in request.resource.data.participants
  && request.resource.data.participants[0] != request.resource.data.participants[1]
  && pairDocId == pairId(request.resource.data.participants[0], request.resource.data.participants[1])
  && (isInviteFriendship(request.resource.data)       // (b) 초대 — 먼저 평가
      || isAcceptedFriendship(request.resource.data)); // (a) 승인된 신청
```

### 처음 초안에서 고친 2곳 (⚠️ 다시 쓸 때 빠뜨리지 말 것)

| 추가한 조건 | 왜 |
|---|---|
| `participants[0] != participants[1]` | 🔴 **자기 자신과 친구가 됐다.** 토큰 검증은 「상대의 토큰과 같은가」인데 `participants: [me, me]` 면 상대가 나 자신이고, **내 토큰은 내가 아니까** 그냥 통과한다 |
| `participants.size() == 2` | 1명짜리 배열을 `participants[1]` 에 닿기 전에 거부 |

### 🔑 두 가지 순서/문법 주의

- **(b) 를 (a) 보다 먼저 둔다.** (a) 의 `getAfter` 는 `requestId` 가 없으면 **에러**가 난다. 초대 링크는 `requestId` 를 안 보내므로 (a) 를 먼저 두면 전부 그 에러에 휩쓸려 거부된다. 에뮬레이터에 「정상: 초대 링크로 친구 (requestId 없음)」 케이스로 고정해 뒀다
- **필드는 `d.get(필드, 기본값)` 으로만 읽는다.** 없는 필드를 직접 만지면 에러=거부가 되어, `via` 를 안 보내는 승인 플로우(a)까지 같이 죽는다

### 그 밖에

- `users` 문서는 본인만 읽지만 **규칙의 `get()` 은 읽을 수 있다** (클라이언트에 토큰이 새지 않음). 승인 플로우(a)는 이 `get()` 을 타지 않는다
- `src/types/user.ts` `UserProfile.inviteToken?: string` → **#78 로 머지 완료**. 규칙은 OTA 뒤에 배포해야 해서 타입만 먼저 분리했다
- `users` update 규칙은 `verificationLevel` 만 막으므로 `inviteToken` 쓰기는 지금도 허용됨. 변경 없음
- 해제 뒤에도 같은 링크로 다시 친구가 될 수 있음 → §6. 테스트에 「의도된 동작」으로 명시해 뒀다
- 검증: `scripts/rules-test` 에뮬레이터 **131/131** (친구 31건에 초대 공격 12건 포함)

## 4. 운영 순서 (이번 OTA)

1. PR 머지 → `npx tsc --noEmit`
2. **`npm run deploy:web`** (준희 직접·정지선) — 링크가 가리키는 웹 페이지를 **OTA보다 먼저** 올린다. 확인: `https://ichi-6b8f7.web.app/add-friend?u=test&k=test` 가 「無効な招待リンク」를 보여주면 OK
3. `eas update --branch production` (OTA-2026-11 §4)
4. 실기기 테스트: 友達 탭 → 招待リンクで追加 → LINE으로 나에게 전송 → **파란 링크로 보이는지** → 다른 계정(또는 태희) 폰에서 탭 → 앱이 열리고 友達一覧에 들어오는지
5. Android 프로덕션 공개 후 → `PLAY_STORE_PUBLIC = true` → 웹 재배포 (11/14 에 공개 전인데 켰다가 되돌림)

## 5. 링크를 누르면 바로 앱 (N3) — ✅ 11/14 코드, 1.1.0 빌드에 들어감

| 할 일 | 상태 |
|---|---|
| iOS `ios.associatedDomains: ["applinks:ichi-6b8f7.web.app"]` | ✅ `app.json` |
| 웹 `/.well-known/apple-app-site-association` (`3498G5A326.jp.timetable.app`, `/add-friend`) | ✅ `web/well-known/` → `deploy-web.mjs` 가 복사, `firebase.json` 에 `Content-Type: application/json`·`.well-known` 업로드 허용 |
| Android `intentFilters` (autoVerify, https, `ichi-6b8f7.web.app`, `/add-friend`) | ✅ `app.json` |
| 웹 `/.well-known/assetlinks.json` | ⏳ **서명 인증서 SHA-256 2개 대기**(준희, Play Console → 설정 → 앱 무결성 → 앱 서명). 가짜 값이 남아 있으면 배포 스크립트가 안 올린다 |
| 개발용 앱(大学の森 dev) | 링크를 가로채지 않게 둘 다 뺌(`app.config.js`) |
| 앱 쪽 코드 | 변경 없음 — expo-router 가 `https://…/add-friend?u&k` 를 그대로 `app/add-friend.tsx` 로 연다(§8 확인 버튼 흐름) |

- 확인(11/14): prebuild(본 앱 entitlements·매니페스트에 들어감 / dev 앱엔 없음) · 호스팅 에뮬레이터(AASA 200·`application/json`·JSON 정상, assetlinks 는 보류 중이라 404)
- 🔴 순서: **`npm run deploy:web`(AASA 공개) → 새 빌드 설치**. iOS 는 앱을 설치·업데이트할 때 Apple CDN 에서 AASA 를 받아 간다(반영까지 최대 하루)
- 실기기 확인은 다음 시험판(beta) 빌드에서: LINE 에 링크 보내기 → 탭 → 사파리 없이 앱의 「〇〇さんと友達になりますか？」
- 웹 받는 페이지는 앱 없는 사람·옛 앱(1.0.0)용으로 그대로 둔다

### (이력) 1.2 재빌드에서 할 것 — 당시 계획

- **유니버설 링크 (iOS)**: `app.json` `ios.associatedDomains: ["applinks:ichi-6b8f7.web.app"]` + 웹에 `/.well-known/apple-app-site-association` (appID = `<TeamID>.jp.timetable.app`, paths `/add-friend*`). `scripts/deploy-web.mjs`가 이 파일도 복사하도록
- **앱 링크 (Android)**: `android.intentFilters` (autoVerify, https, host `ichi-6b8f7.web.app`, path `/add-friend`) + 웹에 `/.well-known/assetlinks.json` (서명 인증서 SHA-256)
- 되면 LINE에서 탭 → 사파리 안 거치고 바로 앱. 웹 받는 페이지는 앱 없는 사람용으로 그대로 둔다
- ✅(N5, #122) **App Store 言語 표기 「英語」 수정**: `ios.infoPlist.CFBundleDevelopmentRegion: "ja"`, `CFBundleLocalizations: ["ja","ko"]` (+ `locales`). 바이너리 설정이라 OTA 불가
- 대안 검토: 6자리 **초대 코드** (설치 후 링크 재탭 없이 코드 입력으로 친구). 결정 안 됨

## 6. 알려진 한계

- iOS에서 앱이 **없는** 사람이 「アプリで開く」를 누르면 사파리가 「アドレスが無効です」를 띄움. 페이지 문구로 안내 중. 유니버설 링크(1.2)로 해소
- 링크를 게시판 등 공개 장소에 올리면 누구나 친구가 될 수 있음. 공유한 본인 책임이고 해제는 자유.
  → ✅ **2026-11-09 재발급 UI 추가**로 보강됨 (§7)

## 7. 초대 링크 재발급 (2026-11-09, 태희)

**문제**: 토큰은 한 번 만들면 영구였다. 만료도 횟수 제한도 없고 되돌릴 방법도 없었다.
네이티브는 링크를 열면 **승인 없이 바로 친구**가 되고, 친구는 `visibility: "friends"` 시간표를 본다.
→ 링크가 한 번 새면(단톡 캡처·전달·공개 게시) **그 뒤로 영원히** 누구나 친구가 될 수 있었다.
(SECURITY-1.1 §8-3)

**해결**: 친구 추가 모달에 「招待リンクを作り直す」 — `regenerateInviteToken(uid)` 가
`users/{uid}.inviteToken` 을 새 값으로 덮는다. §3 의 규칙이 링크의 `k=` 를 이 값과 대조하므로
**지금까지 배포한 링크가 전부 그 자리에서 죽는다.**

- 🔴 **취소 불가**라서 반드시 확인 다이얼로그를 거친다(`confirmDialog`, destructive).
  문구: 「今まで配った招待リンクはすべて使えなくなります。この操作は取り消せません。」
- 규칙 변경 **없음** — `users` 는 본인이 쓸 수 있고 `inviteToken` 은 `verificationLevel` 과 달리 제한이 없다.
  즉 **#50 머지·배포와 무관하게 이 UI 는 지금 나가도 된다.** 다만 #50 전에는 토큰 대조 자체가
  없으므로 **재발급해도 옛 링크가 계속 통한다** → 실효는 #50 배포 후부터다
- 검증(웹 미리보기, 2026-11-09): 공유 링크를 재발급 전후로 가로채 **토큰이 실제로 바뀌는 것**을 확인
  (`1c83d0c4…` → `4a6a136d…`). 확인·완료 다이얼로그 문구, 콘솔 에러 0건까지 확인

## 8. 링크를 연 쪽의 확인 버튼 (2026-11-10)

**바꾼 이유**: 원래는 링크를 **여는 순간** 친구가 됐다. 그러면 모르는 사람이 뿌린 링크(게시판·쪽지·QR)를
탭하기만 해도 친구가 되고, 내 시간표(기본 공개 범위 「友達」)가 그 사람에게 보인다.
「링크를 보낸 사람의 승인 생략」(§0)은 그대로 두고, **「링크를 연 사람의 확인」만 되살렸다.**

| 상황 | 화면 |
|---|---|
| 처음 연 링크 | 아바타 + 「〇〇さんと友達になりますか？」 + 「友達になると、お互いの時間割（公開範囲が「友達」のもの）が見られるようになります。」 + [友達になる] / [やめる] |
| [友達になる] | 「友達に追加しています…」 → 「〇〇さんと友達になりました」 (게스트면 계정 등록 권장 한 줄) |
| [やめる] · 뒤로 | 友達一覧으로. 아무것도 쓰지 않는다 |
| 내 링크 · 이미 친구 · 무효 | 확인 없이 바로 결과 (전과 같음) |
| 실패 | 「もう一度試す」 = 확인 없이 다시 추가 |

- 코드: `checkInviteStatus`(읽기만, 확인 화면 전 판정) → `addFriendByInvite`(쓰기). 규칙 변경 없음
- 🔑 **친구 목록 반영은 #89 의 friendships 실시간 구독이 그대로 한다** — 이번 변경은 「언제 쓰느냐」만 바꿨고,
  쓰는 문서(`friendships/{pairId}`)·필드는 전과 같다. 추가 직후 `refresh()` 도 그대로 호출
- 연타 방지: 버튼을 두 번 눌러도 한 번만 쓴다(`busyRef`)
- 웹 받는 페이지 문구: 「すぐに友達に追加されます」 → 「友達に追加できます」
