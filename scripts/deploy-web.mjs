// Web(Firebase Hosting)へのデプロイ一括スクリプト
//   npm run deploy:web
//
// expo export は dist/ を毎回作り直すため、法的文書(約款・方針)と robots.txt を
// 都度コピーし直す必要がある。手動だと忘れてストア提出用の公開URLが404になるので、
// この手順をスクリプトに固定する。
//
// 公開先: https://ichi-6b8f7.web.app
//   /legal/terms.html · /legal/privacy.html … ストア提出用の公開URL
//   /robots.txt                             … リリース前は検索エンジン除け

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(npx, args, { cwd: root, stdio: "inherit", shell: false });
  if (r.status !== 0) {
    console.error(`✖ 失敗: ${label}`);
    process.exit(r.status ?? 1);
  }
}

// 1) Web ビルド（dist/ を作り直す）
run("Web ビルド (expo export)", ["expo", "export", "--platform", "web"]);

// 2) 法的文書コピー（毎回消えるので必須）
const legalSrc = join(root, "docs", "legal");
const legalDst = join(dist, "legal");
mkdirSync(legalDst, { recursive: true });
for (const f of ["terms.html", "privacy.html"]) {
  const src = join(legalSrc, f);
  if (!existsSync(src)) {
    console.error(`✖ 見つかりません: docs/legal/${f}`);
    process.exit(1);
  }
  copyFileSync(src, join(legalDst, f));
}
console.log("✔ 法的文書をコピー: /legal/terms.html, /legal/privacy.html");

// 3) robots.txt（リリース前は全面ブロック。公開時はこの行を外す）
writeFileSync(
  join(dist, "robots.txt"),
  "# リリース前のため検索エンジンのインデックスを拒否\nUser-agent: *\nDisallow: /\n"
);
console.log("✔ robots.txt を生成（検索エンジン除け）");

// 4) デプロイ
run("Firebase Hosting デプロイ", ["firebase-tools", "deploy", "--only", "hosting", "--project", "ichi-6b8f7"]);

console.log("\n✅ 完了 → https://ichi-6b8f7.web.app");
