# 준희님이 직접 하셔야 하는 일 (Claude가 못 하는 것)

> 작성 2026-10-20 · 목표 **2027-01-15 App Store 제출** (ROADMAP 기준)
> 관련: [LAUNCH-RUNBOOK.md](LAUNCH-RUNBOOK.md) · [STORE-CHECKLIST.md](STORE-CHECKLIST.md) · [STORE-PRIVACY-LABELS.md](STORE-PRIVACY-LABELS.md)
>
> **왜 이 문서가 따로 있나:** 런북은 "앱 출시 전체 절차"고, 이 문서는 그중 **Claude가 대신 할 수 없는 것만** 뽑아
> 리드타임이 긴 순서로 재배열한 것이다. 코드·QA·데이터 추출은 Claude가 하니 여기 없다.

---

## 🔥 지금 주에 시작할 것 — 이것만 늦으면 전체가 밀립니다

### 1. Google Play 폐쇄테스트 인원 12명 모으기

**왜 제일 급한가:** 2023년 11월 정책으로 **신규 개인 개발자**는 프로덕션 출시 신청 전에
**테스터 12명 이상이 20일 연속** 폐쇄(Closed) 테스트에 참여해야 합니다. 돈으로도 코드로도
줄일 수 없는 **유일한 항목**이고, 20일은 달력상 그냥 흘러가야 하는 시간입니다.

**역산 일정**

| 시점 | 할 일 |
|---|---|
| ~2026-11-30 | 테스터 15~20명 Gmail 주소 확보 (12명 필요 + 이탈 대비) |
| 2026-12-01 | 폐쇄테스트 트랙에 업로드 + 테스터 초대 → **20일 카운트 시작** |
| 2026-12-21 | 20일 연속 충족 → 프로덕션 출시 신청 자격 획득 |
| 2027-01-15 | App Store 제출 (iOS와 병행) |

**구체적으로 할 일**
1. 모집 대상: 메이지대 한국인 유학생 커뮤니티 / 카톡방 / 라인 그룹 / 학과 동기.
   ROADMAP의 "베타 협력자 10~20명"과 **같은 사람들로 겸하면 됩니다.**
2. 각자에게서 받을 것: **Gmail 주소** (Play Console 테스터 목록에 이메일로 등록합니다).
   - ⚠️ Google 계정이 아닌 이메일은 안 됩니다. 아이폰 유저도 Gmail만 있으면 테스터 등록은 됩니다만,
     실제 설치·20일 유지는 **안드로이드 기기**가 필요합니다. → **안드로이드 유저 12명 이상**을 세야 합니다.
3. 안내할 내용: "설치하고 20일간 지우지 말아주세요. 가끔 열어주시면 더 좋습니다."
4. 모은 주소는 **커밋하지 마세요** (개인정보). 메모앱이나 스프레드시트에 따로 보관.

> 💡 안드로이드 12명이 안 모이면: iOS만 먼저 출시하고 안드로이드는 나중에 올리는 것도 가능합니다.
> 그 경우 4월 신입생 시즌에 안드로이드가 비는데, 일본 학생 안드로이드 비율이 낮지 않으니
> 가능하면 12명을 채우는 쪽을 권합니다.

---

### 2. Apple 멤버십 활성화 확인 → App Store Connect 앱 생성

**현재 상태:** 결제는 완료, **Active 표시 대기 중**.

1. https://developer.apple.com/account 접속 → 상단에 **Active** 표시되는지 확인.
   - 아직이면: 보통 24~48시간, 가끔 더. 승인 메일을 기다리세요.
   - 48시간 넘었으면 Apple Developer 지원에 문의.
2. Active가 되면 → https://appstoreconnect.apple.com → **My Apps → + → New App**
   - Platform: **iOS**
   - Name: `japan time` (스토어 표시명. `japan time - 時間割`은 부제 포함 형태)
   - Primary Language: **Japanese**
   - Bundle ID: `jp.timetable.app` ← 목록에 없으면 먼저 Certificates, Identifiers & Profiles에서 등록
   - SKU: 아무 문자열 (예: `japantime001`) — 외부에 안 보입니다
3. **값 3개를 받아 적으세요.** 이게 `eas.json`에 들어갑니다:

| 값 | 어디서 보나 |
|---|---|
| `appleId` | Apple 개발자 로그인 **이메일** |
| `appleTeamId` (10자리) | App Store Connect → **Users and Access** → 좌하단 |
| `ascAppId` (숫자) | 방금 만든 앱의 URL 중 `/app/` 뒤 숫자. 또는 App Information 페이지 |

> ⚠️ 번들ID `jp.timetable.app`은 **제출 후 영구 고정**입니다. 지금이 바꿀 수 있는 마지막 시점입니다.

---

### 3. Google Play 신원확인 완료 확인

1. https://play.google.com/console → 로그인 → 알림/설정에서 **신원 확인 상태** 확인
2. 미완료면 여권 또는 재류카드로 본인·주소 확인 진행 (수일 소요)
3. 완료되면 → **앱 만들기**: 앱 이름 `japan time`, 기본 언어 일본어, 무료
4. **서비스 계정 JSON 발급** (EAS가 자동 업로드할 때 필요):
   - Play Console → 설정 → API 액세스 → 서비스 계정 만들기
   - 받은 JSON 파일을 맥 로컬에 저장 → 경로를 `eas.json`의 `serviceAccountKeyPath`에
   - 🔴 **이 JSON은 절대 커밋 금지** (`.gitignore`의 `serviceAccount*.json` 패턴에 해당)

---

## 📦 계정이 풀리면 — EAS 세팅 (맥 터미널)

Claude는 준희님 Expo 계정에 로그인할 수 없어서 이 단계는 직접 하셔야 합니다.

```bash
npm i -g eas-cli
```

```bash
cd ~/ichi && eas login
```

```bash
cd ~/ichi && eas init
```

- `eas init`은 `app.json`에 `extra.eas.projectId`를 자동 기입합니다 → **이건 커밋해도 됩니다.**

### `.env` 만들기 (커밋 금지)

Firebase 키 등을 담습니다. 이미 있으면 건너뛰세요. 없으면 Claude에게 "필요한 env 키 목록 알려줘"
라고 하시면 코드에서 뽑아드립니다. 만든 뒤 EAS 빌드에도 주입해야 합니다:

```bash
cd ~/ichi && eas env:create
```

### `eas.json` 채우기

위 2·3번에서 받아 적은 값을 넣습니다. **Claude에게 값을 알려주시면 제가 파일에 넣어드립니다**
(`appleId`/`appleTeamId`/`ascAppId`/`serviceAccountKeyPath` — 이 4개는 비밀값이 아닙니다).

---

## 📱 빌드 후 실기기 검증 — 웹에서 검증이 안 되는 유일한 영역

**선행 조건 (Firebase 콘솔, 준희님만 가능):**
소셜 로그인 프로바이더를 켜야 합니다. 안 켜면 소셜로그인과 **소셜 계정의 삭제 재인증이 실패**합니다.
→ https://console.firebase.google.com → 프로젝트 `ichi-6b8f7` → Authentication → Sign-in method
→ **Google / X(Twitter) / LINE / Microsoft** 활성화. 설정 절차는 [SOCIAL-LOGIN-SETUP.md](SOCIAL-LOGIN-SETUP.md) 참고.

그다음 Claude가 dev 빌드를 만들어 드리면, 준희님이 실기기에 설치해서 아래를 확인하세요.
**이 항목들은 웹 미리보기로는 검증이 불가능합니다:**

- [ ] 구글 로그인 → 성공
- [ ] X(Twitter) 로그인 → 성공
- [ ] LINE 로그인 → 성공
- [ ] Microsoft 로그인 → 성공 (현재 앱은 "모바일은 준비 중, 웹 이용" 안내 상태)
- [ ] **계정 삭제 → 재인증 요구 → 삭제 완료** (각 소셜 프로바이더별로)
- [ ] 계정 삭제 실패 시 다시 시도 버튼이 눌리는지 (런북 부록에 "재시도 경로 동작함"으로 확인돼 있음)
- [ ] 푸시/빨간 점 알림이 네이티브에서 뜨는지

문제가 있으면 Claude에게 **증상 + 화면 캡처**를 주세요. 코드 수정은 제가 합니다.

---

## 🖼 스크린샷 (실기기 필요 — Claude 불가)

**일본어 / 한국어 2세트**, 각 5장. 앱 언어를 바꿔가며 같은 화면을 찍으세요.

1. **시간표 + 친구 겹침** — 친구 시간표가 겹쳐 보이는 상태
2. **강의 검색 · 강의평** — 리뷰가 달린 강의
3. **질문판** — `受付中` 배지와 베스트앤서가 둘 다 보이는 상태
4. **졸업 마술사** — 학부 선택 + "부족한 영역"이 뜬 화면 (商学部가 데이터 가장 풍부)
5. **라운지 / 쪽지**

> 찍기 전에 더미 데이터를 좀 넣어두세요(게시글·리뷰·친구). 빈 화면은 심사에서도, 홍보에서도 약합니다.
> Firebase 연결이 필요하므로 dev 빌드 설치 후에 찍는 게 맞습니다.

---

## 📝 콘솔 폼 입력 (Claude가 폼을 못 채웁니다)

### App Privacy (Apple) / Data Safety (Google)
[STORE-PRIVACY-LABELS.md](STORE-PRIVACY-LABELS.md)의 표를 **그대로** 옮기세요. 핵심 3개:
- 추적(Tracking): **아니요**
- 사용자에게 연결됨(Linked to You): **예**
- 데이터 삭제 요청 가능: **예** (계정 삭제 기능이 있으므로)

### 연령 등급
UGC(사용자 게시물)가 있으므로 → Apple **17+** / Google **Teen~Mature**.
낮게 매기면 리젝 사유가 됩니다.

### 방침 URL (✅ 이미 살아있음 — 2026-10-20 확인, 셋 다 200)
```
https://ddongpig123-coder.github.io/ichi/privacy.html
https://ddongpig123-coder.github.io/ichi/terms.html
https://ddongpig123-coder.github.io/ichi/support.html
```

### 데모 심사계정
심사자가 로그인해볼 계정이 필요합니다.
- 이메일/비번을 만들어 **심사노트(App Review Information)에만** 적으세요
- 🔴 **비번은 절대 커밋 금지**
- 게시글·시간표 등 더미 데이터를 좀 넣어두면 심사가 수월합니다

---

## 🛑 정지선 — 되돌릴 수 없어서 Claude가 절대 실행하지 않는 것

Claude 설정(`.claude/settings.json`)에서 **deny로 막아둔** 명령들입니다. 준희님이 직접 실행하세요.

| 명령 | 무엇 | 비고 |
|---|---|---|
| `npm run deploy:web` | 프로덕션 웹 배포 | `https://ichi-6b8f7.web.app` 갱신 |
| `npx firebase-tools deploy --only firestore:rules` | Firestore 규칙 배포 | **태희 창구.** 조회수(viewCount)에 필요. 미배포여도 앱은 안 깨짐 |
| `eas submit -p ios` / `-p android` | 스토어 업로드 | 빌드 성공 후 |
| **Submit for Review** | 심사 제출 | 콘솔에서 클릭. **최종 확인 후** |

---

## 📚 便覧 — 준희님만 받을 수 있는 것

메이지 10학부 중 **理工学부·情報コミュニケーション학부 2곳**만 배당표가 앱에 연결돼 있지 않습니다.
이유는 수집을 안 해서가 아니라 **便覧이 비공개**이기 때문입니다:

- 공개된 「履修の手引き」에는 **配当表가 없습니다** (등록 절차 중심)
- 情コミ 手引き의 「設置科目一覧表」는 **연차별 매트릭스에 단위수가 없어** 배당표로 못 씁니다
- 학칙 별표1로 과목→科目群·단위·필수마크는 확보했지만 **配当年次가 없어서**, 학년 필터가 틀리게
  동작하므로 일부러 앱 CAN에 연결하지 않았습니다

→ **便覧 본체는 Oh-o!Meiji(학내 포털) 안에 있습니다.** 로그인 영역이라 Claude는 접근하지 않습니다.

**해주실 일:** Oh-o!Meiji에서 아래 2개 PDF를 받아 `~/ichi/docs/binran/` 에 넣고 알려주세요.
- 理工学部 便覧 (**配当表가 포함된 것**. 「履修の手引き」가 아님)
- 情報コミュニケーション学部 便覧 (동일)

주시면 배당표 추출·검증·앱 연동은 Claude가 합니다 (農·法·政経·文·経営 전부 그렇게 했습니다).
출시 블로커는 아니니 **위의 계정·테스터 작업이 우선**입니다.

---

## ✅ 이번 주 요약 — 딱 3개만

1. **안드로이드 테스터 12명(+여유) Gmail 모으기 시작** ← 가장 급함. 11월 말까지
2. **developer.apple.com 에서 Active 떴는지 확인** → 떴으면 앱 생성 + 값 3개 받아 적기
3. **Play Console 신원확인 상태 확인**

이 3개가 풀리면 나머지(EAS·빌드·스크린샷)는 반나절~하루 작업입니다.
막히는 지점이 생기면 Claude에게 화면 캡처와 함께 물어보세요.
