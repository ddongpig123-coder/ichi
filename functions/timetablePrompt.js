// 時間割スクリーンショット読み取りのプロンプトと、モデル出力の検証（純粋関数 — テストしやすく分けてある）。
// 精度テストの結果と方針: docs/TIMETABLE-OCR.md §3-1（Sonnet 5.5 に決定）。
// プロンプトは scripts/ocr-timetable-test.mjs で 22/22 だったものを土台に、
// 時限表を「その学校の時限表」に差し替えられるようにした（§3-2: 明治固定だと他校で時限がずれる）。

export const DAYS = ["月", "火", "水", "木", "金", "土", "日"];

// 学校の時限表が届かなかったときの既定（明治。src/types/timetable.ts PERIOD_TIMES と同じ）
export const DEFAULT_PERIODS = [
  { period: 1, start: "09:00", end: "10:40" },
  { period: 2, start: "10:50", end: "12:30" },
  { period: 3, start: "13:30", end: "15:10" },
  { period: 4, start: "15:20", end: "17:00" },
  { period: 5, start: "17:10", end: "18:50" },
  { period: 6, start: "19:00", end: "20:40" },
  { period: 7, start: "20:50", end: "21:40" },
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// クライアントが送ってきた時限表を検証する。おかしければ null（呼び出し側で既定に戻す）
export function sanitizePeriods(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 10) return null;
  const out = [];
  for (const p of input) {
    if (!p || !Number.isInteger(p.period) || p.period < 1 || p.period > 10) return null;
    if (typeof p.start !== "string" || typeof p.end !== "string" || !HHMM.test(p.start) || !HHMM.test(p.end)) return null;
    out.push({ period: p.period, start: p.start, end: p.end });
  }
  return out;
}

export function buildPrompt(periods) {
  const table = periods.map((p) => `${p.period}限 ${p.start}-${p.end}`).join(" / ");
  return `これは日本の大学の時間割（学生ポータルのスクリーンショット）です。表に書かれている授業を全部読み取り、JSON だけを返してください。説明文は不要です。

時限と時刻の対応（画像に時刻しか無い場合はこれで時限に直す）:
${table}

ルール:
- 空いているマスは出力しない。1つのマスに授業が2つあれば2件にする。
- 曜日は 月 火 水 木 金 土 日 のどれか。時限は上の表にある整数。
- 講義名は画像の表記のまま（略さない・推測で補わない）。教員・教室が無ければ null。
- 曜日や時限が決められないもの（集中講義・隔週・オンデマンド・メディア授業・「その他」欄の授業）は sessions に入れず unplaced に理由つきで入れる。
- 学籍番号・氏名など授業以外の情報は出力しない。
- 文字がつぶれて自信が無いときは confidence を "low" にする。
- 時間割の画像でなければ {"sessions":[],"unplaced":[],"notTimetable":true} を返す。

出力形式:
{"sessions":[{"day":"月","period":1,"name":"...","teacher":"...または null","room":"...または null","confidence":"high|low"}],"unplaced":[{"name":"...","reason":"..."}]}`;
}

export function extractJson(text) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("no-json");
  return JSON.parse(text.slice(s, e + 1));
}

const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// モデル出力を、アプリが信用できる形に絞る（未知のキー・範囲外の値・長すぎる文字列は捨てる）
export function sanitizeResult(raw, periods) {
  const allowed = new Set(periods.map((p) => p.period));
  const sessions = [];
  for (const s of Array.isArray(raw?.sessions) ? raw.sessions.slice(0, 60) : []) {
    const name = str(s?.name, 100);
    const period = Number(s?.period);
    if (!name || !DAYS.includes(s?.day) || !Number.isInteger(period) || !allowed.has(period)) continue;
    sessions.push({
      day: s.day,
      period,
      name,
      teacher: str(s?.teacher, 100),
      room: str(s?.room, 100),
      confidence: s?.confidence === "low" ? "low" : "high",
    });
  }
  const unplaced = [];
  for (const u of Array.isArray(raw?.unplaced) ? raw.unplaced.slice(0, 30) : []) {
    const name = str(u?.name, 100);
    if (!name) continue;
    unplaced.push({ name, reason: str(u?.reason, 200) });
  }
  return { sessions, unplaced, notTimetable: raw?.notTimetable === true && sessions.length === 0 };
}
