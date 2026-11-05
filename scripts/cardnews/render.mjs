#!/usr/bin/env node
// 카드뉴스 PNG 생성기 — JSON 한 파일 → PNG 여러 장 (scripts/output/cardnews/)
//
// 사용법:
//   node scripts/cardnews/render.mjs scripts/cardnews/samples/2026-11-w1.json            # IG 4:5
//   node scripts/cardnews/render.mjs <json> --size x        # X 16:9
//   node scripts/cardnews/render.mjs <json> --size all      # ig + sq + x 전부
//   node scripts/cardnews/render.mjs <json> --handle @daigakunomori   # 카드 하단 아이디 일괄
//   node scripts/cardnews/render.mjs <json> --template v1   # v1 템플릿 (docs/MARKETING.md §3-1). 기본은 v0
//
// JSON 형식은 samples/ 참조. type = balance | topic (bestComment가 있으면 2장째 자동) | list (v1)
// 그림 슬롯(v1): aImage/bImage/screenshot 에 파일 경로(assets/ 기준 또는 JSON 파일 기준) · aEmoji/bEmoji 에 이모지
// Chromium은 Playwright가 띄운다 (준비: scripts/ 에서 npm install && npx playwright install chromium)

import { readFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TEMPLATES as V0, SIZES } from "./templates.mjs";
import { TEMPLATES as V1 } from "./templates-v1.mjs";
const TEMPLATE_SETS = { v0: V0, v1: V1 };

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(here, "../output/cardnews");
const ASSETS_DIR = path.resolve(here, "assets");

function parseArgs(argv) {
  const args = { size: "ig", handle: "", template: "v0" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--size") args.size = argv[++i];
    else if (a === "--handle") args.handle = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--template") args.template = argv[++i];
    else rest.push(a);
  }
  args.file = rest[0];
  return args;
}

function slug(s, i) {
  const base = String(s || `card${i + 1}`)
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .slice(0, 40);
  return `${String(i + 1).padStart(2, "0")}-${base}`;
}

// 한 건의 JSON을 「렌더할 장」 목록으로 펼친다 (topic + bestComment = 2장)
function expand(card) {
  if (card.type === "topic" && card.bestComment) {
    return [
      { ...card },
      { type: "comment", text: card.bestComment, ref: card.title, tag: card.tag, handle: card.handle, series: card.series, highlight: card.highlight },
    ];
  }
  return [card];
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}
// 이미지 경로 → data URI. JSON 파일 기준 경로 → assets/ 기준 경로 순으로 찾는다
async function loadImage(ref, jsonDir) {
  if (!ref) return null;
  const candidates = [path.resolve(jsonDir, ref), path.resolve(ASSETS_DIR, ref), path.resolve(ref)];
  for (const p of candidates) {
    if (await exists(p)) {
      const mime = MIME[path.extname(p).toLowerCase()] || "application/octet-stream";
      return `data:${mime};base64,${(await readFile(p)).toString("base64")}`;
    }
  }
  throw new Error(`이미지를 찾을 수 없음: ${ref} (assets/ 또는 JSON 파일 기준 경로)`);
}
async function withImages(card, jsonDir) {
  const out = { ...card };
  // aImage 와 imageA 는 같은 뜻 (§5 표기 / v1 초안 표기 둘 다 허용)
  for (const [src, alt, dst] of [["aImage", "imageA", "aImageData"], ["bImage", "imageB", "bImageData"], ["screenshot", "screenshot", "screenshotData"]]) {
    const ref = card[src] ?? card[alt];
    if (ref) out[dst] = await loadImage(ref, jsonDir);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error("사용법: node render.mjs <cards.json> [--size ig|sq|x|all] [--handle @id]");
    process.exit(1);
  }
  const sizes = args.size === "all" ? Object.keys(SIZES) : [args.size];
  for (const s of sizes) if (!SIZES[s]) throw new Error(`알 수 없는 size: ${s} (ig|sq|x|all)`);

  const raw = JSON.parse(await readFile(args.file, "utf8"));
  const cards = Array.isArray(raw) ? raw : raw.cards;
  if (!Array.isArray(cards)) throw new Error("JSON은 배열이거나 { cards: [...] } 형식이어야 합니다");

  const TEMPLATES = TEMPLATE_SETS[args.template];
  if (!TEMPLATES) throw new Error(`알 수 없는 template: ${args.template} (v0|v1)`);
  const jsonDir = path.dirname(path.resolve(args.file));
  const outDir = args.out ? path.resolve(args.out) : OUT_DIR;
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    let count = 0;
    for (const [i, card] of cards.entries()) {
      const pages = expand(await withImages({ handle: args.handle, ...card }, jsonDir));
      for (const [j, pageCard] of pages.entries()) {
        const tpl = TEMPLATES[pageCard.type];
        if (!tpl) throw new Error(`카드 ${i + 1}: 알 수 없는 type "${pageCard.type}" (${Object.keys(TEMPLATES).join("|")}, template=${args.template})`);
        for (const s of sizes) {
          const size = SIZES[s];
          const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
          await page.setContent(tpl(pageCard, size), { waitUntil: "load" });
          // 웹폰트(Noto Sans JP)가 안 내려와도 로컬 폰트로 그린다 — 최대 3초만 기다림
          await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 3000))]);
          const name = `${slug(card.question || card.title, i)}${pages.length > 1 ? `-${j + 1}` : ""}-${s}${args.template === "v0" ? "" : `-${args.template}`}.png`;
          await page.screenshot({ path: path.join(outDir, name), type: "png" });
          await page.close();
          count++;
          console.log(`✓ ${name}`);
        }
      }
    }
    console.log(`\n${count}장 생성 → ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
