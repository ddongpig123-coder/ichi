# docs/content/ — 콘텐츠 운영 작업 폴더

설계는 [../CONTENT-OPS.md](../CONTENT-OPS.md)를 읽을 것. 이 폴더는 실제 데이터가 쌓이는 곳이다.

| 파일 | 내용 | 누가 쓰나 |
|---|---|---|
| `neta.md` | 준희의 날것 아이디어 | **준희** |
| `queue.json` | 소스 감시로 모은 소재 (각색 전) | Claude |
| `drafts/YYYY-MM.json` | 각색 완료, 게시 대기 | Claude → 준희 검수 |
| `posted.json` | 게시 완료 기록 (중복 방지) | `scripts/content/post.mjs` |

⚠️ 아직 `queue.json`·`drafts/`·`posted.json`과 스크립트는 **세션 S5에서 만든다**. 지금은 `neta.md`만 있다.
