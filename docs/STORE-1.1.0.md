# 1.1.0 심사 자료 (App Store · Google Play) — 초안 2026-11-14

> 1.1.0 제출(12/12 목표, 빨리 끝나면 앞당김) 때 콘솔에 **그대로 붙여 넣는** 문구와 답안.
> 순서·버전 주의는 [RELEASE-PLAN §4-1·§4-2](RELEASE-PLAN-2026-12.md). 1.0 때 문안은 [STORE-LISTING](STORE-LISTING.md)·[STORE-PRIVACY-LABELS](STORE-PRIVACY-LABELS.md)·[APP-REVIEW-REPLY](APP-REVIEW-REPLY.md).

---

## 1. App Store 「이 버전의 새로운 기능」(What's New)

### 日本語（メイン）
```
・時間割のスクショから授業をまとめて登録できるようになりました。AIが読み取り、確認・修正してから保存できます
・自分の投稿へのコメント・返信、メッセージが届いたときにプッシュ通知でお知らせします（お知らせ・広告の通知は送りません）
・はじめての方向けに「はじめの設定」と使い方ガイドを追加しました
・掲示板をリニューアル。学校の森・みんなの森・留学生の森で、自由掲示板・質問掲示板・ベスト投稿をそろえました
・LINEなどで受け取った友達の招待リンクから、アプリが直接開くようになりました
・起動画面のデザインを新しくし、そのほかの細かな改善を行いました
```

### 한국어
```
・시간표 스크린샷으로 수업을 한 번에 등록할 수 있어요. AI가 읽어 주고, 확인·수정한 뒤 저장해요
・내 글에 댓글·답글이 달리거나 쪽지가 오면 푸시 알림으로 알려 드려요 (공지·광고 알림은 보내지 않아요)
・처음 쓰는 분을 위해 「처음 설정」과 사용법 안내를 추가했어요
・게시판을 새로 단장했어요. 학교의 숲·모두의 숲·유학생의 숲 모두 자유게시판·질문게시판·베스트 글을 갖췄어요
・LINE 등에서 받은 친구 초대 링크를 누르면 앱이 바로 열려요
・시작 화면 디자인을 바꾸고, 그 밖의 작은 부분을 개선했어요
```

### English (U.S., 일본 스토어 보조)
```
- Import your class schedule from a screenshot: AI reads it, and you review and edit before saving
- Push notifications for comments/replies on your posts and for direct messages (no promotional notifications)
- New first-time setup and a short guide to the app
- Refreshed boards: every forest now has a free board, a Q&A board and best posts
- Friend invite links open the app directly
- New launch screen and other improvements
```

### 프로모션 텍스트(선택, 심사 없이 수시 변경)
```
時間割はスクショ1枚で登録。コメントやメッセージは通知でお知らせ。大学生活を、もっとラクに。
```

---

## 2. Google Play 출시 노트 (각 500자 이내)
```
<ja-JP>
・時間割のスクショから授業をまとめて登録（AIが読み取り、確認してから保存）
・自分の投稿へのコメント・返信、メッセージをプッシュ通知でお知らせ（広告の通知はありません）
・はじめの設定と使い方ガイドを追加
・掲示板をリニューアル（自由・質問掲示板、ベスト投稿）
・友達の招待リンクからアプリが直接開くように
</ja-JP>
<ko-KR>
・시간표 스크린샷으로 수업을 한 번에 등록 (AI가 읽고, 확인 후 저장)
・내 글의 댓글·답글, 쪽지를 푸시 알림으로 (광고 알림 없음)
・처음 설정과 사용법 안내 추가
・게시판 새 단장 (자유·질문게시판, 베스트 글)
・친구 초대 링크에서 앱이 바로 열려요
</ko-KR>
<en-US>
- Import your timetable from a screenshot (AI reads it; review before saving)
- Push notifications for comments/replies on your posts and for messages (no ads)
- First-time setup and app guide
- Refreshed boards (free board, Q&A board, best posts)
- Friend invite links open the app directly
</en-US>
```

---

## 3. App Review Notes (App Store Connect → 앱 심사 정보 → 메모) — 교체용

> 데모 계정은 1.0 그대로. **첨부 파일**에 `docs/review/sample-timetable.png`(가짜 시간표) 를 올린다.
> 🔴 제출 전 확인: **데모 계정이 현재 학기(2026 秋)에서 시간표 읽기를 아직 안 썼는지** — 1인·학기당 1회라 이미 썼으면 심사원이 「もう使いました」를 본다.
> 그리고 **데모 계정의 2026 秋 시간표가 비어 있어야** 홈에 입구 버튼이 보인다(아래 노트에 다른 학기로 바꾸는 방법도 적었다).

```
Thank you for reviewing 大学の森 1.1.0. New features and how to test them:

1) Timetable import from a screenshot
- Where: Home. When the selected semester's timetable is empty, tap "時間割のスクショから読み込む".
  (If the demo account already has classes, switch the semester at the top of Home, e.g. "2026年 春学期".)
- Consent: before anything is sent, a screen explains that the chosen image is sent to an AI service
  of Anthropic, PBC (USA) only to read the classes, that we do not store the image or the result,
  and that Anthropic does not use it for training. Nothing is sent until the user taps
  "同意して画像を選ぶ" (Agree and choose an image).
- Test image: please use the attached "sample-timetable.png" (fictitious data, no personal info).
  Expected result: 10 classes placed in the grid + 2 classes listed as "not placed" (on-demand / intensive).
  The user can edit or delete each row, then taps "時間割に保存".
- Limit: once per account per semester (to control cost). Failed or non-timetable images do not count.

2) Push notifications
- Only two kinds: (a) a comment or reply on your own post, (b) a new direct message.
  No promotional or marketing notifications. Message notifications do not include the message text.
- Permission is requested in the first-time setup (step ④ 通知) or in Profile → 通知,
  where each kind can be turned off.

3) Invite links open the app directly (Universal Links: https://ichi-6b8f7.web.app/add-friend?...).
  The user still confirms before becoming friends.

Moderation (Guideline 1.2) — unchanged since 1.0:
- Any post/comment/review: tap "⋯" → 通報する (Report) / 非表示にする (Hide) / ブロックする (Block).
- Direct messages: tap the other user's avatar → 通報する / ブロックする.
- Banned-word filter blocks posting. Reports are handled within 24 hours.
- Profile → お問い合わせ (contact), ブロックリスト, 利用規約, プライバシーポリシー (updated for the AI feature and notifications).
- Account deletion: Profile → Account → Delete account (in-app).
Age rating: 18+.
```

- 시험(11/14): 이 샘플 이미지를 실서버로 읽음 → **10과목 전부 정확 + 「시간표 밖」 2개, 8초**

---

## 4. 개인정보 표시 — 1.0 에서 바뀌는 곳만

1.0 답안: [STORE-PRIVACY-LABELS](STORE-PRIVACY-LABELS.md). 1.1.0 에서 **새로 생긴 데이터 흐름**은 둘이다.
① 시간표 스크린샷 → 우리 함수 → Anthropic(읽기만, 우리 쪽 저장 없음) ② 알림용 푸시 토큰(`pushTokens`, uid 와 연결).

### Apple — App Privacy
| 카테고리 | 1.1.0 답 | 이유 |
|---|---|---|
| **Photos or Videos** | **수집함 · 신원과 연결 안 함 · 추적 안 함 · 목적 = 앱 기능** | 사진은 읽기 요청에만 쓰고 우리 서버엔 안 남는다. 다만 Anthropic 이 남용 방지용으로 일정 기간 보관할 수 있어 「수집 안 함」으로 하면 과소 신고가 된다 |
| Identifiers → Device ID | **선언 안 함(권장)** | Apple 의 Device ID 는 광고 ID 같은 「기기 수준 ID」. 푸시 토큰은 앱 설치 단위 알림 주소라 보통 해당 없음으로 본다. 🔸 보수적으로 가려면 「수집·연결함·앱 기능」으로 추가해도 리젝 사유는 아니다 |
| 나머지 | 1.0 그대로 | — |

### Google — 데이터 보안
| 카테고리 | 1.1.0 답 | 메모 |
|---|---|---|
| **사진 및 동영상 → 사진** | **수집됨 · 공유 안 함 · 선택 사항 · 목적 = 앱 기능** | 「일시적으로 처리됨」은 **아니요**로(Anthropic 보관 가능성 — 보수적으로). 서비스 제공업체 전송은 「공유」가 아니다 |
| **기기 또는 기타 ID** | **수집됨 · 공유 안 함 · 선택 사항 · 목적 = 앱 기능** | 푸시 토큰(Firebase 설치 ID 와 같은 부류로 본다) |
| 나머지 | 1.0 그대로 | 삭제 요청 가능 = 예 |

- 권한 변화: iOS 사진 접근 문구(일·한) / Android `POST_NOTIFICATIONS`(13+), `READ_EXTERNAL_STORAGE`(12 이하만). 카메라·마이크는 막아 둠
- 개인정보처리방침 URL 은 그대로(gh-pages `privacy.html`, 11/14 갱신 완료)

---

## 5. 스크린샷 (권장 2장 교체 — 실기기, 준희)

| 화면 | 문구(일) | 문구(한) |
|---|---|---|
| 시간표 읽기 확인 화면(샘플 이미지로) | スクショ1枚で時間割を登録 | 스크린샷 한 장으로 시간표 등록 |
| 알림 + 프로필 → 通知 | コメント・メッセージをすぐお知らせ | 댓글·쪽지를 바로 알림 |

나머지 5장은 1.0 그대로 써도 된다.

---

## 6. 제출 직전 체크
- [ ] `eas build --profile release` (iOS·Android) — RELEASE-PLAN §4-2
- [ ] 위 1~4 를 콘솔에 입력, 샘플 이미지 첨부
- [ ] 데모 계정: 현재 학기 시간표 비우기 + 시간표 읽기 미사용 확인
- [ ] 안드로이드는 Play 1.0.0 정식 공개가 끝난 뒤에 1.1.0 을 올린다(같은 트랙에 겹치지 않게)
