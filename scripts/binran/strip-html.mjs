// HTML → 표 구조를 살린 평문. 공개 요건 페이지(법정 등)를 파서에 넣기 전에 쓴다.
//   node strip-html.mjs page.html > page.txt
import fs from 'fs';
let h = fs.readFileSync(process.argv[2], 'utf8');
h = h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
h = h.replace(/<\/t[dh]>/gi, ' | ').replace(/<\/tr>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|table)>/gi, '\n');
h = h.replace(/<[^>]+>/g, '');
h = h.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(d));
console.log(h.split('\n').map((s) => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n'));
