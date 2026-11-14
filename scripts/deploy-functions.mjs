// Cloud Functions 배포 — npm run deploy:functions   (준희 직접, 정지선)
//
// release-guard.mjs 의 확인(루트·master·원격과 같음·변경 없음·타입 검사·y)을 통과하면
//   1) functions/ 의존성 설치(npm ci) — 배포 명령이 함수 코드를 로컬에서 한 번 읽어 보기 때문에 필요
//   2) functions/ 단위 테스트
//   3) npx firebase-tools deploy --only functions --project ichi-6b8f7
//
// 처음 한 번만 필요한 준비 (docs/TIMETABLE-OCR.md §5):
//   - Firebase 를 Blaze(종량제)로 전환 + 예산 알림
//   - AI 키를 서버 비밀값으로 등록: npx firebase-tools functions:secrets:set ANTHROPIC_API_KEY --project ichi-6b8f7
//     (입력은 화면에 안 보인다. 채팅에는 절대 붙이지 않는다)

import { guard, run } from "./release-guard.mjs";

await guard({ what: "Cloud Functions 배포 (ichi-6b8f7)" });
run("functions 의존성 설치", "npm", ["--prefix", "functions", "ci", "--no-audit", "--no-fund"]);
run("functions 단위 테스트", "npm", ["--prefix", "functions", "test"]);
run("Cloud Functions 배포", "npx", ["firebase-tools", "deploy", "--only", "functions", "--project", "ichi-6b8f7"]);
console.log("\n✅ 서버 함수를 배포했습니다. Claude 세션에 「함수 배포했어 확인해줘」라고 알려 주세요.\n");
