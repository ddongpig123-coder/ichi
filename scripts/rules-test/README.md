# firestore.rules 테스트 (에뮬레이터)

**규칙(`firestore.rules`)을 바꾸면 배포 전에 여기서 `npm test`.** 실제 DB는 건드리지 않는다
(로컬에 Firestore 에뮬레이터를 띄워서 시험한다. 프로젝트 ID `demo-…`는 에뮬레이터 전용).

```bash
cd scripts/rules-test
npm install      # 처음 한 번
npm test
```
- **Java(JDK 21 이상)** 가 필요하다 — Firestore 에뮬레이터가 Java로 돈다
- 기본은 저장소 루트의 `firestore.rules`. 다른 파일을 보려면 `node content-and-boards.test.mjs <경로>`
  (이때는 에뮬레이터를 따로 띄워 둘 것: `npx firebase emulators:start --only firestore --project demo-ichi-rules`)
- 실패하면 종료 코드 1 + `FAIL 항목 :: 이유`

| 파일 | 보는 것 |
|---|---|
| `content-and-boards.test.mjs` | 운영 계정 명단(`operators`)·대기 목록(`contentQueue`) 권한과 필드 검증, 학교 게시판·라운지 쓰기, **S3 학교 일치**(타교 게시판 거부) |
| `chats.test.mjs` | 쪽지 — 구 경로 `schools/{sd}/chats`(현재 배포된 앱)와 신 경로 `chats/`(S3) 쓰기, 남의 방·남의 이름 거부 |
| `posts-hardening.test.mjs` | 글·댓글 — 좋아요 수는 ±1만, `authorUid` 등 변경 금지, 글자 수 상한, 시작 카운터 0. **옛날 앱(따로 쓰기)과 새 앱(batch) 둘 다** 통과해야 한다 |

새 규칙을 넣으면 여기에 케이스를 같이 추가할 것 (S5 · 2026-10-30 작성, 2026-10-31 저장소에 추가).
