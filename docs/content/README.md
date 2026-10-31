# docs/content/ — 콘텐츠 운영 작업 폴더

설계는 [../CONTENT-OPS.md](../CONTENT-OPS.md)를 읽을 것 (기술 구현은 §9).

| 무엇 | 어디 | 누가 쓰나 |
|---|---|---|
| 대기 목록 (draft → approved → posted / rejected) | Firestore `contentQueue` — 앱 「プロフィール → コンテンツ管理」에서 승인 | AI 생성 봇 · 준희 |
| AI 생성·예약 게시 봇, 문체 규칙, 주제 목록 | 비공개 저장소 `ddongpig123-coder/ichi-content` | Claude · 준희 |
| **네타장** | 비공개 저장소 `ichi-content`의 `neta.md` (2026-10-30 이동) | **준희** |

⚠️ 2026-10-30부터 **초안·게시 기록·네타는 이 공개 저장소에 두지 않는다.** 누구나 읽을 수 있기 때문이다 (CONTENT-OPS §9-2·§9-3).
이 폴더의 `neta.md`는 더 이상 봇이 읽지 않는다.
