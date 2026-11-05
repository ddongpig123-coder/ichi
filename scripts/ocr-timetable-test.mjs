// 時間割スクリーンショット → Claude で読み取り精度テスト（アプリとは無関係の実験スクリプト）
//
//   cd scripts && npm install
//   ANTHROPIC_API_KEY=sk-ant-... node ocr-timetable-test.mjs --images ~/tt/*.png
//   ANTHROPIC_API_KEY=sk-ant-... node ocr-timetable-test.mjs --images ~/tt/*.png --models haiku,sonnet,opus --truth ~/tt/truth.json
//
// 何をするか:
//   画像1枚 × モデル1つ ごとに「要日・時限・講義名・教員・教室」を JSON で返させ、
//   表示 + トークン数 + 概算コスト + 所要秒数を出す。--truth があれば正解と突き合わせて的中率も出す。
//   結果は scripts/output/ocr-test-<時刻>.json に保存（output/ は gitignore）。
//
// 🔴 画像は学籍番号・氏名を隠してから使うこと。画像ファイルはリポジトリの外に置く（コミット禁止）。
// 🔴 API キーは環境変数で渡す。ファイルに書かない。
//
// --truth の形式（ファイル名 → 正解の配列。name は先頭数文字が合えば一致扱い）:
//   { "a.png": [ { "day": "月", "period": 1, "name": "マーケティング論" }, ... ] }
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] ?? true] : [])).filter((e) => e.length)
);
// --images は複数パスを取る（シェルの glob 展開後に --models 等の次の "--" まで）
const imagePaths = [];
{
  const i = process.argv.indexOf("--images");
  if (i >= 0) for (let k = i + 1; k < process.argv.length && !process.argv[k].startsWith("--"); k++) imagePaths.push(process.argv[k]);
}
if (!imagePaths.length) { console.error("usage: --images <png/jpg ...> [--models haiku,sonnet,opus] [--truth truth.json]"); process.exit(1); }
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY が未設定です（環境変数で渡す）"); process.exit(1); }

// 料金（USD / 1M tokens、2026-10 時点の一次情報）。Haiku 5.5 は 100K トークン以下の単価。
const MODELS = {
  haiku: { id: "claude-haiku-5-5", in: 0.10, out: 0.50 },
  sonnet: { id: "claude-sonnet-5-5", in: 2.00, out: 10.00 },
  opus: { id: "claude-opus-5-5", in: 4.00, out: 20.00 },
};
const modelKeys = String(args.models ?? "haiku,sonnet").split(",").map((s) => s.trim()).filter((k) => MODELS[k]);
const truth = args.truth ? JSON.parse(fs.readFileSync(String(args.truth), "utf8")) : null;

const MEDIA = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

// アプリの時限（src/types/timetable.ts PERIOD_TIMES と同じ）。画像に時刻しか無い場合の対応表。
const PROMPT = `これは日本の大学の時間割（学生ポータルのスクリーンショット）です。表に書かれている授業を全部読み取り、JSON だけを返してください。説明文は不要です。

時限と時刻の対応（画像に時刻しか無い場合はこれで時限に直す）:
1限 09:00-10:40 / 2限 10:50-12:30 / 3限 13:30-15:10 / 4限 15:20-17:00 / 5限 17:10-18:50 / 6限 19:00-20:40 / 7限 20:50-21:40

ルール:
- 空いているマスは出力しない。1つのマスに授業が2つあれば2件にする。
- 曜日は 月 火 水 木 金 土 のどれか。時限は 1〜7 の整数。
- 講義名は画像の表記のまま（略さない・推測で補わない）。教員・教室が無ければ null。
- 曜日や時限が決められないもの（集中講義・隔週・オンデマンド・備考欄の授業）は sessions に入れず unplaced に理由つきで入れる。
- 文字がつぶれて自信が無いときは confidence を "low" にする。

出力形式:
{"sessions":[{"day":"月","period":1,"name":"...","teacher":"...または null","room":"...または null","confidence":"high|low"}],"unplaced":[{"name":"...","reason":"..."}],"notes":"気づいたこと（任意）"}`;

function extractJson(text) {
  const s = text.indexOf("{"); const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("JSON が見つかりません: " + text.slice(0, 200));
  return JSON.parse(text.slice(s, e + 1));
}
const norm = (s) => (s ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
function sameName(a, b) { const x = norm(a), y = norm(b); const k = Math.min(4, x.length, y.length); return k > 0 && x.slice(0, k) === y.slice(0, k); }

const client = new Anthropic();
const report = { ranAt: new Date().toISOString(), models: modelKeys.map((k) => MODELS[k].id), images: [] };
const totals = Object.fromEntries(modelKeys.map((k) => [k, { usd: 0, hit: 0, truthN: 0, extra: 0, sec: 0, n: 0 }]));

for (const p of imagePaths) {
  const ext = path.extname(p).toLowerCase();
  const mediaType = MEDIA[ext];
  if (!mediaType) { console.warn(`skip (未対応拡張子): ${p}`); continue; }
  const bytes = fs.readFileSync(p);
  if (bytes.length > 5 * 1024 * 1024) { console.warn(`skip (5MB 超): ${p}`); continue; }
  const data = bytes.toString("base64");
  const name = path.basename(p);
  const entry = { file: name, bytes: bytes.length, results: {} };
  console.log(`\n==== ${name} (${(bytes.length / 1024).toFixed(0)} KB) ====`);

  for (const k of modelKeys) {
    const m = MODELS[k];
    const t0 = Date.now();
    let parsed = null, usage = null, err = null, raw = "";
    try {
      const res = await client.messages.create({
        model: m.id,
        max_tokens: 4000,
        // 表の読み取りは「考える」工程が要らない。思考トークンも出力課金なので effort を最低に。
        output_config: { effort: "low" },
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: PROMPT },
        ] }],
      });
      usage = res.usage;
      if (res.stop_reason === "refusal") throw new Error(`refusal: ${res.stop_details?.category ?? ""}`);
      raw = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      parsed = extractJson(raw);
    } catch (e) {
      err = e?.message ?? String(e);
    }
    const sec = (Date.now() - t0) / 1000;
    const usd = usage ? (usage.input_tokens * m.in + usage.output_tokens * m.out) / 1e6 : 0;
    const r = { model: m.id, sec, usage, usd, error: err, sessions: parsed?.sessions ?? [], unplaced: parsed?.unplaced ?? [], notes: parsed?.notes ?? null };

    // 正解との突き合わせ（任意）
    if (truth && truth[name] && !err) {
      const want = truth[name];
      const got = r.sessions;
      const hit = want.filter((w) => got.some((g) => g.day === w.day && Number(g.period) === Number(w.period) && sameName(g.name, w.name))).length;
      r.accuracy = { truth: want.length, hit, missed: want.length - hit, extra: got.length - hit };
      totals[k].hit += hit; totals[k].truthN += want.length; totals[k].extra += Math.max(0, got.length - hit);
    }
    totals[k].usd += usd; totals[k].sec += sec; totals[k].n++;
    entry.results[k] = r;

    console.log(`\n-- ${m.id}: ${sec.toFixed(1)}s, in ${usage?.input_tokens ?? "-"} / out ${usage?.output_tokens ?? "-"} tokens, $${usd.toFixed(4)}${r.accuracy ? ` | 正解 ${r.accuracy.hit}/${r.accuracy.truth} 的中, 余分 ${r.accuracy.extra}` : ""}`);
    if (err) { console.log(`   ✗ ${err}`); continue; }
    for (const s of r.sessions) console.log(`   ${s.day}${s.period}  ${s.name}${s.teacher ? ` / ${s.teacher}` : ""}${s.room ? ` / ${s.room}` : ""}${s.confidence === "low" ? "  (low)" : ""}`);
    for (const u of r.unplaced) console.log(`   [枠外] ${u.name}: ${u.reason}`);
    if (r.notes) console.log(`   notes: ${r.notes}`);
  }
  report.images.push(entry);
}

console.log("\n==== 合計 ====");
for (const k of modelKeys) {
  const t = totals[k];
  const acc = t.truthN ? ` | 的中 ${t.hit}/${t.truthN} (${((t.hit / t.truthN) * 100).toFixed(0)}%), 余分 ${t.extra}` : "";
  console.log(`${MODELS[k].id}: ${t.n}枚, $${t.usd.toFixed(4)} (1枚平均 $${(t.usd / Math.max(1, t.n)).toFixed(4)}), 平均 ${(t.sec / Math.max(1, t.n)).toFixed(1)}s${acc}`);
}
report.totals = totals;
fs.mkdirSync("output", { recursive: true });
const out = path.join("output", `ocr-test-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(`\n保存: scripts/${out}`);
