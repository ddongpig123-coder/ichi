// ローカルスクリプト用の .env ローダー。
//
// なぜ必要か: `eas env:pull` は Firebase キーを **.env.local** に書き出し、Expo はそれを
// .env より優先して読む。スクリプトが .env しか見ていないと、アプリは動くのにスクリプトだけ
// auth/invalid-api-key で落ちる（2026-10-23 実際に発生）。
//
// 読み込み順は Expo と同じ: .env → .env.local（後者が勝つ）。
// 値を囲むクォートは剥がす（dotenv 系は剥がすが、素朴なパーサーは剥がさないため）。
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        const key = l.slice(0, i).trim().replace(/^export\s+/, "");
        let value = l.slice(i + 1).trim();
        // "..." / '...' を剥がす
        if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
        return [key, value];
      })
  );
}

// 呼び出し元の import.meta.url を渡す（scripts/ からの相対でプロジェクト直下を見る）
export function loadEnv(callerUrl) {
  const base = new URL("../", callerUrl);
  return {
    ...parseEnvFile(fileURLToPath(new URL(".env", base))),
    ...parseEnvFile(fileURLToPath(new URL(".env.local", base))),
  };
}
