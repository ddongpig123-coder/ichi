// 이 폴더의 *.test.mjs 를 전부 차례로 돌린다.
// 🔑 파일 목록을 package.json 에 적지 않는 이유: 새 테스트를 추가할 때마다 package.json 을
//    고쳐야 했고, 그 한 줄이 PR 끼리 매번 충돌했다(#39·#50 에서 실제로 세 번 났다).
//    여기서 디렉터리를 읽으면 테스트 파일만 추가하면 끝난다.
// 사용: npm test  /  다른 규칙 파일로: node run-all.mjs ../../어딘가/firestore.rules
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const rules = process.argv[2];   // 없으면 각 테스트가 저장소 루트의 firestore.rules 를 본다
const files = readdirSync(here).filter((f) => f.endsWith(".test.mjs")).sort();

if (files.length === 0) {
  console.error("테스트 파일(*.test.mjs)이 없다");
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  console.log(`\n──── ${f} ────`);
  const res = spawnSync(process.execPath, rules ? [f, rules] : [f], { cwd: here, stdio: "inherit" });
  if (res.status !== 0) failed++;
}

console.log(`\n${files.length - failed}/${files.length} 개 파일 통과`);
process.exit(failed > 0 ? 1 : 0);
