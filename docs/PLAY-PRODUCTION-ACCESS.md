# Google Play 프로덕션 액세스 신청 — 설문 답변 초안

> 작성 2026-11-05 (iOS 빌드 5 심사 대기 중에 미리 준비). 비공개 테스트 14일 충족(**11/09경**) 후
> Play Console → **테스트 및 출시 → 프로덕션 → 프로덕션 액세스 신청**에서 묻는 항목에 붙여넣는다.
> 심사자는 글로벌이라 **영어**로 쓴다. 테스터 수·세션 수는 콘솔이 이미 알고 있으니 **숫자를 과장하지 않는다**.
> 공개 저장소이므로 테스터 이름·연락처는 쓰지 않는다. 근거 문서: [QA-FEEDBACK](QA-FEEDBACK.md) · [QA-REVIEW-2026-11-02](QA-REVIEW-2026-11-02.md) · [MODERATION §7](MODERATION.md).
>
> ⚠️ 설문 문항은 Google이 수시로 바꾼다. 아래는 2025~26년 양식 기준이며, 문항이 다르면 **가장 가까운 답을 골라 붙인다**.
> 제출 전에 Play Console **Android vitals**(비정상 종료·ANR)를 한 번 열어보고, 보고된 크래시가 있으면 §4의 「no crashes」 문장을 고친다.

---

## 0. ✅ 실제 붙여넣기용 — 각 300자 이내 (2026-11-09, 준희 신청 중 「300자 제한」 확인)

> 콘솔 문항 칸이 **300자 제한**이라 아래 §1~§6 원문은 그대로 안 들어간다. 이 표를 쓴다. 원문은 근거·참고용으로 남긴다.
> 「No crashes」 문장은 **Android vitals 0건일 때만**. 숫자가 있으면 고쳐서 넣는다.

| 문항 | 글자 수 | 붙여넣을 문장 |
|---|---|---|
| 테스터 모집 방법 | 293 | Recruited personally from my university community (Meiji University classmates and friends, mostly international students) via LINE and KakaoTalk groups. Each tester joined with a Google account via the opt-in link and installed the app on their own Android phone. 12+ testers stayed opted in. |
| 테스터 사용 방식 | 282 | Testers used it like real students: chose their university and faculty, built weekly timetables, searched about 20,000 courses, checked the graduation-credit calculator, posted and commented on anonymous boards, wrote course reviews and sent messages. Feedback came via group chats. |
| 받은 피드백 | 270 | 1) Screen bottoms cut off on some phones. 2) Decorative emoji looked unpolished. 3) Keyboard covered the message input. 4) Some actions failed silently. 5) Other universities saw Meiji's faculty list. 6) Empty screens lacked guidance. 7) Requests for a timetable widget. |
| 피드백 반영 | 273 | All fixed in test updates (Oct 29 - Nov 9): safe-area layout fixed, emoji replaced with a vector icon set, keyboard-aware message input, error + retry instead of silent failures, per-university faculty lists, empty-state hints. Widget is planned for the next store release. |
| (모더레이션 문항이 따로 있으면) | 252 | The anonymous boards have full moderation: banned-word filter, report / hide / block on every post, comment and message, zero-tolerance Terms with a 24-hour response, in-app operator contact, a published account-deletion page and an 18+ content rating. |
| 프로덕션 준비 이유 | 272 | 12+ testers used it on real devices for the full test; every reported issue was fixed and confirmed in later updates. No crashes were reported. UGC has full moderation and published Terms/Privacy. The same app is already live on the Apple App Store (approved Nov 6, 2026). |
| 대상 사용자 | 261 | University students in Japan aged 18+. The first supported university is Meiji University (Tokyo); other universities' course data and boards are being added one by one. A secondary audience is international students (Korean UI is available alongside Japanese). |
| 차별점 | 282 | Most apps offer only one of: a timetable, an anonymous campus board, or course reviews. 大学の森 combines all of them with a timetable shared with friends and a graduation-credit calculator built from each faculty's official handbook, plus a nationwide board for international students. |

---

## 1. 비공개 테스트 운영 (About your closed test)

**Q. How did you recruit testers? / 테스터를 어떻게 모집했나요?**
```
Testers were recruited personally from the developer's own university community: classmates and
friends at Meiji University, mainly Korean international students, through LINE and KakaoTalk group
chats. Each tester received the opt-in link, joined the closed test with a Google account, and
installed the app on their own Android phone. The group was kept at 12 or more opted-in testers for
the whole test period.
```

**Q. How easy was it to recruit testers? (선택형)** → `Somewhat difficult` (사실대로. 안드로이드 기기 사용자 12명을 채우는 데 약 2주 걸렸다)

**Q. How did testers engage with your app? / 테스터는 앱을 어떻게 사용했나요?**
```
Testers used the app the way real students do: they created an account, chose their university and
department, built their weekly timetable, searched the course catalogue (about 20,000 Meiji courses),
checked the graduation-credit calculator, posted and commented on the anonymous boards, wrote short
course reviews and exchanged direct messages. Most testers opened the app several times during the
test period. Feedback was collected in the group chats and in direct conversations, then tracked in
the project's issue list.
```

## 2. 받은 피드백 (Feedback received)

**Q. Summarize the feedback you received from testers.**
```
Main feedback, in order of frequency:
1. The bottom of the Terms of Use and Privacy Policy screens was cut off on iPhones with a home
   indicator; the same layout issue existed on 13 other screens.
2. Decorative emoji throughout the UI (profile, lounge icons, report menu) made the app look
   unpolished; testers asked for a cleaner, consistent icon style.
3. On the direct-message screen the keyboard covered the input field on some devices.
4. Tapping a post author's name did nothing on some accounts, so testers could not start a direct
   message from a board post; failures were silent.
5. Users from universities other than Meiji saw Meiji's faculty list when choosing a department.
6. Placeholder e-mail addresses on the sign-up screen were Meiji-specific and confused other users.
7. Testers who take screenshots of their timetable for their lock screen asked for a home-screen
   widget or an "export as image" option.
8. Several actions failed silently (sending a message, saving the timetable, loading a board when
   offline) and showed an empty list instead of an error.
9. Testers wanted clearer guidance on empty screens (first timetable, empty search, no comments).
10. Minor: tab headers were inconsistent, timetable time labels were too small to read on a phone.
```

## 3. 피드백 반영 (How you used the feedback)

**Q. How did you improve the app based on tester feedback?**
```
All of the feedback above except the native widget has been implemented and shipped to the closed
test track (updates on 2026-10-29, 11-01 and 11-03):
- Safe-area bottom padding fixed on the Terms/Privacy screens and the 13 other screens with the same
  layout.
- All decorative emoji removed; functional icons replaced with a single vector icon set.
- Direct-message input now uses the real header/safe-area height, so the keyboard no longer covers
  it; the list auto-scrolls to the newest message.
- Post authors are now a tappable chip that opens a direct message; when it cannot (school not
  selected, loading), the app explains why instead of doing nothing.
- Department lists are now per university; universities without data hide the department step.
- Sign-up placeholders are neutral; the university e-mail domain is shown only on the verification
  step.
- Message sending, timetable saving and board loading now show an error with a retry action instead
  of failing silently; empty states carry one-line hints.
- Tab headers unified, timetable time labels enlarged, comment counts fixed, date separators added
  in message threads.
- Timetable widget: planned in two steps - "save timetable as image" in the next OTA update, and a
  native home-screen widget in the following store release.
In parallel we strengthened content moderation for the anonymous boards: a banned-word filter that
blocks posting, report / hide / block actions on every post, comment, review and message, a block
list, zero-tolerance Terms with a 24-hour response commitment, an in-app contact screen with the
operator's e-mail, and an 18+ content rating.
```

## 4. 프로덕션 준비 상태 (Why the app is ready)

**Q. Why do you believe your app is ready for production?**
```
- The app has run on real devices with 12+ testers for the full closed-test period; every reported
  issue has been fixed and verified by the testers in later test builds / updates.
- No crashes were reported by testers during the test. (제출 전 Android vitals 확인 후 유지/수정)
- User-generated content is covered by a complete moderation system (filtering, reporting with
  immediate hiding, blocking, 24-hour operator response) and by published Terms of Use and
  Privacy Policy. An account-deletion page is published and linked in the Data safety form.
- The same build is under review on the Apple App Store, with the same policies and content rating.
- Course data (about 20,000 courses for Meiji University) and graduation requirements for 8
  faculties are loaded and verified against the official handbooks.
```

## 5. 대상 사용자 (Target audience)
```
University students in Japan, 18 years and older. The first university supported is Meiji
University (Tokyo); the app is designed to add other universities' course data and boards one by
one. A secondary audience is international students (Korean UI is available alongside Japanese).
```

## 6. 차별점 (How the app differs from similar apps)
```
Existing apps cover only one of these: a timetable, an anonymous campus board, or course reviews.
大学の森 combines in one app (1) a weekly timetable that can be shared with friends, (2) a
graduation-credit calculator built from each faculty's official handbook, (3) course search with
student reviews, and (4) anonymous school boards plus a nationwide lounge for international
students. Everything is in Japanese, with Korean available, and moderation is built in from day one.
```

---

## 제출 체크리스트 (11/09 이후, 준희)
- [ ] **판매자 상태 선언** — 2026년 11월부터 Play Console 계정 요구사항(2026-10-29 정책 공지). 설정 → 개발자 계정 → 계정 세부정보 또는
      대시보드 작업에 떠 있으면 먼저 완료. 무료·판매 없음이라 보통 「판매자 아님(개인)」이지만 화면의 정의대로 선택
- [x] Play Console 프로덕션 페이지에 「14일 충족」 표시 확인
- [x] 위 §0(300자판)을 해당 문항에 붙여넣기 → **✅ 2026-11-09 22:26 JST 제출, 「검토 중」**
- [x] 결과 → **✅ 2026-11-11 07:16 JST 승인 메일** (「Google Play の本番環境へのアクセスが承認されました」)
- [ ] 결과 나올 때까지 **테스터 12명 유지**(심사 중 재확인될 수 있음)

## 승인 후 (프로덕션 출시) — 🔴 2026-11-13 변경: **새 AAB를 빌드해서 올린다** (승격 아님)

~~비공개 테스트의 현재 릴리스를 그대로 승격, 새 빌드 불필요~~ → **폐기.** 그 AAB(버전 코드 2)는 커밋 `159a5b3`(10/25) 코드다.
OTA는 「받아 두고 **다음 실행**부터 적용」이라 **새로 설치한 사람의 첫 실행은 10/25 코드로 돈다**(OTA-2026-11 §0):
옛 화면(이모지·옛 게시판 탭), 쪽지는 옛 경로(상대에게 안 보임), 11/13 배포 규칙(#50)에서 친구 수락이 실패한다.
첫인상이 깨지므로 **master로 새로 빌드**한다. 런타임은 그대로 1.0.0이라 OTA는 계속 닿는다.

1. **[Claude] 이번 빌드에 넣을 네이티브 설정** — `app.json` `android.blockedPermissions: ["com.google.android.gms.permission.AD_ID"]`
   (앱 콘텐츠에 「광고 ID 미사용」으로 신고했는데 라이브러리가 권한을 끼워 넣는 것을 막는다. `expo prebuild` 로
   매니페스트에 `tools:node="remove"` 가 들어가는 것 확인). R8 최적화는 기한 2027-02 라 이번엔 안 켠다
2. **[준희 맥] 빌드** (15~30분, 버전 코드는 EAS 가 자동으로 올림 → 3):
   ```
   cd ~/ichi && git checkout master && git pull
   eas build --platform android --profile production
   ```
   키스토어 질문이 나오면 기존 것 사용(기본값). 끝나면 나오는 링크에서 `.aab` 다운로드
3. **[준희 Play Console] 대시보드 → 「버전 생성 및 게시」**
   1. 국가 및 지역 선택 → **일본**(비공개 테스트와 같게 하려면 + 한국)
   2. 새 버전 만들기 → `.aab` 업로드 → 출시 노트(아래) → 다음
   3. 버전 미리보기 및 확인 → 경고가 있으면 Claude에게 화면 공유 → **검토를 위해 Google에 버전 전송**
   4. Google 검토(보통 1~3일, 길면 7일) → 승인되면 게시(관리형 게시를 켜 두지 않았다면 자동)
4. **[Claude] 출시 후**: `src/services/friendInvite.ts` `PLAY_STORE_PUBLIC = true` → 준희 `npm run deploy:web`
   ⚠️ 11/14 에 공개 전인데 true 로 배포했다가 되돌렸다(Play Console 의 트랙에 「프로덕션」이 있는지로 확인할 것)
   (초대 링크 웹 페이지의 「Android版は近日公開予定」 → Google Play 버튼). `docs/MY-TASKS.md` 📍에 날짜 기록

출시 노트 (각 500자 이내):
```
<ja-JP>
大学の森 Android版を公開しました。時間割・卒業単位の管理、大学ごとの掲示板、友達との時間割共有が使えます。
</ja-JP>
<ko-KR>
大学の森 Android 버전을 공개했습니다. 시간표·졸업 학점 관리, 대학별 게시판, 친구와 시간표 공유를 이용할 수 있어요.
</ko-KR>
<en-US>
大学の森 is now available on Android: timetable and graduation credit tracking, university boards, and timetable sharing with friends.
</en-US>
```
- 비공개 테스트 트랙은 그대로 둬도 된다. 테스터도 더 높은 버전 코드(프로덕션 3)를 받는다
