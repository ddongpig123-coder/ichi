// Firestore 보안 규칙 배포 — npm run deploy:rules
//
// release-guard.mjs 의 확인을 통과하면
//   npx firebase-tools deploy --only firestore:rules --project ichi-6b8f7
// 를 저장소 루트에서 실행한다. 규칙 파일 변경은 태희 창구, 실행은 준희 직접(정지선).
// 🔴 규칙을 조일 때는 「OTA 가 퍼졌나」만이 아니라 **스토어 빌드에 내장된 코드가 새 규칙과 맞나**를
//    확인할 것(새로 설치한 사람의 첫 실행은 내장 코드로 돈다 — OTA-2026-11 §0).

import { guard, run } from "./release-guard.mjs";

await guard({ what: "Firestore 규칙 배포 (ichi-6b8f7)" });
run("Firestore 규칙 배포", "npx", ["firebase-tools", "deploy", "--only", "firestore:rules", "--project", "ichi-6b8f7"]);
console.log("\n✅ 규칙을 배포했습니다. Claude 세션에 「규칙 배포했어 확인해줘」라고 알려 주세요.\n");
