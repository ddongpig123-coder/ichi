// 카드뉴스 템플릿 v1 — docs/MARKETING.md §3-1 (2026-11-04 확정)
//  ① 제목 2줄 규칙(1줄 11자·고아 줄 금지·\n 허용·「＼ ／」 옵션)
//  ② 좌상단 시리즈 라벨 칩(시리즈마다 고정색)
//  ③ A/B 박스 안 그림 슬롯(캠퍼스 사진 > 큰 이모지) · topic은 앱 화면을 폰 프레임에
//  ④ 하단 전체 폭 CTA 띠 + 핸들은 띠 오른쪽 작게
//  ⑤ 댓글 카드 노란 마커 밑줄 1곳 · 리스트 카드 우하단 큰 「〇選」
//  ⑥ 상단 「大学の森」 고정 띠
// 실사 인물 없음 · AI 생성 인물 불허. 사진은 scripts/cardnews/assets/ 에 (render.mjs가 data URI로 읽어 넣는다)

import { SIZES } from "./templates.mjs";
export { SIZES };

const APP = "大学の森";
const C = {
  green: "#1F6B45",
  greenDark: "#154D32",
  cream: "#F6F1E7",
  paper: "#FFFFFF",
  ink: "#1C2A22",
  muted: "#6B7A72",
  a: "#2E8B57",
  b: "#E07A3F",
  marker: "#FFE55C",
  white: "#FFFFFF",
};

// ② 시리즈 칩 고정색 — 새 시리즈는 여기에 한 줄 추가
export const SERIES = {
  "究極の2択": { bg: "#E07A3F", fg: "#FFFFFF" },
  "大学生あるある": { bg: "#2E8B57", fg: "#FFFFFF" },
  "留学生の森": { bg: "#3B6FB6", fg: "#FFFFFF" },
  "キャンパス情報": { bg: "#7A6A50", fg: "#FFFFFF" },
  "今週の話題": { bg: "#B5443C", fg: "#FFFFFF" },
};
const SERIES_DEFAULT = { bg: "#1C2A22", fg: "#FFFFFF" };

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ① 제목 2줄 규칙 — \n이 있으면 그대로, 없으면 11자 기준으로 끊되 고아 줄(2자 이하)을 만들지 않는다
export function splitTitle(text, perLine = 11) {
  const t = String(text ?? "").trim();
  if (t.includes("\n")) return t.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const chars = [...t];
  if (chars.length <= perLine) return [t];
  // 구두점 직후에서 끊을 수 있으면 우선 (perLine 이내, 너무 앞은 제외)
  const breakers = new Set(["、", "。", "？", "！", "?", "!", " ", "・"]);
  let cut = -1;
  for (let i = Math.min(perLine, chars.length - 1); i >= Math.ceil(perLine * 0.55); i--) {
    if (breakers.has(chars[i - 1])) { cut = i; break; }
  }
  if (cut < 0) cut = perLine;
  if (chars.length - cut <= 2) cut = Math.ceil(chars.length / 2); // 고아 줄 금지
  // 「90分」「Wi-Fi」처럼 숫자·영문 덩어리 중간에서 끊지 않는다
  const alnum = (c) => /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ\-]/.test(c);
  const digit = (c) => /[0-9０-９]/.test(c);
  // 숫자 바로 뒤(「90|分」)나 영문 덩어리 중간(「Wi-|Fi」)에서는 끊지 않는다
  while (cut > 2 && (digit(chars[cut - 1]) || (alnum(chars[cut - 1]) && alnum(chars[cut])))) cut--;
  const lines = [chars.slice(0, cut).join(""), chars.slice(cut).join("")];
  // 2줄째가 아직 길면 한 번 더 (3줄 상한)
  const rest = [...lines[1]];
  if (rest.length > perLine + 2) {
    let c2 = perLine;
    if (rest.length - c2 <= 2) c2 = Math.ceil(rest.length / 2);
    return [lines[0], rest.slice(0, c2).join(""), rest.slice(c2).join("")];
  }
  return lines;
}

function titleFont(lines, u, base) {
  const longest = Math.max(...lines.map((l) => [...l].length));
  let size = base;
  if (longest > 11) size = Math.round(base * (11 / longest));
  if (lines.length >= 3) size = Math.round(size * 0.85);
  return Math.max(size, Math.round(u * 0.04));
}

function titleHtml(text, u, base, deco) {
  const lines = splitTitle(text);
  const fs = titleFont(lines, u, base);
  const body = lines.map((l) => `<span class="tl">${esc(l)}</span>`).join("");
  if (!deco) return `<div class="title" style="font-size:${fs}px">${body}</div>`;
  return `<div class="title deco-wrap" style="font-size:${fs}px"><span class="deco">＼</span><span class="tls">${body}</span><span class="deco">／</span></div>`;
}

function chip(series) {
  if (!series) return "";
  const c = SERIES[series] || SERIES_DEFAULT;
  return `<span class="chip" style="background:${c.bg};color:${c.fg}">#${esc(series)}</span>`;
}

function shell({ w, h }, body, extraCss = "") {
  const u = Math.min(w, h);
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body { font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "IPAGothic", sans-serif; color: ${C.ink}; background: ${C.cream}; -webkit-font-smoothing: antialiased; }
  .card { position: relative; width: ${w}px; height: ${h}px; display: flex; flex-direction: column; }
  /* ⑥ 상단 브랜드 띠 */
  .band { height: ${Math.round(u * 0.085)}px; background: ${C.green}; color: ${C.white}; display: flex; align-items: center; padding: 0 ${Math.round(u * 0.06)}px; font-weight: 900; font-size: ${Math.round(u * 0.036)}px; letter-spacing: 0.06em; gap: 14px; }
  .band .leaf { width: ${Math.round(u * 0.024)}px; height: ${Math.round(u * 0.024)}px; border-radius: 50% 0 50% 0; background: #9FD8B5; }
  .band .sub { margin-left: auto; font-weight: 500; font-size: ${Math.round(u * 0.022)}px; opacity: 0.85; letter-spacing: 0.04em; }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: ${Math.round(u * 0.045)}px ${Math.round(u * 0.06)}px ${Math.round(u * 0.03)}px; gap: ${Math.round(u * 0.022)}px; }
  .head { display: flex; align-items: center; gap: 12px; }
  /* ② 시리즈 칩 */
  .chip { display: inline-block; padding: ${Math.round(u * 0.009)}px ${Math.round(u * 0.022)}px; border-radius: 999px; font-weight: 900; font-size: ${Math.round(u * 0.024)}px; letter-spacing: 0.04em; }
  .tag { margin-left: auto; color: ${C.muted}; font-weight: 500; font-size: ${Math.round(u * 0.022)}px; }
  /* ① 제목 */
  .title { font-weight: 900; line-height: 1.32; letter-spacing: 0.01em; }
  .title .tl { display: block; }
  .title.deco-wrap { display: flex; align-items: center; gap: 0.15em; }
  .title .tls { display: block; }
  .title .deco { color: ${C.green}; font-weight: 700; font-size: 1.1em; transform: translateY(-0.05em); }
  .mid { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: ${Math.round(u * 0.02)}px; }
  /* ④ CTA 띠 */
  .cta { height: ${Math.round(u * 0.095)}px; background: ${C.greenDark}; color: ${C.white}; display: flex; align-items: center; padding: 0 ${Math.round(u * 0.06)}px; font-weight: 900; font-size: ${Math.round(u * 0.03)}px; }
  .cta .handle { margin-left: auto; font-weight: 500; font-size: ${Math.round(u * 0.021)}px; opacity: 0.8; }
  ${extraCss}
</style></head><body><div class="card">
  <div class="band"><span class="leaf"></span>${APP}<span class="sub">大学生の匿名掲示板</span></div>
  ${body}
</div></body></html>`;
}

function cta(text, handle) {
  return `<div class="cta">${esc(text)}<span class="handle">${esc(handle || "")}</span></div>`;
}

// ③ 그림 슬롯 — image(data URI) > emoji > 없음
function slot(card, key, u, landscape) {
  const img = card[`${key}ImageData`];
  const emoji = card[`${key}Emoji`];
  if (img) return `<div class="slot img" style="background-image:url('${img}')"></div>`;
  if (emoji) return `<div class="slot emoji">${esc(emoji)}</div>`;
  return "";
}

// ── balance ──────────────────────────────────────────────
export function balance(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const landscape = w > h;
  const hasSlot = ["a", "b"].some((k) => card[`${k}ImageData`] || card[`${k}Emoji`]);
  const slotW = Math.round(u * (landscape ? 0.22 : 0.26));
  const css = `
    .vs { position: relative; display: flex; flex-direction: ${landscape ? "row" : "column"}; gap: ${Math.round(u * 0.018)}px; flex: 1; min-height: 0; max-height: ${Math.round(landscape ? h * 0.56 : u * 0.68)}px; }
    .opt { flex: 1; min-height: 0; border-radius: ${Math.round(u * 0.024)}px; color: ${C.white}; display: flex; flex-direction: row; align-items: center; gap: ${Math.round(u * 0.03)}px; padding: ${Math.round(u * 0.035)}px ${Math.round(u * 0.04)}px; font-weight: 900; font-size: ${Math.round(u * (landscape ? 0.04 : 0.046))}px; line-height: 1.3; white-space: pre-line; overflow: hidden; }
    .opt .txt { flex: 1; min-width: 0; }
    .opt .k { display: block; font-size: ${Math.round(u * 0.026)}px; opacity: 0.75; letter-spacing: 0.2em; margin-bottom: 6px; font-weight: 700; }
    .a { background: ${C.a}; } .b { background: ${C.b}; }
    .slot { flex: 0 0 ${slotW}px; width: ${slotW}px; height: ${slotW}px; border-radius: ${Math.round(u * 0.02)}px; display: flex; align-items: center; justify-content: center; }
    .slot.img { background-size: cover; background-position: center; box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
    .slot.emoji { font-size: ${Math.round(slotW * 0.62)}px; background: rgba(255,255,255,0.16); font-family: "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
    .badge { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${Math.round(u * 0.09)}px; height: ${Math.round(u * 0.09)}px; border-radius: 50%; background: ${C.cream}; color: ${C.ink}; font-weight: 900; font-size: ${Math.round(u * 0.032)}px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(0,0,0,0.18); }
  `;
  const body = `
    <div class="body">
      <div class="head">${chip(card.series || "究極の2択")}${card.tag ? `<span class="tag">${esc(card.tag)}</span>` : ""}</div>
      ${titleHtml(card.question, u, Math.round(u * (landscape ? 0.056 : 0.068)), card.deco)}
      <div class="mid">
        <div class="vs">
          <div class="opt a">${slot(card, "a", u, landscape)}<div class="txt"><span class="k">A</span>${esc(card.a)}</div></div>
          <div class="opt b">${slot(card, "b", u, landscape)}<div class="txt"><span class="k">B</span>${esc(card.b)}</div></div>
          <div class="badge">VS</div>
        </div>
      </div>
    </div>
    ${cta(card.cta || "どっち派？コメントで教えて →", card.handle)}
  `;
  return shell(size, body, css);
}

// ── topic (앱 화면을 폰 프레임에) ───────────────────────────
export function topic(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const landscape = w > h;
  const phoneW = Math.round(u * (landscape ? 0.22 : 0.4));
  const css = `
    .row { display: flex; flex-direction: ${landscape ? "row" : "column"}; align-items: center; gap: ${Math.round(u * 0.04)}px; min-height: 0; margin-top: ${Math.round(u * 0.02)}px; }
    .phone { flex: 0 0 auto; width: ${phoneW}px; aspect-ratio: 9 / 19; border-radius: ${Math.round(phoneW * 0.14)}px; background: #111; padding: ${Math.round(phoneW * 0.035)}px; box-shadow: 0 18px 40px rgba(28,42,34,0.22); max-height: 100%; }
    .screen { width: 100%; height: 100%; border-radius: ${Math.round(phoneW * 0.11)}px; background-size: cover; background-position: top center; background-color: #fff; }
    .board { color: ${C.muted}; font-weight: 700; font-size: ${Math.round(u * 0.024)}px; letter-spacing: 0.08em; }
    .stats { display: flex; gap: ${Math.round(u * 0.05)}px; font-weight: 700; font-size: ${Math.round(u * 0.032)}px; color: ${C.greenDark}; }
    .stats span { display: inline-flex; align-items: center; gap: 10px; }
    .stats svg { width: ${Math.round(u * 0.038)}px; height: ${Math.round(u * 0.038)}px; }
  `;
  const bubble = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>`;
  const heart = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0 1 12 6.1 5.5 5.5 0 0 1 21.5 12c-2 4.4-9.5 9-9.5 9z"/></svg>`;
  const stats =
    card.comments != null || card.likes != null
      ? `<div class="stats">${card.comments != null ? `<span>${bubble}${card.comments}</span>` : ""}${card.likes != null ? `<span>${heart}${card.likes}</span>` : ""}</div>`
      : "";
  const phone = card.screenshotData
    ? `<div class="phone"><div class="screen" style="background-image:url('${card.screenshotData}')"></div></div>`
    : "";
  const body = `
    <div class="body">
      <div class="head">${chip(card.series || "今週の話題")}${card.tag ? `<span class="tag">${esc(card.tag)}</span>` : ""}</div>
      <div class="mid">
        ${card.board ? `<div class="board">${esc(card.board)}</div>` : ""}
        ${titleHtml(`「${card.title}」`, u, Math.round(u * (landscape ? 0.054 : 0.07)), card.deco)}
        ${phone || stats ? `<div class="row">${phone}${stats}</div>` : ""}
      </div>
    </div>
    ${cta(card.cta || `${APP}で見る →`, card.handle)}
  `;
  return shell(size, body, css);
}

// ── comment (베스트 댓글 · ⑤ 마커 밑줄 1곳) ────────────────────
export function comment(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const text = String(card.text ?? "");
  let inner = esc(text);
  if (card.highlight && text.includes(card.highlight)) {
    inner = esc(text).replace(esc(card.highlight), `<mark>${esc(card.highlight)}</mark>`);
  }
  const n = [...text].length;
  const fs = Math.round(u * (n <= 30 ? 0.054 : n <= 60 ? 0.046 : 0.04));
  const css = `
    .label { color: ${C.muted}; font-weight: 700; font-size: ${Math.round(u * 0.024)}px; letter-spacing: 0.08em; }
    .bubble { background: ${C.paper}; border-radius: ${Math.round(u * 0.03)}px; padding: ${Math.round(u * 0.05)}px ${Math.round(u * 0.055)}px; font-weight: 700; font-size: ${fs}px; line-height: 1.6; box-shadow: 0 10px 40px rgba(28,42,34,0.08); white-space: pre-line; }
    mark { background: linear-gradient(transparent 55%, ${C.marker} 55%); color: inherit; padding: 0 2px; }
    .who { color: ${C.muted}; font-size: ${Math.round(u * 0.022)}px; }
  `;
  const body = `
    <div class="body">
      <div class="head">${chip(card.series || "今週の話題")}${card.tag ? `<span class="tag">${esc(card.tag)}</span>` : ""}</div>
      <div class="mid">
        <div class="label">ベストコメント</div>
        <div class="bubble">${inner}</div>
        <div class="who">匿名 · 「${esc(card.ref || "")}」より</div>
      </div>
    </div>
    ${cta(card.cta || `${APP}で続きを見る →`, card.handle)}
  `;
  return shell(size, body, css);
}

// ── list (랭킹·체크리스트 · ⑤ 우하단 「〇選」) ──────────────────
export function list(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const items = (card.items || []).slice(0, 7);
  const fs = Math.round(u * (items.length <= 4 ? 0.04 : items.length <= 6 ? 0.034 : 0.03));
  const css = `
    .items { list-style: none; display: flex; flex-direction: column; gap: ${Math.round(u * 0.014)}px; }
    .items li { display: flex; align-items: center; gap: ${Math.round(u * 0.025)}px; background: ${C.paper}; border-radius: ${Math.round(u * 0.018)}px; padding: ${Math.round(u * 0.018)}px ${Math.round(u * 0.03)}px; font-weight: 700; font-size: ${fs}px; line-height: 1.35; box-shadow: 0 4px 16px rgba(28,42,34,0.06); }
    .items .n { flex: 0 0 ${Math.round(u * 0.06)}px; width: ${Math.round(u * 0.06)}px; height: ${Math.round(u * 0.06)}px; border-radius: 50%; background: ${C.green}; color: ${C.white}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${Math.round(u * 0.028)}px; }
    .list-mid { justify-content: flex-start; padding-bottom: ${Math.round(u * 0.13)}px; }
    .sen { position: absolute; right: ${Math.round(u * 0.05)}px; bottom: ${Math.round(u * 0.11)}px; font-weight: 900; font-size: ${Math.round(u * 0.14)}px; line-height: 1; color: ${C.green}; opacity: 0.16; letter-spacing: -0.02em; pointer-events: none; }
  `;
  const body = `
    <div class="body">
      <div class="head">${chip(card.series || "キャンパス情報")}${card.tag ? `<span class="tag">${esc(card.tag)}</span>` : ""}</div>
      ${titleHtml(card.title, u, Math.round(u * 0.06), card.deco)}
      <div class="mid list-mid"><ol class="items">${items.map((t, i) => `<li><span class="n">${i + 1}</span><span>${esc(t)}</span></li>`).join("")}</ol></div>
    </div>
    <div class="sen">${items.length}選</div>
    ${cta(card.cta || `続きは${APP}で →`, card.handle)}
  `;
  return shell(size, body, css);
}

export const TEMPLATES = { balance, topic, comment, list };
