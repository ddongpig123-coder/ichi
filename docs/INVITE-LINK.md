# 친구 초대 링크 — https 링크 + 자동 친구 추가

> 작성 2026-11-05 (준희 결정) · 코드: `src/services/friendInvite.ts` · `app/add-friend.tsx` · `friendRequestService.addFriendByInvite`
> 관련: [MY-TASKS §10-2](MY-TASKS.md) · [OTA-2026-11 §3·§4](OTA-2026-11.md) · [DECISIONS 2026-11-05](DECISIONS.md)

## 0. 결정 (재론 금지)

| 항목 | 결정 |
|---|---|
| 링크 형식 | **https** (`https://ichi-6b8f7.web.app/add-friend?u=<uid>&k=<token>`). 커스텀 스킴(`uni-community://`)은 LINE·카톡에서 파란 링크가 안 돼 폐기 |
| 친구 되는 방식 | **승인 없음**. 링크를 연 사람은 바로 친구. 링크를 직접 공유한 것이 본인의 의사표시이므로 (준희) |
| 웹에서 열렸을 때 | 친구를 만들지 **않는다**. 사파리의 게스트 계정은 앱 계정과 다른 사람이라 엉뚱한 계정에서 친구가 생기기 때문. 「アプリで開く」와 스토어 버튼만 |
| 유니버설 링크 (탭하면 바로 앱) | **1.2 재빌드**에서. 네이티브 설정이라 OTA 불가 |
| 게스트 | 게스트도 친구 추가됨(기능 제한 없음). 추가 직후 「계정 등록 권장」 한 줄 + 버튼 |

## 1. 받는 사람에게 무슨 일이 생기나

| 받는 사람 상황 | 탭하면 |
|---|---|
| 앱 있음 · 링크를 앱 안(쪽지 등)에서 열음 | 앱의 `/add-friend` → 즉시 친구 → 「〇〇さんと友達になりました」 → 友達一覧へ |
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

## 3. 🔴 태희 — #50 규칙에 초대 경로를 넣어야 한다

#50은 「승인된 `friendRequest`가 있어야만 `friendships` 생성」으로 조이는 PR. 그대로 배포하면 **초대 링크가 전부 `permission-denied`로 죽는다.** (b) 경로를 같이 넣어 줘.

```
// firestore.rules  match /friendships/{pairDocId}
function otherOf(me, parts) { return parts[0] == me ? parts[1] : parts[0]; }

allow create: if isSignedIn()
  && request.auth.uid in request.resource.data.participants
  && pairDocId == pairId(request.resource.data.participants[0], request.resource.data.participants[1])
  && (
       // (a) 승인된 신청 — #50 본래 조건 (requestId 검증)
       <#50의 조건>
       ||
       // (b) 초대 링크 — 토큰이 초대한 사람의 users.inviteToken과 같을 때
       (request.resource.data.via == 'invite'
         && request.resource.data.inviteToken is string
         && request.resource.data.inviteToken.size() >= 16
         && request.resource.data.inviteToken
            == get(/databases/$(database)/documents/users/$(otherOf(request.auth.uid, request.resource.data.participants))).data.inviteToken)
     );
```

- `users` 문서는 본인만 읽지만 **규칙의 `get()`은 읽을 수 있다** (클라이언트에 토큰이 새지 않음)
- `src/types/user.ts` `UserProfile`에 `inviteToken?: string` 추가 (타입은 태희 창구라 코드 쪽은 안 건드림. 서비스는 필드를 직접 읽음)
- `users` update 규칙은 `verificationLevel`만 막으므로 `inviteToken` 쓰기는 지금도 허용됨. 변경 불필요
- 해제(`removeFriendship`) 뒤에도 같은 링크로 다시 친구가 될 수 있음. 막고 싶으면 토큰 재발급 UI (1.2 이후)

## 4. 운영 순서 (이번 OTA)

1. PR 머지 → `npx tsc --noEmit`
2. **`npm run deploy:web`** (준희 직접·정지선) — 링크가 가리키는 웹 페이지를 **OTA보다 먼저** 올린다. 확인: `https://ichi-6b8f7.web.app/add-friend?u=test&k=test` 가 「無効な招待リンク」를 보여주면 OK
3. `eas update --branch production` (OTA-2026-11 §4)
4. 실기기 테스트: 友達 탭 → 招待リンクで追加 → LINE으로 나에게 전송 → **파란 링크로 보이는지** → 다른 계정(또는 태희) 폰에서 탭 → 앱이 열리고 友達一覧에 들어오는지
5. Android 프로덕션 공개 후: `PLAY_STORE_PUBLIC = true` → 웹 재배포

## 5. 1.2 재빌드에서 할 것

- **유니버설 링크 (iOS)**: `app.json` `ios.associatedDomains: ["applinks:ichi-6b8f7.web.app"]` + 웹에 `/.well-known/apple-app-site-association` (appID = `<TeamID>.jp.timetable.app`, paths `/add-friend*`). `scripts/deploy-web.mjs`가 이 파일도 복사하도록
- **앱 링크 (Android)**: `android.intentFilters` (autoVerify, https, host `ichi-6b8f7.web.app`, path `/add-friend`) + 웹에 `/.well-known/assetlinks.json` (서명 인증서 SHA-256)
- 되면 LINE에서 탭 → 사파리 안 거치고 바로 앱. 웹 받는 페이지는 앱 없는 사람용으로 그대로 둔다
- **App Store 言語 표기 「英語」 수정**: `ios.infoPlist.CFBundleDevelopmentRegion: "ja"`, `CFBundleLocalizations: ["ja","ko"]` (+ `locales`). 바이너리 설정이라 OTA 불가
- 대안 검토: 6자리 **초대 코드** (설치 후 링크 재탭 없이 코드 입력으로 친구). 결정 안 됨

## 6. 알려진 한계

- iOS에서 앱이 **없는** 사람이 「アプリで開く」를 누르면 사파리가 「アドレスが無効です」를 띄움. 페이지 문구로 안내 중. 유니버설 링크(1.2)로 해소
- 링크를 게시판 등 공개 장소에 올리면 누구나 친구가 될 수 있음. 공유한 본인 책임이고 해제는 자유. 토큰 재발급 UI로 보강 예정
