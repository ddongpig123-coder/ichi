# Firestore 백업과 복구 (1페이지)

> 작성 2026-11-07 (태희) · 근거 [SECURITY-1.1 §2-3](SECURITY-1.1.md) · 도구 `scripts/backup-firestore.mjs`
> 🔴 **요금제가 Spark(무료)라 자동 백업도 PITR(시점 복구)도 없다.** 지금 데이터가 날아가면 되돌릴 방법이
> 하나도 없다. 규칙으로 물리삭제를 막아 뒀지만(MODERATION §1) **Admin SDK 스크립트는 규칙을 안 거친다**
> — 즉 가장 위험한 건 외부 공격자가 아니라 **우리가 돌리는 스크립트**다.

## 0. 3줄 요약
```bash
cd scripts
node backup-firestore.mjs --estimate     # ① 읽기 몇 건 드는지 (거의 공짜)
node backup-firestore.mjs                # ② 덤프 → ../../ichi-backup/<시각>/
```
복구는 §3. **주 1회**가 목표다(§4).

## 1. 무엇을 받고 무엇을 안 받나

| | | 이유 |
|---|---|---|
| ✅ 받는다 | `users`(+`timetables`·`blocks`·`scraps`) · `usersPublic` · `emailIndex` · `friendRequests` · `friendships` · `reports` · `inquiries` · `chats`(+`messages`) · 글·댓글·좋아요 · `boardMetas` · `operators` · `contentQueue` | **다시 만들 수 없다.** 유저가 쓴 것 |
| ⬜ 기본 제외 | `courses`(2만건+) · `postIndex` | **다시 만들 수 있다.** 강의는 크롤(`scripts/crawl-syllabus.mjs` + `docs/data/`), 색인은 `scripts/backfill-post-index.mjs`. 둘이 전체 문서 수의 대부분이라 받으면 Spark 읽기 한도를 날린다 |

제외분까지 전부 받으려면 `--all`. 단 **읽기 한도(하루 5만)** 를 먼저 `--estimate` 로 확인할 것.

> 🔴 그래서 **이 덤프로 `courses`·`postIndex` 는 복구되지 않는다.** 날아가면 크롤·backfill 로 다시 만든다.
> 복구 순서로는 ① 이 덤프 복구 → ② `backfill-post-index.mjs` → ③ 필요하면 강의 재적재다.

## 2. 받기

```bash
cd scripts
node backup-firestore.mjs --estimate
```
```bash
cd scripts
node backup-firestore.mjs
```

- 키는 `scripts/keys/serviceAccount.json`(없으면 `--key <경로>`). **커밋 금지**
- 출력은 기본 `저장소/../ichi-backup/<UTC시각>/` — **저장소 밖**이다
- 안에 `manifest.json`(언제·무엇을·몇 건) + 컬렉션별 `.jsonl`(한 줄 = 한 문서)
- 읽기 한도 안전장치: 누적 읽기가 `--max-reads`(기본 20000)를 넘으면 **중단**한다
- `--only users` 로 한 컬렉션만

### ⚠️ 덤프 파일의 취급
**이메일 · 쪽지 본문 · 신고 내용 · 초대 토큰(`inviteToken`)이 평문으로 들어 있다.**
- 저장소 안에 두지 말 것 (기본 출력 경로가 이미 저장소 밖)
- 메신저·메일로 보내지 말 것. 다른 PC에 둘 때도 그 PC는 본인 것만
- 오래된 덤프는 지운다 (최근 4주분만 남기면 충분)

## 3. 복구

**기본은 쓰지 않는다.** 먼저 미리보기로 몇 건이 들어갈지 본다.

```bash
cd scripts
node backup-firestore.mjs --restore ../../ichi-backup/2026-11-07T00-00-00-000Z
```
```bash
cd scripts
node backup-firestore.mjs --restore ../../ichi-backup/2026-11-07T00-00-00-000Z --write
```

- **이미 있는 문서는 건너뛴다.** 목적이 「없어진 것을 되살리기」라서다.
  지금 데이터를 덤프 시점으로 **되돌리려면** `--overwrite` (유저가 그 사이에 쓴 글이 사라진다 — 마지막 수단)
- 타임스탬프·참조·바이트는 형을 보존해서 넣는다(문자열로 변하지 않는다)
- `--only users` 로 한 컬렉션만 복구 가능

### 사고 났을 때 순서
1. **멈춘다** — 사고를 낸 스크립트를 먼저 끈다. 돌고 있는 동안 복구하면 또 지워진다
2. **범위를 적는다** — 어느 컬렉션·몇 건·언제부터인지. 유출이면 [§5](#5-유출일-때는-복구가-아니라-신고다)
3. **가장 최근 덤프의 `manifest.json`** 을 보고 그 시점에 몇 건이었는지 확인
4. 미리보기(`--restore` 만) → 숫자가 납득되면 `--write`
5. `node backfill-post-index.mjs` — 색인은 덤프에 없다
6. 앱에서 눈으로 확인(게시판 목록 · 쪽지 · 시간표 · 친구)

## 4. 주기와 기록

- **주 1회**(일요일 밤 등 조용한 시각). 돌린 뒤 `manifest.json`의 건수를 전주와 비교한다
  — **갑자기 줄었으면 그게 사고 신호다**
- Spark 한도를 쓰므로 **앱이 바쁜 시간대는 피한다**
- 자동화는 하지 않는다(서비스 계정 키가 준희 PC에만 있고, 클라우드에 올리면 키가 늘어난다)

| 날짜 | 건수 | 메모 |
|---|---|---|
| 2026-11-07 | (estimate) 대상 627 / 제외 21,140 | `--estimate`만. users 151 · usersPublic 144 · posts 66 · comments 103 · chats 12 · messages 9 · friendships 6 · reports 4 · contentQueue 48 등. 실제 덤프는 아직 |
| **2026-11-09** | **659건 저장** (읽기 1,349) | 🥇 첫 실제 덤프(준희 PC). `~/ichi-backup/2026-11-09T13-02-06-146Z/`. users 193(서브컬렉션 포함) · schools 172(글·댓글·좋아요) · usersPublic 147 · contentQueue 68 · lounges 34 · chats 8 · emailIndex 15 · friendRequests 7 · friendships 7 · reports 4 · inquiries 2 · operators 2. 제외 postIndex·courses |
| | | 돌릴 때마다 한 줄 추가 |

## 5. 유출일 때는 복구가 아니라 신고다

데이터가 **없어진 것**이 아니라 **새어 나간 것**이면 복구와 별개로 절차가 있다 —
[SECURITY-1.1 §4](SECURITY-1.1.md) · [MODERATION §4](MODERATION.md).
요지: 경로 차단(규칙 즉시 배포) → 영향 범위 산정 → **個人情報保護委員会 보고** → 본인 통지.

## 6. 검증 기록

2026-11-07, 에뮬레이터에서 왕복 시험(태희):
- 2·3단 서브컬렉션(글→댓글→좋아요) · 타임스탬프(중첩·배열 안) · `Buffer` · 문서 참조 포함 11문서
- 덤프 → 전부 삭제 → 복구 → **11문서 전부 원래 값과 동일**(제외한 `courses`·`postIndex` 2건만 안 돌아옴 = 설계대로)
- 두 번째 복구는 「이미 있어서 건너뜀 11건」 = 멱등
- `--max-reads` 초과 시 중단 확인

> 🔴 이 시험에서 **버그 1개를 잡았다.** `schools/{학교}`·`schools/{학교}/boards/{게시판}`·`lounges/{숲}` 는
> 실제 문서가 아니라 경로 토막이어서 쿼리에 안 나온다. 처음 판은 쿼리 결과만 따라가서
> **글·댓글·좋아요가 통째로 빠진 채 「성공」이라고 찍었다.** `listDocuments()`로 가상 부모까지
> 따라가게 고쳤다. 백업 스크립트는 **반드시 왕복으로 시험할 것** — 받아지는 것만 보면 속는다.
