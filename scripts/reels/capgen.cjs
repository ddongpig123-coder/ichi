// usage: node capgen.cjs caps.json  -> [{name, style:'k'|'c', jp, kr, note}]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const bear = 'data:image/png;base64,' + fs.readFileSync(__dirname + '/mascot-bear.png').toString('base64');
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const common = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;background:transparent;font-family:"Noto Sans JP","IPAGothic",sans-serif;overflow:hidden}
.bear{position:absolute;right:34px;bottom:30px;height:120px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}`;
const css = {
 k: `.cap{position:absolute;top:1130px;left:40px;right:40px;text-align:center}
.jp{font-size:84px;font-weight:900;line-height:1.28;color:#fff;-webkit-text-stroke:10px #111;paint-order:stroke fill;text-shadow:0 6px 14px rgba(0,0,0,.55)}
.kr{margin-top:22px;font-size:38px;font-weight:700;color:#fff;-webkit-text-stroke:6px #111;paint-order:stroke fill}
.y{color:#FFE066}`,
 c: `.cap{position:absolute;top:70px;left:60px;right:60px;text-align:center}
.jp{font-size:76px;font-weight:900;line-height:1.25;color:#14213d;letter-spacing:-.01em}
.kr{margin-top:18px;font-size:38px;font-weight:700;color:#5b6b8c}
.note{margin-top:10px;font-size:26px;font-weight:700;color:#8a96ad}
.y{background:linear-gradient(transparent 58%,#FFE066 58%);padding:0 4px}`,
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const fontLink = '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&display=swap" rel="stylesheet">';
  for (const it of items) {
    const note = it.note ? `<div class=note>${it.note}</div>` : '';
    await p.setContent(`<!doctype html><meta charset=utf-8>${fontLink}<style>${common}${css[it.style]}</style><div class=cap><div class=jp>${it.jp}</div><div class=kr>${it.kr || ''}</div>${note}</div>${it.extra || ''}<img class=bear src="${bear}">`, { waitUntil: 'load' });
    await Promise.race([p.evaluate(() => document.fonts.ready), new Promise(r => setTimeout(r, 3000))]);
    await p.screenshot({ path: `${it.name}.png`, omitBackground: true });
  }
  await b.close(); console.log('caps', items.length);
})();
