# ichi 데이터 스크립트 (scripts/)

앱 번들과 분리된 **로컬 실행 전용** 스크립트 모음. 크롤러·적재 도구가 여기 들어간다.

> ⚠️ **출력은 반드시 `src/types/course.ts`의 `Course` 타입을 따를 것.** 앱 강의 검색 UX가 이 형식을 기준으로 동작한다. 임의 필드 구조 금지.

## 설치

```bash
cd scripts
npm install
```

Node 18+ 필요 (내장 `fetch` 사용).

## 1. 시라버스 크롤러 (crawl-syllabus.mjs)

明治大学 Oh-o! Meiji 공개 시라버스(`/syllabus/search/execute`, 로그인 불필요)를 긁어
`Course[]` JSON으로 저장한다.

```bash
node crawl-syllabus.mjs --category 12 --nendo 2026 --semester 10 --max-pages 1
```

| 인자 | 설명 | 예 |
|---|---|---|
| `--category` | 학부 코드 (아래 표) | `12` |
| `--nendo` | 개강 연도 | `2026` |
| `--semester` | `10`=春 / `20`=秋 / `00`=전체 | `10` |
| `--max-pages` | 최대 페이지 수(테스트용, 생략 시 전체) | `1` |

출력: `scripts/output/courses-{category}-{nendo}-{semester}.json` (git 추적 안 함)

### 학부 코드 (category)

| 코드 | 학부 |
|---|---|
| 11 | 法学部 |
| 12 | 商学部 |
| 13 | 政治経済学部 |
| 14 | 文学部 |
| 15 | 理工学部 |
| 16 | 農学部 |
| 17 | 経営学部 |
| 18 | 情報コミュニケーション学部 |
| 19 | 国際日本学部 |
| 26 | 総合数理学部 |

(대학원·자격과정 등은 상세 폼 참조. 41~ 코드 존재)

### 서버 예의

- 요청 간 **1.5초 딜레이**, 실패 시 **최대 3회 지수 백오프** 재시도 (스크립트 내장)
- 페이지당 50과목. 상학부 1개 학기 ≈ 28페이지
- 전체 수집(전 학부 × 2학기)은 저속으로 나눠 실행할 것
- User-Agent에 연락처 명시됨

## 2. Firestore 적재 (후속 — load-firestore.mjs, 미구현)

크롤 JSON을 Firebase Admin SDK로 `schools/{schoolDomain}/departments/{deptId}/courses/{courseId}`에 적재.

> ⚠️ **서비스 계정 JSON 키는 절대 커밋 금지** (유출 시 DB 전체 권한 탈취).
> `.gitignore`에 `serviceAccount*.json`, `scripts/keys/` 등록됨. 키는 로컬 `scripts/keys/`에만 두고 경로를 env로 주입.

## 다음 할 일

- [ ] `--semester 20`(秋) 및 전 학부 수집
- [ ] 상세페이지 크롤로 `credits`(단위수)·`sourceUrl` 채우기 (현재 null)
- [ ] `load-firestore.mjs`: Admin SDK 적재 (서비스 계정 키 준비 후)
- [ ] 다른 유명 대학 확장 (구조 다름 — 대학별 파서 분리)
