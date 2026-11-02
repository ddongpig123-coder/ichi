# App Review 답장 문안 — Guideline 1.2 (익명 UGC) 리젹 대응

> 2026-10-31 리젹(빌드 4, Submission 8837b86f) → 빌드 5 재제출용.
> 코드 변경 상세는 [MODERATION §7](MODERATION.md). **아래 문안은 ASC에 그대로 붙여 쓴다** (영어).
> ⚠️ 보내기 전 확인: ① 연령 등급 18+로 바꿨나 ② 빌드 5를 선택했나 ③ gh-pages 약관 재배포했나.

## 1. App Review 페이지 답장 (Reply to App Review)

```
Hello,

Thank you for the detailed review. We have addressed every precaution listed under
Guideline 1.2 for anonymous user-generated content. The new build (1.0, build 5) and
the updated metadata contain the following:

1. Age rating 18+
   The age rating has been changed to 18+ in App Store Connect.

2. Terms (EULA) with a zero-tolerance policy
   On first launch the user must agree to the Terms of Use before using the app
   (Language → "利用規約への同意" → "同意して始める"; the app cannot be entered otherwise).
   The agreement screen and Article 4 / Article 7 of the Terms now state explicitly that
   objectionable content and abusive users are not tolerated (zero tolerance), that such
   content is removed and the user is suspended/ejected. The Terms are also available at
   Profile → "利用規約" and at https://ddongpig123-coder.github.io/ichi/terms.html.

3. Filtering of objectionable content
   Posts, comments, direct messages, course reviews, nicknames and board names are checked
   against a banned-word list (Japanese / Korean / English) before submission. If a banned
   word is detected, the content cannot be posted; the user is shown the words and must edit
   them. (In the previous build the filter only warned; it now blocks.)

4. Flagging objectionable content
   Every post, comment and course review has a "⋯" menu with "通報する" (Report). In direct
   messages, tapping the other user's avatar ("匿") next to a message opens the same menu.
   The user selects one of six reasons (spam, harassment, defamation, privacy,
   illegal/inappropriate, other) and may add details. Reports are stored server-side and are
   only readable by the operator.

5. Blocking abusive users
   The same "⋯" menu offers "ブロックする" (Block). Blocked users' posts, comments and
   messages are no longer shown. The block list can be managed at Profile → "ブロックリスト".

6. Immediately removing posts from the feed
   When a user reports a post or comment, it is removed from that user's feed immediately,
   without waiting for moderation. The "⋯" menu also has "非表示にする" (Hide) to remove any
   post or comment from the feed at once.

7. Acting on reports within 24 hours
   The operator reviews all reports within 24 hours, removes content that violates the Terms
   and suspends (ejects) the offending user. This commitment is stated in the Terms
   (Article 7), in the confirmation shown after a report is submitted, and on the Contact
   screen.

8. Contact information in the app
   Profile → "お問い合わせ" shows the operator's e-mail address (ddongpig123@gmail.com, tap to
   open the mail app) together with an in-app contact form for reporting inappropriate
   activity. The same address appears at the end of the Terms of Use and in the Privacy
   Policy (Section 10).

How to verify (demo account in App Review Information):
- Sign in with the demo account, open any board (掲示板), tap a post, then tap "⋯" at the top
  right of the post or next to a comment → 通報する / 非表示にする / ブロックする.
- To test the filter, create a post containing a word such as "fuck" or "死ね": the app shows
  "不適切な表現が含まれています" and the post cannot be submitted.
- In a direct message (メッセージ tab → a conversation), tap the "匿" avatar next to the other
  user's message → 通報する / ブロックする.
- Profile tab (プロフィール) → お問い合わせ shows the contact e-mail; → 利用規約 shows the
  zero-tolerance Terms; → ブロックリスト manages blocked users.

Please let us know if anything else is needed.

Best regards,
Junhee Lee
Developer, 大学の森
```

## 2. App Review Information → Notes (심사 노트 교체분)

데모 계정 이메일/비번은 기존 그대로 두고, 아래를 Notes에 추가/교체한다.

```
This app is a university community app with anonymous boards. Moderation features
(Guideline 1.2):
- First launch: Language → Terms agreement (mandatory, zero-tolerance policy) → School.
- Any post/comment/review: tap "⋯" → 通報する (Report, 6 reasons) /
  非表示にする (Hide from feed immediately) / ブロックする (Block user).
- Direct messages: tap the "匿" avatar next to the other user's message → 通報する / ブロックする.
- Reported content disappears from the reporter's feed immediately.
- Banned-word filter (JA/KO/EN) blocks posting; try a post containing "fuck" or "死ね".
- Profile → お問い合わせ: operator e-mail (ddongpig123@gmail.com) + contact form.
- Profile → ブロックリスト: manage blocked users. Profile → 利用規約 / プライバシーポリシー.
- Reports are handled by the operator within 24 hours (content removed, user suspended).
- Age rating: 18+.
Most content can be browsed as a guest; posting requires the (anonymous) account created
automatically on first launch. Demo account below has sample posts and comments.
```

## 3. 재제출 체크리스트 (준희) — **2026-11-02 전부 완료, 심사 대기 중**

- [x] PR 머지 → master (2026-11-02)
- [x] ASC 연령 등급 18+ (2026-11-02)
- [x] gh-pages `terms.html` 재배포 (2026-11-02, 최종갱신일 2026年11月2日)
- [x] `eas build --platform ios --profile production` → 빌드 5 (`78321824…`, 커밋 `6ba8c4b`) → `eas submit` (2026-11-02)
- [x] ASC: 빌드 5 선택, Notes 교체(§2), 답장(§1) → 앱 심사에 다시 제출 (2026-11-02, Submission 8837b86f)
- [~] 제출 후 매일 Firebase 콘솔 `reports` 확인 (24시간 약속) — 11/02 첫 점검: 테스트 4건 `dismissed`, `pending` 0건
