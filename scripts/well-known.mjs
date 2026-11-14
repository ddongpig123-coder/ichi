// web/well-known/* → dist/.well-known/（deploy-web.mjs から呼ぶ。単体で試すときは node scripts/well-known.mjs <dist>）
// assetlinks.json は署名証明書の指紋がまだ仮（REPLACE_WITH_）なら載せない — 間違った指紋を公開しないため
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function copyWellKnown(root, dist) {
  const src = join(root, "web", "well-known");
  const dst = join(dist, ".well-known");
  mkdirSync(dst, { recursive: true });
  const copied = [];
  for (const f of ["apple-app-site-association", "assetlinks.json"]) {
    const p = join(src, f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    JSON.parse(text); // 壊れた JSON は公開しない（ここで落ちる）
    if (text.includes("REPLACE_WITH_")) {
      console.log(`⚠ /.well-known/${f} は仮の値のため載せません（web/well-known/README.md）`);
      continue;
    }
    copyFileSync(p, join(dst, f));
    copied.push(f);
  }
  console.log(`✔ /.well-known/ をコピー: ${copied.join(", ") || "（なし）"}`);
  return copied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  copyWellKnown(root, process.argv[2] ?? join(root, "dist"));
}
