import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { PERIOD_TIMES, type ClassSession, type Day } from "../types/timetable";
import { getCurrentAcademicYear, getCurrentSemester } from "../data/semesterTimetables";
import { TRANSLATIONS, dayLabel } from "../i18n/translations";
import type { TodayWidgetProps, WidgetClass } from "../widgets/TodayTimetableWidget";

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
    heading: L["widget.heading"],
    nowLabel: L["widget.now"],
    nextLabel: L["widget.next"],
    more: L["widget.more"],
    url,
  };

  if (sessions.length === 0) {
    return [{ date: now, props: { ...base, title: "", items: [], msg: L["widget.noTimetable"] } }];
  }

  const semKey = currentSemesterKey(now);
  const nowMs = now.getTime();
  const entries: WidgetEntry[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const title = `${day.getMonth() + 1}/${day.getDate()}(${dayLabel(lang, JS_DAY_LABEL[day.getDay()])})`;
    // 学期が変わる日以降は、その学期の時間割をまだ読んでいない → アプリを開いてもらう
    if (currentSemesterKey(day) !== semKey) {
      entries.push({
        date: new Date(Math.max(day.getTime(), nowMs)),
        props: { ...base, title, items: [], msg: L["widget.openApp"] },
      });
      return entries;
    }
    const code = JS_DAY[day.getDay()];
    const todays = code
      ? sessions.filter((s) => s.day === code).sort((a, b) => a.period - b.period)
      : [];

    // 表示が変わる時刻: その日の 0 時（今日は「今」）+ 各授業の始まり・終わり
    const points = new Set<number>([i === 0 ? nowMs : day.getTime()]);
    for (const s of todays) {
      const t = PERIOD_TIMES[s.period];
      points.add(atTime(day, t.start));
      points.add(atTime(day, t.end));
    }
    const sorted = [...points].filter((ms) => ms >= nowMs).sort((a, b) => a - b);

    for (const at of sorted) {
      let nextMarked = false;
      let anyNow = false;
      const items: WidgetClass[] = todays.map((s) => {
        const t = PERIOD_TIMES[s.period];
        const start = atTime(day, t.start);
        const end = atTime(day, t.end);
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
      // 授業中が無いときは、まだ始まっていない最初の授業が「次の授業」
      if (!anyNow) {
        for (const it of items) {
          if (it.s === 3 && !nextMarked) {
            it.s = 2;
            nextMarked = true;
          }
        }
      }
      const msg =
        todays.length === 0
          ? L["widget.noClassToday"]
          : items.every((it) => it.s === 0)
            ? L["widget.allDone"]
            : "";
      entries.push({ date: new Date(at), props: { ...base, title, items, msg } });
    }
  }

  // 最後: 渡した日数を過ぎたら、アプリを開いてもらう
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  entries.push({
    date: end,
    props: {
      ...base,
      title: `${end.getMonth() + 1}/${end.getDate()}(${dayLabel(lang, JS_DAY_LABEL[end.getDay()])})`,
      items: [],
      msg: L["widget.openApp"],
    },
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
