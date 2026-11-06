# firestore.rules 테스트 (에뮬레이터)

**규칙(`firestore.rules`)을 바꾸면 배포 전에 여기서 `npm test`.** 실제 DB는 건드리지 않는다
(로컬에 Firestore 에뮬레이터를 띄워서 시험한다. 프로젝트 ID `demo-…`는 에뮬레이터 전용).

```bash
cd scripts/rules-test
npm install      # 처음 한 번
npm test
```
- **Java(JDK 21 이상)** 가 필요하다 — Firestore 에뮬레이터가 Java로 돈다
- `npm test` 는 `run-all.mjs` 가 이 폴더의 `*.test.mjs` 를 **전부 알파벳 순으로** 돌린다.
  → **테스트 파일만 추가하면 끝.** package.json 에 파일 이름을 적지 않는다(그 한 줄이 PR 끼리 계속 충돌했다)
- 기본은 저장소 루트의 `firestore.rules`. 다른 파일을 보려면 `node run-all.mjs <경로>`
  (한 파일만: `node privacy.test.mjs <경로>`. 이때는 에뮬레이터를 따로 띄워 둘 것:
  `npx firebase emulators:start --only firestore --project demo-ichi-rules`)
- 실패하면 종료 코드 1 + `FAIL 항목 :: 이유`

| 파일 | 보는 것 |
|---|---|
| `content-and-boards.test.mjs` | 운영 계정 명단(`operators`)·대기 목록(`contentQueue`) 권한과 필드 검증, 학교 게시판·라운지 쓰기, **S3 학교 일치**(타교 게시판 거부) |
| `chats.test.mjs` | 쪽지 — 구 경로 `schools/{sd}/chats`(현재 배포된 앱)와 신 경로 `chats/`(S3) 쓰기, 남의 방·남의 이름 거부 |
| `posts-hardening.test.mjs` | 글·댓글 — 좋아요 수는 ±1만, `authorUid` 등 변경 금지, 글자 수 상한, 시작 카운터 0. **옛날 앱(따로 쓰기)과 새 앱(batch) 둘 다** 통과해야 한다 |
| `post-index.test.mjs` | 검색 색인 `postIndex` — 투고와 같은 배치로 작성, 남의 이름·타교 거부, `grams` 개수 검증, **수정·삭제 금지** |
| `privacy.test.mjs` | **개인정보·권한**(SECURITY-1.1 §2-1) — `users` 타인 읽기 금지(이메일·`inviteToken` 보호) · `verificationLevel` 자기 승격 금지 · `usersPublic` 사칭 금지 · `emailIndex` 목록 조회 금지 · 시간표 공개범위 · 차단목록·스크랩 · `operators` 쓰기·list 금지 · `reports`·`inquiries` 읽기 전면 금지 |
| `courses-and-metas.test.mjs` | 강의 마스터(공식 데이터 **수정·삭제 전면 금지**, `verified:true` 생성 금지) · 확인(`confirms` 1인1회) · 강의평(1인1평·rating 1〜5) · 유저 게시판 메타 · **글·댓글 물리삭제 금지** |
| `anonymity.test.mjs` | 익명/기명 투고(S4-4) — 기본은 익명, 기명은 `usersPublic.nickname`과 일치 요구(사칭·금칙어 우회 차단), 익명인데 이름 남기면 거부, **작성 후 변경 금지**. **두 필드 없는 구버전 앱**도 통과해야 한다 |

새 규칙을 넣으면 여기에 케이스를 같이 추가할 것 (S5 · 2026-10-30 작성, 2026-10-31 저장소에 추가).

## 테스트가 「진짜로」 지키고 있는지 확인하는 법 (돌연변이 테스트)

**전부 PASS 는 「규칙이 막고 있다」의 증거가 아니다.** 다른 이유로 통과했을 수 있다.
의심스러우면 규칙을 일부러 약하게 만든 사본으로 돌려서 **해당 케이스만 FAIL 로 뒤집히는지** 본다.

```bash
cp ../../firestore.rules /tmp/weak.rules   # 사본에서 보호 한 줄을 지우거나 if false → if isSignedIn() 으로
node run-all.mjs /tmp/weak.rules           # 노린 케이스만 FAIL 이면 그 테스트는 제 역할을 한다
```

2026-11-07 에 이 방법으로 5곳(users 읽기 · verificationLevel · usersPublic 쓰기 · reports 읽기 ·
courses 수정)을 약하게 만들어 **의도한 9케이스만 FAIL** 로 뒤집히는 것을 확인했다.
(같은 방법으로 SECURITY-1.1 §7 의 `lastCommentId` 문자 제한 구멍을 찾아냈다.)
