#!/usr/bin/env node
// 뉴스형 카드 「キャンパス速報」 — 사진 전면 + 아래 검은 그라데이션 + 흰 굵은 3줄 제목 (2026-11-13, MARKETING §3-3 예시 ⑤)
// 사용법: node scripts/cardnews/news.mjs scripts/cardnews/samples/news-sample.json [--out 폴더]
// JSON: { "cards": [ { "img": "assets 안 파일명", "pos": "CSS background-position(선택)", "lines": ["1줄","2줄","「인용」"] } ] }
// 사진은 scripts/cardnews/assets/ 에 (git 제외). 1줄 12자 이내가 안전하다
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.resolve(here, "../output/cardnews");
if (!file) { console.error("사용법: node news.mjs <cards.json> [--out 폴더]"); process.exit(1); }

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const { cards } = JSON.parse(await readFile(file, "utf8"));
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
for (const [i, c] of cards.entries()) {
  const buf = await readFile(path.resolve(here, "assets", c.img));
  const mime = c.img.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;font-family:"Noto Sans JP","Hiragino Sans","IPAGothic",sans-serif;overflow:hidden;background:#000}
.bg{position:absolute;inset:0;background:url('data:${mime};base64,${buf.toString("base64")}') ${c.pos || "center"}/cover}
.grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 38%,rgba(0,0,0,.55) 60%,rgba(0,0,0,.92) 100%)}
.txt{position:absolute;left:64px;right:64px;bottom:88px;color:#fff}
.credit{font-size:30px;font-weight:700;opacity:.85;margin-bottom:22px}
.h{font-size:${c.size || 76}px;font-weight:900;line-height:1.32;letter-spacing:-.01em;text-shadow:0 2px 12px rgba(0,0,0,.35)}
.h span{display:block}</style></head><body><div class="bg"></div><div class="grad"></div>
<div class="txt"><div class="credit">${esc(c.credit || "@daigakunomori")}</div><div class="h">${(c.lines || []).map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>
</body></html>`;
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 3000))]);
  const name = `news-${String(i + 1).padStart(2, "0")}.png`;
  await page.screenshot({ path: path.join(outDir, name) });
  await page.close();
  console.log(`✓ ${name}`);
}
await browser.close();
