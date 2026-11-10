// 배포 전 안전 확인 (npm run ota / deploy:web / deploy:rules 가 공통으로 쓴다)
//
// 왜: 2026-11-08~09 이틀 동안 배포 실수가 3번 났다.
//   ① git pull 전에 배포 → 옛 코드가 나감
//   ② eas update 에서 「Select environment」에 development 를 고름
//   ③ ~/ichi/scripts 폴더에서 eas update → 엉뚱한 EAS 프로젝트(ichi-scripts)가 생김
// 사람이 조심할 일이 아니라 스크립트가 막을 일이라서, 배포 명령을 이 확인 뒤에만 돌게 묶었다.
//
// 확인하는 것 (하나라도 걸리면 아무것도 안 하고 멈춘다):
//   1. 저장소 루트에서 도는가 (이 파일 위치로 루트를 정하므로 어느 폴더에서 불러도 루트 기준)
//   2. master 브랜치인가
//   3. 원격 master 와 완전히 같은가 (pull 안 한 것 / push 안 한 커밋 모두 잡는다)
//   4. 고친 채로 커밋 안 한 파일이 없는가
//   5. 타입 검사(npx tsc --noEmit) 통과
//   6. 마지막으로 「이 커밋을 배포합니다」를 보여 주고 y 를 받는다
//
// 🔴 이 스크립트는 배포 명령을 「대신 쳐 주는」 것뿐이다. 실행은 여전히 준희가 직접 한다(정지선).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function stop(msg, hint) {
  console.error(`\n✖ 멈춤: ${msg}`);
  if (hint) console.error(`  → ${hint}`);
  console.error("  아무것도 배포하지 않았습니다.\n");
  process.exit(1);
}

// 배포 명령 실행 (실패하면 그 종료 코드로 끝낸다). Windows 는 .cmd 를 shell 로만 띄울 수 있다
export function run(label, cmd, args) {
  console.log(`\n▶ ${label}\n  $ ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: isWin });
  if (r.status !== 0) {
    console.error(`✖ 실패: ${label}`, r.error ? `(${r.error.code ?? r.error.message})` : `(exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

export async function guard({ what }) {
  console.log(`\n🔒 배포 전 확인 — ${what}`);

  // 1. 루트
  const pkgPath = join(ROOT, "package.json");
  if (!existsSync(pkgPath) || !existsSync(join(ROOT, "app.json"))) {
    stop("저장소 루트(~/ichi)를 찾지 못했습니다.", "cd ~/ichi 후 다시 실행하세요");
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name === "ichi-scripts") stop("scripts 폴더의 package.json 이 잡혔습니다.", "cd ~/ichi 후 다시 실행하세요");
  console.log(`  ✔ 저장소 루트: ${ROOT}`);

  // 2. 브랜치
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
  if (branch !== "master") {
    stop(`지금 브랜치가 master 가 아닙니다 (${branch}).`, "git checkout master && git pull");
  }
  console.log("  ✔ 브랜치: master");

  // 3. 원격과 같은가
  const fetched = git(["fetch", "origin", "master", "--quiet"]);
  if (!fetched.ok) stop("원격(GitHub)에서 최신 정보를 받지 못했습니다.", "인터넷 연결 확인 후 다시 실행하세요");
  const behind = Number(git(["rev-list", "--count", "HEAD..origin/master"]).out || "0");
  const ahead = Number(git(["rev-list", "--count", "origin/master..HEAD"]).out || "0");
  if (behind > 0) stop(`원격 master 보다 ${behind}커밋 뒤처져 있습니다 (pull 안 함).`, "git pull 후 다시 실행하세요");
  if (ahead > 0) stop(`원격에 없는 커밋이 ${ahead}개 있습니다 (master 에 직접 커밋함).`, "Claude 에게 보여 주고 정리하세요");
  console.log("  ✔ 원격 master 와 같음");

  // 4. 커밋 안 한 변경
  //    - 이미 있는 파일을 고친 것: 무조건 멈춘다 (배포 번들에 섞인다)
  //    - 새 파일: 앱에 들어가는 곳(app/ src/ assets/ 와 루트 바로 아래)이면 멈춘다.
  //      그 밖(scripts/ 의 결과물, docs/ 메모 등)은 목록만 보여 주고 계속한다
  const lines = git(["status", "--porcelain"]).out.split("\n").filter(Boolean)
    .filter((l) => !l.endsWith(".DS_Store"));
  const modified = lines.filter((l) => !l.startsWith("??"));
  const untracked = lines.filter((l) => l.startsWith("??")).map((l) => l.slice(3));
  const risky = untracked.filter((p) => /^(app|src|assets)\//.test(p) || !p.includes("/"));
  if (modified.length > 0 || risky.length > 0) {
    console.error([...modified, ...risky.map((p) => `?? ${p}`)].slice(0, 15).map((l) => `     ${l}`).join("\n"));
    stop("커밋하지 않은 변경이 있습니다(위 목록). 그대로 배포에 섞일 수 있습니다.",
      "의도한 게 아니면 Claude 에게 이 목록을 보여 주세요");
  }
  if (untracked.length > 0) {
    console.log(`  ⚠ 앱과 무관한 새 파일 ${untracked.length}개는 무시합니다: ${untracked.slice(0, 5).join(", ")}${untracked.length > 5 ? " …" : ""}`);
  }
  console.log("  ✔ 작업 폴더 깨끗함");

  // 5. 타입 검사
  console.log("  … 타입 검사(npx tsc --noEmit) 중");
  const tsc = spawnSync(isWin ? "npx.cmd" : "npx", ["tsc", "--noEmit"], { cwd: ROOT, encoding: "utf8", shell: isWin });
  if (tsc.status !== 0) {
    console.error((tsc.stdout || tsc.stderr || "").split("\n").slice(0, 20).join("\n"));
    stop("타입 검사 실패.", "Claude 에게 위 오류를 보여 주세요");
  }
  console.log("  ✔ 타입 검사 통과");

  // 6. 최종 확인
  const head = git(["log", "-1", "--format=%h %s (%cr)"]).out;
  console.log(`\n  배포할 커밋: ${head}`);
  if (!process.stdin.isTTY) stop("확인 입력을 받을 수 없는 환경입니다.", "터미널에서 직접 실행하세요");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`  ${what} — 진행할까요? (y 입력 후 Enter) `)).trim().toLowerCase();
  rl.close();
  if (answer !== "y" && answer !== "yes") stop("취소했습니다.");
  return { head };
}
