# 홈 화면 위젯 「今日の時間割」 (RELEASE-PLAN N4)

> **상태 (2026-11-14)**: ✅ **아이폰 코드 완료** → 다음 시험판(TestFlight) 빌드에서 실기기 확인.
> 안드로이드는 이번엔 안 한다(SDK 57 공식 지원 없음 — §6).
> 근거 문서: Expo 공식 문서 v57 `sdk/widgets`(GitHub 원문 `expo/expo` `docs/pages/versions/v57.0.0/sdk/widgets.mdx` — docs.expo.dev 는 작업 환경에서 막혀 원문으로 읽음) + 패키지 소스.

## 1. 무엇이 보이나

| 크기 | 내용 |
|---|---|
| **작은(2×2)** | 날짜 · 「授業中」(빨강) 또는 「次の授業」(파랑) · 時限·시간 · 과목명 · 교실 · 「ほか○コマ」 |
| **중간(4×2)** | 「今日の時間割」 + 날짜, 오늘 수업 최대 4줄(색 막대·時限·과목·교실, 지금 수업에 「授業中」 표시). 넘치면 **끝난 수업부터 뺀다** |
| **큰(4×4)** | 같은 목록 최대 7줄, 줄마다 시간·교실까지 |
| **잠금화면(직사각형)** | 「次の授業 · 2限 10:50–12:30」 / 과목명 / 교실 |

- 수업 없는 날 「今日は授業がありません」, 다 끝나면 「今日の授業は終わりました」, 시간표가 없으면 「時間割を登録すると…」
- 탭하면 앱 홈. 다크 모드 대응. 앱 언어(일·한)를 따른다. 위젯 갤러리의 이름·설명은 일본어 고정
- 보여 주는 건 **지금 학기**의 시간표(홈에서 다른 학기를 보고 있어도). 교시 시간은 앱 공통 `PERIOD_TIMES`

## 2. 어떻게 움직이나

```
홈 화면이 지금 학기 시간표를 읽음/저장함
  → widgetService.updateTodayWidget()  (아이폰 + 새 앱에서만)
  → 앞으로 7일치 「언제부터 무엇을 보일지」 목록(타임라인)을 만들어 위젯에 넘김
       = 매일 0시 + 각 수업 시작·끝 시각 (7일치 ≈ 7KB)
  → 아이폰이 그 시각마다 위젯을 바꿔 그림 (앱이 꺼져 있어도)
  → 7일이 지나거나 학기가 바뀌는 날엔 「アプリを開くと更新されます」
```
- 같은 내용·같은 시간대면 다시 쓰지 않는다(위젯 새로고침 낭비 방지)
- 로그아웃·계정 삭제 → 홈이 새(게스트) 시간표를 읽으면서 위젯도 비워진다

## 3. 파일

| 파일 | 역할 |
|---|---|
| `src/widgets/TodayTimetableWidget.tsx` | 위젯 화면. `'widget'` 표시 함수 = **앱과 따로 도는 작은 JS 환경**에서 실행 |
| `src/services/widgetService.ts` | 가드(`canUseWidgets`) · 지연 require · 타임라인 계산(`buildTodayTimeline`) |
| `app/(tabs)/index.tsx` | 지금 학기 시간표가 바뀌면 `updateTodayWidget` |
| `app.json` | `expo-widgets` 플러그인 — 위젯 1종 `TodayTimetable`, 크기 4종 |
| `package.json` | `expo-widgets` **57.0.19** · `@expo/ui` **57.0.18** (정확히 고정 — 아래 §5) |

## 4. 지켜야 할 것 (어기면 위젯이 빈 화면이 되거나 옛 앱이 멈춘다)
- 🔴 **위젯 파일을 직접 import 하지 않는다** — 반드시 `widgetService` 경유. `expo-widgets` 는 읽는 순간 네이티브 부품을 찾아서, 부품 없는 **스토어 1.0.0(OTA 로 같은 JS 가 감)**·안드로이드·웹에서 읽으면 멈춘다(AGENTS.md 「새 네이티브 모듈」 규칙)
- 위젯 함수 안에서는 **`@expo/ui/swift-ui` 부품·수식어만**. 훅·import·비동기·**함수 밖 상수** 금지 → 값은 props 로, 도우미는 함수 안에
- Babel 보조 함수가 붙는 문법(객체 `...`펼침·구조 분해·for-of·class) 금지 — 위젯 쪽엔 보조 함수가 없다. import 한 이름을 바꾸지 않는다(`Text as T` ✕)
- 쓸 수 있는 부품: Text·VStack·HStack·ZStack·Spacer·Divider·Rectangle/RoundedRectangle/Capsule/Circle·Image·Label·ProgressView·Gauge·Button·Link (`expo-widgets/ios/Widgets/DynamicView.swift` 목록)

## 5. 검증 (11/14)
- `npx tsc --noEmit` 통과
- `expo prebuild`(임시 복사본): 위젯 확장 타깃 `jp.timetable.app.ExpoWidgetsTarget`, App Group `group.jp.timetable.app` 이 **본체·위젯 양쪽** entitlements 에, 위젯 버전 = 본체 버전(1.1.0)·빌드 번호는 EAS 원격 번호를 따른다
- iOS 번들 분석: 위젯 레이아웃 문자열에 보조 함수 참조 없음(`_jsx`·`_jsxs` 만 — 위젯 환경이 제공) · 네이티브 부품을 찾는 모듈은 **위젯 모듈 → `widgetService` 함수 안 지연 require** 로만 닿음
- **실제 위젯 실행 환경 번들**(`ExpoWidgets.bundle`, 설치된 버전으로 빌드)에 앱 번들의 레이아웃을 넣고 렌더: 4크기 × 6상황 렌더 OK, 모르는 부품 없음 + 타임라인 계산 12건(수업 중→次→끝, 토·일, 7일 뒤, 학기 경계, 한국어) — 전부 통과
- 안드로이드·웹 번들 생성 정상
- 🔸 버전 고정 이유: 최신 `expo-widgets` 57.0.28 은 `@expo/ui` 57.0.26 을 따로 끌고 와 **같은 부품 2벌**이 됐고, 57.0.23 부터 위젯 전용 수식어(widgetURL 등)가 `@expo/ui` 에서 `expo-widgets` 로 옮겨져 **섞어 쓰면 깨진다**. 지금 SDK(expo 57.0.23)가 짝으로 지정한 57.0.19 + 57.0.18 로 맞췄다. SDK 를 올릴 때 둘을 **같이** 올린다

## 6. 남은 것

1. **준희: 시험판 빌드 → TestFlight → 폰 홈 화면에 위젯 추가해서 확인**
   - `eas build --profile beta --platform ios` — **처음엔 새 식별자(위젯용)와 App Group 을 만들지 물어본다 → 전부 Yes**(Apple 로그인 필요)
   - 확인할 것: 갤러리에 「今日の時間割」 → 작은·중간·큰 추가 → 오늘 시간표·「授業中/次の授業」 · 잠금화면 위젯 · 다크 모드 · 탭하면 앱이 열림 · 홈에서 수업을 바꾸면 위젯도 바뀜
2. 안 되면(12/3 판단): `app.json` 에서 `expo-widgets` 플러그인 항목만 빼면 위젯 없이 1.1.0 을 낼 수 있다(앱 코드는 가드돼 있어 그대로 둬도 안전)
3. 안드로이드 위젯: 다음 업데이트에서 별도 라이브러리(`react-native-android-widget` 등) 검토
4. 개발용 앱(大学の森 dev)은 App Group 이 `group.jp.timetable.app.dev` 로 따로 잡힌다(플러그인이 번들 ID 에서 만든다)
