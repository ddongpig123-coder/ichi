# 소셜 로그인 연동 가이드 (Google / X / LINE)

> 앱 코드는 완료 상태(`src/services/authService.ts`의 `linkAnonymousWithSocial` / `signInWithSocial`).
> 아래 **Firebase 콘솔 + 외부 앱 설정**만 마치면 실제로 작동한다.
> 셋 다 **웹 전용(popup)** — 네이티브(Expo Go/아이폰)는 12월 EAS 빌드 단계에서 대응(Microsoft와 동일).
> 시각화 런북: 세션에서 발행한 Artifact 참조(진행 체크박스·에러 해결표 포함).

## 공통

- **Firebase 프로젝트**: `ichi-6b8f7`
- **공통 콜백/리디렉션 URL**: `https://ichi-6b8f7.firebaseapp.com/__/auth/handler`
- **진입 경로**: Firebase Console → Authentication → Sign-in method
- **승인된 도메인**: Authentication → Settings → 승인된 도메인. `localhost`·`ichi-6b8f7.firebaseapp.com`은 기본 등록(로컬 웹 테스트 바로 가능). 커스텀 도메인 배포 시 추가(안 하면 `auth/unauthorized-domain`).

## 1. Google — 쉬움 (provider id: `google.com`)

1. Authentication → Sign-in method → 새 제공업체 추가 → **Google**
2. 사용 설정 ON
3. 프로젝트 지원 이메일 지정(필수) → `ddongpig123@gmail.com`
4. 저장. 끝. (동의화면 브랜딩은 Google Cloud Console → OAuth 동의 화면에서 선택적으로 조정)

## 2. X (Twitter) — 보통 (provider id: `twitter.com`, OAuth 1.0a)

1. https://developer.twitter.com 에서 개발자 계정 생성(무료 등급으로 로그인 연동 가능)
2. Project + App 생성 → User authentication settings
3. **OAuth 1.0a** 활성화 · App permissions = **Read** · **Request email from users** 체크(이메일 필요 시)
4. **Callback URI** = 공통 콜백 URL · Website URL 입력
5. **API Key**(Consumer Key) / **API Secret** 복사
6. Firebase Console → Authentication → **Twitter** 사용 설정 → API Key/Secret 붙여넣기 → 저장

## 3. LINE — 까다로움 (provider id: `oidc.line`, OpenID Connect)

> LINE은 Firebase 기본 제공 아님 → **OIDC 커스텀 제공업체**로 붙임.
> OIDC는 **Firebase Authentication with Identity Platform** 기능이라, 켤 때 프로젝트가 Identity Platform로 업그레이드될 수 있음(무료 등급 존재, 과금 구조만 확인).

1. https://developers.line.biz → Provider 생성 → **LINE Login** 채널 생성
2. **Channel ID**(=client ID) / **Channel Secret**(=client secret) 확인
3. 채널 설정 → **Callback URL** = 공통 콜백 URL
4. 스코프 `openid` `profile` 활성화 · 이메일 필요 시 **Email address permission** 별도 신청(심사 있음)
   - 이메일 미승인이어도 로그인은 됨 — 코드가 email null 안전 처리(배지만 미부여)
5. Firebase Console → Authentication → 새 제공업체 추가 → **OpenID Connect**
6. 이름(Name)에 **`line`** 입력 → 제공업체 ID가 자동으로 `oidc.line` 이 됨
   - ⚠️ 반드시 `line` 이어야 코드(`OAuthProvider("oidc.line")`)와 일치
7. Grant type **Code flow** · Client ID=Channel ID · Client secret=Channel Secret · **Issuer**=`https://access.line.me` → 저장

## 확인 & 문제 해결

로컬 웹(`npm run web` → localhost:8090) 계정 화면에서 각 버튼을 눌러 popup 확인.

| 에러 코드 | 원인 | 해결 |
|---|---|---|
| `auth/operation-not-allowed` | 제공업체 미활성 | Sign-in method에서 사용 설정 ON |
| `auth/configuration-not-found` | OIDC(라인) 설정 누락/이름 불일치 | 제공업체 ID가 `oidc.line`인지, Issuer/Client 확인 |
| `auth/unauthorized-domain` | 도메인 미승인 | 승인된 도메인에 추가 |
| `auth/popup-blocked` | popup 차단 | 브라우저 popup 허용 후 재시도 |
| `auth/account-exists-with-different-credential` | 같은 이메일 다른 방법 가입 | 기존 방법으로 로그인(코드가 안내 표시) |
| 네이티브에서 "준비 중" | popup은 웹 전용(정상) | 웹에서 테스트. 네이티브는 12월 EAS |
