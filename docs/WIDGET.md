# 홈 화면 위젯 (RELEASE-PLAN N4) — 조사 2026-11-14

> 결론부터: **아이폰은 공식 라이브러리로 가능(위험 중간), 안드로이드는 SDK 57 공식 지원이 아직 없음.**
> → **추천: 1.1.0 은 아이폰 위젯만.** 안드로이드 위젯은 다음 업데이트(별도 라이브러리)로.
> 근거 문서: Expo 공식 문서 v57 `sdk/widgets`(GitHub 원문 `expo/expo` main `docs/pages/versions/v57.0.0/sdk/widgets.mdx` — docs.expo.dev 는 이 작업 환경에서 막혀 원문으로 읽음) + 패키지 `expo-widgets@57.0.19` 소스.

## 1. 무엇을 쓰나

| | 아이폰 | 안드로이드 |
|---|---|---|
| 라이브러리 | **`expo-widgets`**(Expo 공식, SDK 57 번들 `~57.0.19`) + `@expo/ui`(SwiftUI 부품) | `expo-widgets` 의 안드로이드 쪽은 **빈 껍데기(10줄짜리 모듈)**, 설정도 `enableAndroid` 옵트인·미완성 → 못 씀. 대안 `react-native-android-widget`(0.26, 커뮤니티) |
| Swift 직접 작성 | 필요 없음 — 위젯 화면을 JSX(`@expo/ui/swift-ui` 의 `Text`·`VStack` 등)로 쓴다 | 대안 라이브러리도 JSX |
| 데이터 전달 | 앱이 `widget.updateTimeline([{date, props}…])` 로 넘긴다(App Group 경유, 플러그인이 자동 설정 `group.jp.timetable.app`) | — |
| 시험 | Expo Go 불가 → **시험판(TestFlight) 빌드 필요** | — |

## 2. 만들 위젯 — 「今日の時間割」
- **작은(2×2)**: 다음 수업 1개 — 시간·과목명·강의실 (오늘 끝났으면 「今日の授業は終わりました」)
- **중간(4×2)**: 오늘 수업 목록(최대 4~5개), 지금 수업 강조
- (선택) **큰(4×4)**: 오늘 전체
- 데이터: 앱이 열릴 때·시간표를 저장할 때, **앞으로 7일치 타임라인**(매일 0시 + 각 수업이 끝나는 시각)을 한 번에 넘긴다 → 앱을 며칠 안 열어도 그날 시간표가 맞게 바뀐다
- 탭하면 앱 홈으로

## 3. 제약 (공식 문서의 「Known limitations」)
- 위젯 함수는 **분리된 런타임**에서 돈다: `@expo/ui/swift-ui` 부품만, **훅·상태·비동기·import·바깥 상수 사용 불가** → 필요한 값은 전부 props 로 넘기고, 상수·도우미는 함수 안에 둔다
- 위젯 확장(extension)이 새 번들 ID(`jp.timetable.app.ExpoWidgetsTarget`)와 App Group 을 쓴다 → **처음 빌드 때 Apple 로그인으로 인증서·식별자 생성**(EAS 가 물어봄 — 준희)
- 🔴 옛 앱(1.0.0) 보호: `expo-widgets`·`@expo/ui` 는 새 네이티브 부품 → 다른 것과 같이 **`requireOptionalNativeModule("ExpoWidgets")` 확인 + 지연 require**(AGENTS.md)

## 4. 위험·일정
| 항목 | 판단 |
|---|---|
| 난이도 | 중간. 코드 반나절~하루 + 시험판 빌드 2~3회(각 30분) |
| 가장 큰 위험 | ① 위젯 확장 서명·App Group 을 EAS 가 처음 만들 때의 설정 문제 ② 분리 런타임 제약을 어겨 위젯이 빈 화면 — 둘 다 **시험판에서 바로 보인다** |
| 심사 위험 | 낮음(흔한 기능) |
| 일정 | 12/3 판단 기한보다 일찍 시작 가능. 안 되면 **설정에서 빼고 1.1.0 을 그대로 낸다**(다른 기능에 영향 없음) |

## 5. 하게 되면 순서 (Claude → 준희)
1. Claude: `expo-widgets`·`@expo/ui` 설치, `app.json` 플러그인(위젯 1종 「今日の時間割」, 작은·중간), 위젯 화면(JSX), `widgetService`(가드 + 7일 타임라인), 홈/시간표 저장 시 갱신, `expo prebuild` 로 확장 타깃 생성 확인
2. 준희: 시험판 빌드 `eas build --profile beta --platform ios`(새 식별자·App Group 질문 → Yes) → `eas submit` → 폰 홈 화면에 위젯 추가해서 확인
3. 개발용 앱(大学の森 dev)은 App Group 이 `group.jp.timetable.app.dev` 로 따로 잡힌다(플러그인이 번들 ID 에서 만든다)
