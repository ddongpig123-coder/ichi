// OTA(앱 JS 업데이트) 배포 — npm run ota -- "1.0.5: 무엇을 바꿨나"
//
// 하는 일: release-guard.mjs 의 확인(루트·master·원격과 같음·변경 없음·타입 검사·y 확인)을 통과하면
//   eas update --branch production --environment production --message "<메시지>"
// 를 저장소 루트에서 실행한다. --environment production 이 항상 붙으므로 「Select environment」가 안 뜬다.
//
// 시험판(TestFlight 1.1.0 = eas.json 의 beta 프로필)에만 보내기:
//   npm run ota -- --beta "알림 기본 켜짐"
//   → APP_VERSION_OVERRIDE=1.1.0 으로 runtime 을 시험판(1.1.0)에 맞추고 --branch beta 로 보낸다.
//     스토어 1.0.0 사용자에게는 가지 않는다(채널·runtime 이 다름).
//
// 🔴 실행은 준희가 직접(정지선). 🔴 앱 심사 중에는 OTA 금지(OTA-2026-11 머리말).
// 🔴 규칙을 같이 바꿨다면 순서는 규칙 배포(npm run deploy:rules) → 웹(npm run deploy:web) → OTA.

import { spawnSync } from "node:child_process";
import { guard, run } from "./release-guard.mjs";

const args = process.argv.slice(2);
const beta = args.includes("--beta");
const message = args.filter((a) => a !== "--beta").join(" ").trim();
if (!message) {
  console.error('\n✖ 메시지가 없습니다. 이렇게 실행하세요:\n\n  npm run ota -- "1.0.5: 초대 링크 확인 버튼"\n  (시험판만) npm run ota -- --beta "알림 기본 켜짐"\n');
  process.exit(1);
}
// 시험판 빌드(eas.json beta)와 같은 버전 = 같은 runtime 이어야 받는다
const BETA_VERSION = "1.1.0";
const branch = beta ? "beta" : "production";
if (beta) process.env.APP_VERSION_OVERRIDE = BETA_VERSION;

await guard({ what: beta ? `OTA 배포 (시험판 beta ${BETA_VERSION} 만 — 스토어 사용자에겐 안 감) 「${message}」` : `OTA 배포 (production) 「${message}」` });

// 전역 eas(npm i -g eas-cli)가 있으면 그걸, 없으면 npx eas-cli
const isWin = process.platform === "win32";
const hasEas = spawnSync("eas", ["--version"], { stdio: "ignore", shell: isWin }).status === 0;
const [cmd, pre] = hasEas ? ["eas", []] : ["npx", ["eas-cli"]];
run("EAS Update", cmd, [...pre, "update", "--branch", branch, "--environment", "production", "--message", message]);

console.log(`
✅ OTA 를 올렸습니다. 다음:
  1. 확인:   ${hasEas ? "eas" : "npx eas-cli"} update:list --branch ${branch}
  2. 실기기: 앱을 완전히 닫고 2번 실행(1회차에 받고 2회차에 적용) → 바뀐 화면 확인
  3. 문제가 있으면 롤백: ${hasEas ? "eas" : "npx eas-cli"} update:republish --branch ${branch} (직전 업데이트로 되돌림)
`);
