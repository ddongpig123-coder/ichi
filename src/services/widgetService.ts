import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { PERIOD_TIMES, type ClassSession, type Day } from "../types/timetable";
import { getCurrentAcademicYear, getCurrentSemester } from "../data/semesterTimetables";
import { TRANSLATIONS, dayLabel } from "../i18n/translations";
import type { TodayWidgetProps, WeekGrid, WidgetClass } from "../widgets/TodayTimetableWidget";

// ============================================================
// iPhone ホーム画面ウィジェット「今日の時間割」へのデータ渡し（RELEASE-PLAN N4 / docs/WIDGET.md）
//
// 🔴 旧バイナリ（ストア版 1.0.0）を落とさないこと — expo-widgets は新しいネイティブ部品。
//   ウィジェット本体（src/widgets/TodayTimetableWidget.tsx）はトップレベルで import せず、
//   部品があるときだけ関数の中で require する（AGENTS.md 作業手順 / 本例 timetableOcrService）。
//   Android・Web・旧アプリでは canUseWidgets = false で何もしない。
//
// ウィジェットは自分で時刻を見て計算できない（別の実行環境・純粋関数）ので、
// 「いつから何を表示するか」を今日から 7 日分まとめて渡す（タイムライン）:
//   毎日 0 時 + 各授業の始まり・終わり。数日アプリを開かなくても、その日の時間割に切り替わる。
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

function atTime(day: Date, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime();
}
const shortTime = (hhmm: string) => hhmm.replace(/^0/, "");

export interface WidgetEntry {
  date: Date;
  props: TodayWidgetProps;
}

/**
 * 今日から `days` 日分のタイムラインを作る（テストしやすいように純粋関数）。
 * 各エントリーの時刻から次のエントリーまで、その props が表示される。
 *
 * - 小・中・ロック画面: 今日の授業。今日の授業が無い・全部終わったら **次の授業日（たいてい明日）** の授業
 * - 大: **今週の時間割**（月〜金、土曜に授業があれば土まで）。今日の列と「授業中・次の授業」を強調
 */
export function buildTodayTimeline(
  sessions: ClassSession[],
  lang: Lang,
  url: string,
  now = new Date(),
  days = 7
): WidgetEntry[] {
  const L = TRANSLATIONS[lang];
  const base = {
    nowLabel: L["widget.now"],
    nextLabel: L["widget.next"],
    more: L["widget.more"],
    weekHeading: L["widget.headingWeek"],
    url,
  };
  const dateLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${dayLabel(lang, JS_DAY_LABEL[d.getDay()])})`;
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  if (sessions.length === 0) {
    return [
      {
        date: now,
        props: { ...base, heading: L["widget.heading"], title: "", tag: "", other: 0, items: [], msg: L["widget.noTimetable"], week: null },
      },
    ];
  }

  const semKey = currentSemesterKey(now);
  const nowMs = now.getTime();
  const entries: WidgetEntry[] = [];

  const sessionsOn = (d: Date) => {
    const code = JS_DAY[d.getDay()];
    return code ? sessions.filter((s) => s.day === code).sort((a, b) => a.period - b.period) : [];
  };
  // その日の授業を、時刻 at から見た状態つきで並べる（授業中が無ければ、最初のまだの授業が「次」）
  const itemsAt = (d: Date, list: ClassSession[], at: number): WidgetClass[] => {
    let anyNow = false;
    const items: WidgetClass[] = list.map((s) => {
      const t = PERIOD_TIMES[s.period];
      const start = atTime(d, t.start);
      const end = atTime(d, t.end);
      let state = 3;
      if (end <= at) state = 0;
      else if (start <= at) {
        state = 1;
        anyNow = true;
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
    if (!anyNow) {
      const first = items.find((it) => it.s === 3);
      if (first) first.s = 2;
    }
    return items;
  };
  // 次に授業がある日（同じ学期の中だけ。時間割は毎週同じなので 7 日先まで見れば足りる）
  const nextClassDay = (d: Date): Date | null => {
    for (let k = 1; k <= 7; k++) {
      const nd = addDays(d, k);
      if (currentSemesterKey(nd) !== semKey) return null;
      if (sessionsOn(nd).length > 0) return nd;
    }
    return null;
  };

  // 大きいウィジェットの「今週の時間割」の骨組み（日によって変わらない部分）
  const DAY_COLS: Day[] = sessions.some((s) => s.day === "土")
    ? ["月", "火", "水", "木", "金", "土"]
    : ["月", "火", "水", "木", "金"];
  const used = sessions.map((s) => s.period);
  const minP = Math.min(...used);
  const maxP = Math.max(...used);
  const cellOf = (day: Day, period: number) => sessions.find((s) => s.day === day && s.period === period);
  const weekAt = (today: Date, shown: Date, items: WidgetClass[]): WeekGrid => {
    const shownCode = JS_DAY[shown.getDay()];
    const rows: WeekGrid["rows"] = [];
    for (let p = minP; p <= maxP; p++) {
      rows.push({
        p: String(p),
        cells: DAY_COLS.map((d) => {
          const s = cellOf(d, p);
          if (!s) return null;
          // 表示中の日（今日 or 次の授業日）の「授業中・次の授業」だけ強調
          let state = 0;
          if (d === shownCode) {
            const it = items.find((x) => x.p === `${p}${L["timetable.periodSuffix"]}` && x.n === s.name);
            if (it && (it.s === 1 || it.s === 2)) state = it.s;
          }
          return { n: s.name.slice(0, 12), c: s.color || "#2F6AD9", s: state };
        }),
      });
    }
    const todayCode = JS_DAY[today.getDay()];
    return {
      days: DAY_COLS.map((d) => dayLabel(lang, d)),
      today: todayCode ? DAY_COLS.indexOf(todayCode) : -1,
      rows,
    };
  };

  for (let i = 0; i < days; i++) {
    const day = addDays(now, i);
    // 学期が変わる日以降は、その学期の時間割をまだ読んでいない → アプリを開いてもらう
    if (currentSemesterKey(day) !== semKey) {
      entries.push({
        date: new Date(Math.max(day.getTime(), nowMs)),
        props: { ...base, heading: L["widget.heading"], title: dateLabel(day), tag: "", other: 0, items: [], msg: L["widget.openApp"], week: null },
      });
      return entries;
    }
    const todays = sessionsOn(day);

    // 表示が変わる時刻: その日の 0 時（今日は「今」）+ 各授業の始まり・終わり
    const points = new Set<number>([i === 0 ? nowMs : day.getTime()]);
    for (const s of todays) {
      const t = PERIOD_TIMES[s.period];
      points.add(atTime(day, t.start));
      points.add(atTime(day, t.end));
    }
    const sorted = [...points].filter((ms) => ms >= nowMs).sort((a, b) => a - b);

    for (const at of sorted) {
      let items = itemsAt(day, todays, at);
      let shown = day;
      let other = 0;
      // 今日の授業が無い・全部終わった → 次の授業日の授業を出す
      if (!items.some((it) => it.s !== 0)) {
        const nd = nextClassDay(day);
        if (nd) {
          shown = nd;
          other = 1;
          items = itemsAt(nd, sessionsOn(nd), at);
        }
      }
      const tomorrow = other === 1 && shown.getTime() === addDays(day, 1).getTime();
      const heading = other === 0 ? L["widget.heading"] : tomorrow ? L["widget.headingTomorrow"] : L["widget.headingNextDay"];
      const msg =
        other === 1
          ? ""
          : todays.length === 0
            ? L["widget.noClassToday"]
            : items.every((it) => it.s === 0)
              ? L["widget.allDone"]
              : "";
      entries.push({
        date: new Date(at),
        props: {
          ...base,
          heading,
          title: dateLabel(shown),
          tag: tomorrow ? L["widget.tomorrow"] : "",
          other,
          items,
          msg,
          week: weekAt(day, shown, items),
        },
      });
    }
  }

  // 最後: 渡した日数を過ぎたら、アプリを開いてもらう
  const end = addDays(now, days);
  entries.push({
    date: end,
    props: { ...base, heading: L["widget.heading"], title: dateLabel(end), tag: "", other: 0, items: [], msg: L["widget.openApp"], week: null },
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

let lastSignature = "";

/**
 * ホームで今の学期の時間割を読んだ・保存したときに呼ぶ。
 * 同じ内容・同じ日なら書き直さない（ウィジェットの再読み込みを無駄に起こさない）。
 */
export function updateTodayWidget(sessions: ClassSession[], lang: Lang, url: string): void {
  const W = loadWidget();
  if (!W) return;
  const now = new Date();
  const signature = JSON.stringify([
    now.toDateString(),
    now.getHours(),
    lang,
    url,
    sessions.map((s) => [s.day, s.period, s.name, s.room, s.color]),
  ]);
  if (signature === lastSignature) return;
  try {
    W.default.updateTimeline(buildTodayTimeline(sessions, lang, url, now));
    lastSignature = signature;
  } catch (e) {
    console.warn("widget update failed:", e);
  }
}
