import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { PERIOD_TIMES, type ClassSession, type Day } from "../types/timetable";
import { getCurrentAcademicYear, getCurrentSemester } from "../data/semesterTimetables";
import { TRANSLATIONS, dayLabel } from "../i18n/translations";
import { getTimetable } from "./timetableService";
import type { TodayWidgetProps, WeekGrid, WidgetClass, WidgetPage } from "../widgets/TodayTimetableWidget";

// ============================================================
// iPhone ホーム画面ウィジェット「今日の時間割」へのデータ渡し（RELEASE-PLAN N4 / docs/WIDGET.md）
//
// 🔴 旧バイナリ（ストア版 1.0.0）を落とさないこと — expo-widgets は新しいネイティブ部品。
//   ウィジェット本体（src/widgets/TodayTimetableWidget.tsx）はトップレベルで import せず、
//   部品があるときだけ関数の中で require する（AGENTS.md 作業手順 / 本例 timetableOcrService）。
//   Android・Web・旧アプリでは canUseWidgets = false で何もしない（友達の時間割も読まない）。
//
// 表示（2026-11-17 準熙）:
//   小・ロック画面 = 今日の授業 / 中・大 = 今週の時間割（表）。◀ ▶ で「自分 → よく使う友達」を切り替え
//
// ウィジェットは自分で時刻を見て計算できない（別の実行環境・純粋関数）ので、
// 「いつから何を表示するか」を今日から 7 日分まとめて渡す（タイムライン）:
//   今日・明日 = 0 時 + 各授業の始まり・終わり（「授業中」の表示が変わる）/ 3 日目以降 = 0 時だけ。
//   7 日を過ぎたら「アプリを開くと更新されます」。
// 対象は「今の学期」の時間割だけ（ホームで別の学期を見ていても変わらない）。
// ============================================================

type WidgetModule = typeof import("../widgets/TodayTimetableWidget");
type Lang = "ja" | "ko";

export const canUseWidgets: boolean =
  Platform.OS === "ios" && requireOptionalNativeModule("ExpoWidgets") != null;

let widgetModule: WidgetModule | null | undefined;
function loadWidget(): WidgetModule | null {
  if (!canUseWidgets) return null;
  if (widgetModule !== undefined) return widgetModule;
  try {
    widgetModule = require("../widgets/TodayTimetableWidget") as WidgetModule;
  } catch (e) {
    console.warn("widget load failed:", e);
    widgetModule = null;
  }
  return widgetModule;
}

/** 今の学期のキー（ホームと同じ「2026-秋」形式） */
export function currentSemesterKey(now = new Date()): string {
  return `${getCurrentAcademicYear(now)}-${getCurrentSemester(now)}`;
}

// Date#getDay(): 0 = 日曜
const JS_DAY: (Day | null)[] = [null, "月", "火", "水", "木", "金", "土"];
const JS_DAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];
/** 細かく（授業の始まり・終わりごとに）切り替える日数。それ以降は 0 時だけ */
const DETAILED_DAYS = 2;

function atTime(day: Date, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime();
}
const shortTime = (hhmm: string) => hhmm.replace(/^0/, "");

export interface WidgetEntry {
  date: Date;
  props: TodayWidgetProps;
}

/** ウィジェットに載せる友達（よく使う友達のうち、時間割を見られる人） */
export interface WidgetFriend {
  nickname: string;
  sessions: ClassSession[];
}

/** 一人分の「今週の時間割」の表。highlight: 今日の列で強調するコマ（時限 → 1 授業中 / 2 次） */
function weekGrid(
  sessions: ClassSession[],
  lang: Lang,
  today: Date,
  highlight: Record<number, number>
): WeekGrid | null {
  if (sessions.length === 0) return null;
  const cols: Day[] = sessions.some((s) => s.day === "土")
    ? ["月", "火", "水", "木", "金", "土"]
    : ["月", "火", "水", "木", "金"];
  const used = sessions.map((s) => s.period);
  const minP = Math.min(...used);
  const maxP = Math.max(...used);
  const todayCode = JS_DAY[today.getDay()];
  const rows: WeekGrid["rows"] = [];
  for (let p = minP; p <= maxP; p++) {
    rows.push({
      p: String(p),
      cells: cols.map((d) => {
        const s = sessions.find((x) => x.day === d && x.period === p);
        if (!s) return 0; // 空きコマ。null は不可（下の plistSafe 参照）
        return { n: s.name.slice(0, 12), c: s.color || "#2F6AD9", s: d === todayCode ? highlight[p] ?? 0 : 0 };
      }),
    });
  }
  return {
    days: cols.map((d) => dayLabel(lang, d)),
    today: todayCode ? cols.indexOf(todayCode) : -1,
    rows,
  };
}

/**
 * 今日から `days` 日分のタイムラインを作る（テストしやすいように純粋関数）。
 * 各エントリーの時刻から次のエントリーまで、その props が表示される。
 */
export function buildTodayTimeline(
  sessions: ClassSession[],
  lang: Lang,
  url: string,
  now = new Date(),
  opts: { friends?: WidgetFriend[]; days?: number } = {}
): WidgetEntry[] {
  const L = TRANSLATIONS[lang];
  const days = opts.days ?? 7;
  const friends = (opts.friends ?? []).filter((f) => f.sessions.length > 0);
  const base = {
    heading: L["widget.heading"],
    nowLabel: L["widget.now"],
    nextLabel: L["widget.next"],
    more: L["widget.more"],
    url,
    page: 0,
  };
  const dateLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${dayLabel(lang, JS_DAY_LABEL[d.getDay()])})`;
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  // 中・大のページ: 自分（時間割があれば）→ よく使う友達
  const pagesFor = (day: Date, highlight: Record<number, number>): WidgetPage[] => {
    const pages: WidgetPage[] = [];
    const mine = weekGrid(sessions, lang, day, highlight);
    if (mine) pages.push({ t: L["widget.myTimetable"], week: mine });
    for (const f of friends) {
      const g = weekGrid(f.sessions, lang, day, {});
      if (g) pages.push({ t: L["widget.friendTimetable"].replace("{name}", f.nickname), week: g });
    }
    return pages;
  };

  if (sessions.length === 0 && friends.length === 0) {
    return [{ date: now, props: { ...base, title: "", items: [], msg: L["widget.noTimetable"], pages: [] } }];
  }

  const semKey = currentSemesterKey(now);
  const nowMs = now.getTime();
  const entries: WidgetEntry[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(now, i);
    const title = dateLabel(day);
    // 学期が変わる日以降は、その学期の時間割をまだ読んでいない → アプリを開いてもらう
    if (currentSemesterKey(day) !== semKey) {
      entries.push({
        date: new Date(Math.max(day.getTime(), nowMs)),
        props: { ...base, title, items: [], msg: L["widget.openApp"], pages: [] },
      });
      return entries;
    }
    const code = JS_DAY[day.getDay()];
    const todays = code ? sessions.filter((s) => s.day === code).sort((a, b) => a.period - b.period) : [];
    const detailed = i < DETAILED_DAYS;

    // 表示が変わる時刻: その日の 0 時（今日は「今」）+（今日・明日は）各授業の始まり・終わり
    const points = new Set<number>([i === 0 ? nowMs : day.getTime()]);
    if (detailed) {
      for (const s of todays) {
        const t = PERIOD_TIMES[s.period];
        points.add(atTime(day, t.start));
        points.add(atTime(day, t.end));
      }
    }
    const sorted = [...points].filter((ms) => ms >= nowMs).sort((a, b) => a - b);

    for (const at of sorted) {
      let anyNow = false;
      const items: WidgetClass[] = todays.map((s) => {
        const t = PERIOD_TIMES[s.period];
        let state = 3;
        if (detailed) {
          if (atTime(day, t.end) <= at) state = 0;
          else if (atTime(day, t.start) <= at) {
            state = 1;
            anyNow = true;
          }
        }
        return {
          p: `${s.period}${L["timetable.periodSuffix"]}`,
          tm: `${shortTime(t.start)}–${shortTime(t.end)}`,
          n: s.name,
          r: s.room ?? "",
          c: s.color || "#2F6AD9",
          s: state,
        };
      });
      // 授業中が無いときは、まだ始まっていない最初の授業が「次の授業」
      // （0 時にしか切り替えない 3 日目以降は、終わっても「次」のまま残るので付けない）
      if (detailed && !anyNow) {
        const first = items.find((it) => it.s === 3);
        if (first) first.s = 2;
      }
      const highlight: Record<number, number> = {};
      todays.forEach((s, k) => {
        if (items[k].s === 1 || items[k].s === 2) highlight[s.period] = items[k].s;
      });
      const msg =
        sessions.length === 0
          ? L["widget.noTimetable"]
          : todays.length === 0
            ? L["widget.noClassToday"]
            : items.every((it) => it.s === 0)
              ? L["widget.allDone"]
              : "";
      entries.push({ date: new Date(at), props: { ...base, title, items, msg, pages: pagesFor(day, highlight) } });
    }
  }

  // 最後: 渡した日数を過ぎたら、アプリを開いてもらう
  const end = addDays(now, days);
  entries.push({
    date: end,
    props: { ...base, title: dateLabel(end), items: [], msg: L["widget.openApp"], pages: [] },
  });
  return entries;
}

/**
 * ウィジェットの見た目（レイアウト）を端末に登録する。読み込むだけで登録される。
 * 時間割の読み込みに失敗しても、ウィジェットが真っ白にならないように先に呼ぶ
 */
export function prepareTodayWidget(): void {
  loadWidget();
}

// ── よく使う友達の時間割（ウィジェットの ◀ ▶ 用）
// 読み取りを増やしすぎないよう、一人ずつ 30 分は読み直さない。非公開・権限なしは載せない
const FRIEND_TTL_MS = 30 * 60 * 1000;
const friendCache = new Map<string, { at: number; sessions: ClassSession[] }>();

export async function loadWidgetFriends(
  friends: { id: string; nickname: string }[],
  semesterKey: string
): Promise<WidgetFriend[]> {
  if (!canUseWidgets || friends.length === 0) return [];
  const now = Date.now();
  const list = await Promise.all(
    friends.map(async (f) => {
      const key = `${f.id}|${semesterKey}`;
      const hit = friendCache.get(key);
      if (hit && now - hit.at < FRIEND_TTL_MS) return { nickname: f.nickname, sessions: hit.sessions };
      let sessions: ClassSession[] = [];
      try {
        sessions = (await getTimetable(f.id, semesterKey))?.sessions ?? [];
      } catch {
        sessions = []; // 非公開（permission-denied）など
      }
      friendCache.set(key, { at: now, sessions });
      return { nickname: f.nickname, sessions };
    })
  );
  return list.filter((f) => f.sessions.length > 0);
}

/**
 * 🔴 ウィジェットのデータは端末の UserDefaults（App Group）に保存される。UserDefaults は
 * null（と undefined・NaN）を保存できず、入っていると **ネイティブ側で例外 → アプリが強制終了** する
 * （JS の try/catch では止められない）。起動直後に落ちると OTA は自動で前の版に戻る
 * — 2026-11-17 試験版で実際に起きた（空きコマを null にしていた）。
 * なので渡す直前に必ず取り除く: オブジェクトの null 値は消す / 配列の null は 0 にする。
 */
export function plistSafe(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (Array.isArray(v)) return v.map((x) => (x === null || x === undefined ? 0 : plistSafe(x)));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const safe = plistSafe(x);
      if (safe !== undefined) out[k] = safe;
    }
    return out;
  }
  return v;
}

let lastSignature = "";

/**
 * ホームで今の学期の時間割（と、よく使う友達の時間割）を読んだ・保存したときに呼ぶ。
 * 同じ内容・同じ時間帯なら書き直さない（ウィジェットの再読み込みを無駄に起こさない）。
 */
export function updateTodayWidget(
  sessions: ClassSession[],
  lang: Lang,
  url: string,
  friends: WidgetFriend[] = []
): void {
  const W = loadWidget();
  if (!W) return;
  const now = new Date();
  const pick = (list: ClassSession[]) => list.map((s) => [s.day, s.period, s.name, s.room, s.color]);
  const signature = JSON.stringify([
    now.toDateString(),
    now.getHours(),
    lang,
    url,
    pick(sessions),
    friends.map((f) => [f.nickname, pick(f.sessions)]),
  ]);
  if (signature === lastSignature) return;
  try {
    const entries = buildTodayTimeline(sessions, lang, url, now, { friends }).map((e) => ({
      date: e.date,
      props: plistSafe(e.props) as TodayWidgetProps,
    }));
    W.default.updateTimeline(entries);
    lastSignature = signature;
  } catch (e) {
    console.warn("widget update failed:", e);
  }
}
