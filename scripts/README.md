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
# 소량 테스트 (1페이지 = 50과목)
node crawl-syllabus.mjs --category 12 --nendo 2026 --semester 10 --max-pages 1

# 전체 수집 + 단위수까지 (상학부 1학기 ≈ 35분)
node crawl-syllabus.mjs --category 12 --nendo 2026 --semester 10 --details
```

| 인자 | 설명 | 예 |
|---|---|---|
| `--category` | 학부 코드 (아래 표) | `12` |
| `--nendo` | 개강 연도 | `2026` |
| `--semester` | `10`=春 / `20`=秋 / `00`=전체 | `10` |
| `--max-pages` | 최대 페이지 수(테스트용, 생략 시 전체) | `1` |
| `--details` | 상세페이지 방문해 `credits`(単位数) 채움. 과목당 1요청 추가 | |

`sourceUrl`(시라버스 상세 URL)은 `--details` 없이도 리스트에서 자동 추출된다.

### 의도적으로 수집하지 않는 과목 (2026-07 결정)

`Course` 타입이 `day`/`period`를 필수로 요구하므로 아래는 스킵된다. 로그에 스킵 사유가 출력됨.

| 대상 | 예 | 비고 |
|---|---|---|
| 요일·교시가 없는 과목 | 집중강의, `フィールドスタディ`, `スポーツ実習`, 대학원 `〔Ｍ〕` 과목 | 시간표 그리드에 배치 불가 |
| **일요일(日) 과목** | `総合学際演習（４年）` [日 7] | `Day` 타입이 月〜土 6일뿐. 학부당 0~1건 수준 |

`通年`(연간) 과목은 스킵하지 않고 **春·秋 양쪽에 등록**한다 (B안).
강의 검색에서 위 과목들도 노출하려면 `src/types/timetable.ts`의 `DAYS`·`Course` 타입 확장이 필요 — 태희 창구.

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
- 페이지당 50과목. 상학부 1개 학기 ≈ 28페이지 (1,376건)
- "검색결과 1000건 초과" 안내문이 뜨지만 **실측상 전 페이지 접근 가능** (2026-07 검증, 분할 불필요)
- 전체 수집(전 학부 × 2학기)은 저속으로 나눠 실행할 것
- User-Agent에 연락처 명시됨

## 2. Firestore 적재 (load-firestore.mjs)

크롤 JSON을 Firebase Admin SDK로 `schools/{schoolDomain}/departments/{deptId}/courses/{courseId}`에 적재.

```bash
# 키 없이 검증만 (Course 타입·id 중복 체크 + 시뮬레이션)
node load-firestore.mjs --file output/courses-12-2026-10.json --dry-run

# 실제 적재 (서비스 계정 키 필요, firebase-admin 별도 설치)
npm install firebase-admin
node load-firestore.mjs --file output/courses-12-2026-10.json --dept 12 --school meiji.ac.jp
```

- `--school` 기본값은 **`meiji.ac.jp`** — 2026-07 태희와 합의로 확정된 schoolDomain
- `--dept` 기본값은 파일명의 category 코드 (예: 12)

> ⚠️ **firebase-admin v14 주의** (2026-07-22 확인): 구 네임스페이스 API
> `admin.credential.cert(...)`는 ESM에서 `undefined`다. 반드시 modular API
> (`firebase-admin/app`의 `initializeApp`/`cert`, `firebase-admin/firestore`의 `getFirestore`)를 쓸 것.

### 전 파일 일괄 적재

```powershell
Get-ChildItem output\courses-*.json | ForEach-Object {
  $dept = ($_.Name -split '-')[1]
  node load-firestore.mjs --file "output/$($_.Name)" --dept $dept
}
```

같은 파일을 다시 적재해도 문서 ID가 같으므로 덮어쓰기(멱등)라 안전하다.

### ⚠️ JSON 레코드 수 ≠ Firestore 문서 수 (정상)

전 학부 JSON 합계는 **20,022 레코드**지만 Firestore 문서는 **19,672개**다. 350건 차이는 버그가 아니다.

`通年` 과목은 春 검색·秋 검색 양쪽 결과에 나오므로 `courses-{dept}-2026-10.json`과
`-20.json` **두 파일 모두에** 春·秋 2건씩 들어간다. 같은 학부 컬렉션에 적재하면
id(`{courseNumber}-{semester}-{day}{period}`)가 같아 덮어쓰기되어 중복이 자연히 제거된다.

학부별 실제 문서 수를 확인하려면 각 학부의 春·秋 파일 id 합집합 크기를 세면 된다.
(예: 政経 JSON 2,597 → 고유 id 2,445 → Firestore 2,445 ✓)

### 적재 시 크롤 JSON과 달라지는 것 (2026-07-21 결정)

크롤 JSON 자체는 그대로 두고, **적재 순간에만** 아래를 적용한다 (재크롤 불필요).

| 항목 | 처리 |
|---|---|
| `confirmCount` | **제거**. 승격 판정은 `courses/{id}/confirms/{uid}` 서브컬렉션의 문서 수로 파생 |
| `nameGrams` | **추가**. 강의명의 2-gram 배열 — 부분일치 검색용 |

> ⚠️ `makeBigrams`는 앱의 `src/utils/ngram.ts`와 **완전히 동일**해야 한다.
> scripts/는 별도 패키지라 import가 불가능해 복제되어 있다. 한쪽만 고치면
> 적재된 gram과 앱이 만드는 검색 gram이 어긋나 **검색이 조용히 0건**이 된다.
> 사양: NFKC → 소문자 → 공백 제거 → 인접 2글자 슬라이딩 → 중복 제거.

검색 흐름: 앱이 `array-contains`로 대표 gram 1개를 매칭 → 클라이언트에서 전문 포함 재필터.

**주의**: 정규화가 공백을 제거하므로 재필터도 반드시 **정규화된 문자열끼리** 비교해야 한다
(`normalize(name).includes(normalize(query))`). 원문끼리 비교하면
`English Communication` 같은 공백 포함 강의명에서 어긋난다.

정규화 후 1글자인 강의명은 2-gram이 0개라 **영영 검색되지 않는다**. dry-run이 건수를 경고한다.

> ⚠️ **서비스 계정 JSON 키는 절대 커밋 금지** (유출 시 DB 전체 권한 탈취).
> `.gitignore`에 `serviceAccount*.json`, `scripts/keys/` 등록됨. 키는 로컬 `scripts/keys/`에만 둘 것.
> 키 발급: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성

## 다음 할 일

- [x] 상세페이지 크롤로 `credits`·`sourceUrl` 채우기 (`--details`)
- [x] 1000건 제한 검증 → 제한 없음 확인
- [x] `load-firestore.mjs` (dry-run 검증 완료)
- [ ] 秋학기·전 학부 수집 (상학부 春+秋는 수집됨)
- [ ] 실제 Firestore 적재 (서비스 계정 키 + schoolDomain 정책 확정 후)
- [ ] 다른 유명 대학 확장 (구조 다름 — 대학별 파서 분리)
