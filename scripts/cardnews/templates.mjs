// 카드뉴스 HTML 템플릿 — 글씨 중심, 실사 인물 없음 (MARKETING §3)
// 카드 1장 = 함수 1개. JSON 한 건을 받아 HTML 문자열을 돌려준다.
// 색은 앱 테마(src/theme/themes.ts)와 무관하게 SNS용 브랜드 색을 따로 둔다.

export const SIZES = {
  ig: { w: 1080, h: 1350, label: "Instagram フィード 4:5" },
  sq: { w: 1080, h: 1080, label: "正方形 (IG/X 공용)" },
  x: { w: 1200, h: 675, label: "X 16:9" },
};

const BRAND = {
  green: "#1F6B45",
  greenDark: "#154D32",
  cream: "#F6F1E7",
  ink: "#1C2A22",
  muted: "#6B7A72",
  a: "#2E8B57", // 밸런스 A
  b: "#E07A3F", // 밸런스 B
  white: "#FFFFFF",
};

const APP = "大学の森";

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 긴 제목은 글자 수에 따라 폰트를 줄인다 (1080px 폭 기준)
function titleSize(text, base) {
  const n = [...text].length;
  if (n <= 14) return base;
  if (n <= 22) return Math.round(base * 0.82);
  if (n <= 32) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}

function shell({ w, h }, body, extraCss = "") {
  const u = Math.min(w, h); // 모든 크기의 기준 = 짧은 변 (가로 카드에서도 비율 유지)
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .q, .opt, .title, .bubble { white-space: pre-line; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "IPAGothic", sans-serif;
    color: ${BRAND.ink}; background: ${BRAND.cream};
    -webkit-font-smoothing: antialiased;
  }
  .card { position: relative; width: ${w}px; height: ${h}px; padding: ${Math.round(u * 0.06)}px ${Math.round(u * 0.07)}px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 700; color: ${BRAND.green}; font-size: ${Math.round(u * 0.03)}px; letter-spacing: 0.04em; }
  .brand .dot { width: ${Math.round(u * 0.022)}px; height: ${Math.round(u * 0.022)}px; border-radius: 50%; background: ${BRAND.green}; }
  .tag { margin-left: auto; font-weight: 500; color: ${BRAND.muted}; font-size: ${Math.round(u * 0.024)}px; }
  .mid { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: ${Math.round(u * 0.025)}px; padding: ${Math.round(u * 0.03)}px 0; }
  .cta { display: flex; align-items: center; justify-content: space-between; }
  .cta .go { background: ${BRAND.green}; color: ${BRAND.white}; font-weight: 700; padding: ${Math.round(u * 0.016)}px ${Math.round(u * 0.032)}px; border-radius: 999px; font-size: ${Math.round(u * 0.027)}px; }
  .cta .handle { color: ${BRAND.muted}; font-size: ${Math.round(u * 0.024)}px; font-weight: 500; }
  ${extraCss}
</style></head><body><div class="card">${body}</div></body></html>`;
}

function header(tag) {
  return `<div class="brand"><span class="dot"></span>${APP}${tag ? `<span class="tag">${esc(tag)}</span>` : ""}</div>`;
}

function footer(cta, handle) {
  return `<div class="cta"><span class="go">${esc(cta)}</span><span class="handle">${esc(handle || "")}</span></div>`;
}

// ── 밸런스 게임: 「究極の2択」 A vs B ─────────────────────────
export function balance(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const landscape = w > h;
  const qSize = titleSize(card.question, Math.round(u * (landscape ? 0.058 : 0.064)));
  const optSize = Math.round(u * (landscape ? 0.044 : 0.05));
  const css = `
    .q { font-weight: 900; font-size: ${qSize}px; line-height: 1.35; }
    .q small { display: block; font-size: ${Math.round(u * 0.026)}px; color: ${BRAND.muted}; font-weight: 700; margin-bottom: 10px; letter-spacing: 0.1em; }
    .vs { position: relative; display: flex; flex-direction: ${landscape ? "row" : "column"}; gap: ${Math.round(u * 0.02)}px; flex: 1; min-height: 0; max-height: ${Math.round(landscape ? h * 0.5 : u * 0.72)}px; }
    .opt { flex: 1; min-height: 0; border-radius: ${Math.round(u * 0.026)}px; color: ${BRAND.white}; display: flex; flex-direction: column; justify-content: center; padding: ${Math.round(u * 0.04)}px ${Math.round(u * 0.05)}px; font-weight: 900; font-size: ${optSize}px; line-height: 1.3; }
    .opt .k { font-size: ${Math.round(u * 0.09)}px; line-height: 1; opacity: 0.28; margin-bottom: 6px; }
    .a { background: ${BRAND.a}; } .b { background: ${BRAND.b}; }
    .badge { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${Math.round(u * 0.1)}px; height: ${Math.round(u * 0.1)}px; border-radius: 50%; background: ${BRAND.cream}; color: ${BRAND.ink}; font-weight: 900; font-size: ${Math.round(u * 0.036)}px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 24px rgba(0,0,0,0.15); }
  `;
  const body = `
    ${header(card.tag)}
    <div class="mid">
      <div class="q"><small>究極の2択</small>${esc(card.question)}</div>
      <div class="vs">
        <div class="opt a"><span class="k">A</span>${esc(card.a)}</div>
        <div class="opt b"><span class="k">B</span>${esc(card.b)}</div>
        <div class="badge">VS</div>
      </div>
    </div>
    ${footer(card.cta || "どっち派？コメントで教えて", card.handle)}
  `;
  return shell(size, body, css);
}

// ── 화제 글 카드: 제목 + 반응 수 + 「大学の森で見る →」 (MARKETING §3 템플릿) ──
export function topic(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const tSize = titleSize(card.title, Math.round(u * 0.08));
  const css = `
    .board { color: ${BRAND.muted}; font-weight: 700; font-size: ${Math.round(u * 0.026)}px; letter-spacing: 0.08em; }
    .title { font-weight: 900; font-size: ${tSize}px; line-height: 1.38; }
    .stats { display: flex; gap: ${Math.round(u * 0.05)}px; font-weight: 700; font-size: ${Math.round(u * 0.034)}px; color: ${BRAND.greenDark}; margin-top: ${Math.round(u * 0.01)}px; }
    .stats span { display: inline-flex; align-items: center; gap: 10px; }
    .stats svg { width: ${Math.round(u * 0.04)}px; height: ${Math.round(u * 0.04)}px; }
  `;
  const bubble = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>`;
  const heart = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0 1 12 6.1 5.5 5.5 0 0 1 21.5 12c-2 4.4-9.5 9-9.5 9z"/></svg>`;
  const stats =
    card.comments != null || card.likes != null
      ? `<div class="stats">${card.comments != null ? `<span>${bubble}${card.comments}</span>` : ""}${card.likes != null ? `<span>${heart}${card.likes}</span>` : ""}</div>`
      : "";
  const body = `
    ${header(card.tag)}
    <div class="mid">
      ${card.board ? `<div class="board">${esc(card.board)}</div>` : ""}
      <div class="title">「${esc(card.title)}」</div>
      ${stats}
    </div>
    ${footer(card.cta || `${APP}で見る →`, card.handle)}
  `;
  return shell(size, body, css);
}

// ── 베스트 댓글 카드 (topic의 2장째) ──
export function comment(card, size) {
  const { w, h } = size;
  const u = Math.min(w, h);
  const cSize = titleSize(card.text, Math.round(u * 0.058));
  const css = `
    .label { color: ${BRAND.muted}; font-weight: 700; font-size: ${Math.round(u * 0.026)}px; letter-spacing: 0.08em; }
    .bubble { background: ${BRAND.white}; border-radius: ${Math.round(u * 0.03)}px; padding: ${Math.round(u * 0.05)}px ${Math.round(u * 0.055)}px; font-weight: 700; font-size: ${cSize}px; line-height: 1.5; box-shadow: 0 10px 40px rgba(28,42,34,0.08); }
    .who { color: ${BRAND.muted}; font-size: ${Math.round(u * 0.024)}px; }
  `;
  const body = `
    ${header(card.tag)}
    <div class="mid">
      <div class="label">ベストコメント</div>
      <div class="bubble">${esc(card.text)}</div>
      <div class="who">匿名 · 「${esc(card.ref || "")}」より</div>
    </div>
    ${footer(card.cta || `${APP}で続きを見る →`, card.handle)}
  `;
  return shell(size, body, css);
}

export const TEMPLATES = { balance, topic, comment };
