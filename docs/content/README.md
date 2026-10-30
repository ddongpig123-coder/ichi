# docs/content/ — 콘텐츠 운영 작업 폴더

설계는 [../CONTENT-OPS.md](../CONTENT-OPS.md)를 읽을 것 (기술 구현은 §9).

| 파일 / 위치 | 내용 | 누가 쓰나 |
|---|---|---|
| `neta.md` | 준희의 날것 아이디어 | **준희** |
| Firestore `contentQueue` | 대기 목록 (draft → approved → posted / rejected) | AI 생성 스크립트 · 준희 |

⚠️ 2026-10-30부터 **초안·게시 기록은 저장소 파일(`queue.json`·`drafts/`·`posted.json`)로 두지 않는다.**
저장소가 공개라서 누구나 읽을 수 있기 때문이다. 대기 목록은 Firestore `contentQueue`에만 둔다 (CONTENT-OPS §9-2).
