import type { Course } from "../types/course";
import type { Day, Period } from "../types/timetable";

// ============================================================
// 時間割メーカー（自動作成）のコアロジック — RN 非依存の純関数群。
// 講義候補プール + 制約（必須講義・目標単位範囲）から、時間が重ならない
// 時間割の組み合わせを列挙する。ランタイムは決定論的（ROADMAP §5 準拠）。
// ============================================================

// 講義（同じ courseNumber の複数コマをまとめた単位）。週2コマ等は必ずセットで配置する。
export interface CourseUnit {
  key: string; // グルーピングキー（courseNumber、無ければ name+teacher）
  name: string;
  teacher: string;
  credits: number; // 単位数（不明は 0 扱い）
  slots: { day: Day; period: Period }[];
  courses: Course[]; // このユニットに属する Course ドキュメント（コマ単位）
}

const slotKey = (day: Day, period: Period) => `${day}${period}`;

// 講義名 + 教員 + 科目ナンバーでコマをまとめる。同一キーは週複数コマの同一講義と
// みなし、必ずセットで配置する。
// ※ courseNumber 単独では束ねない: シラバスデータは未採番講義に "-" 等の
//   プレースホルダを共有で持つことがあり、それだと別々の講義まで1つに融合してしまう。
//   名前・教員を含めることで、本当に同一の講義（曜日/時限違い）だけをまとめる。
export function groupCourseUnits(courses: Course[]): CourseUnit[] {
  const map = new Map<string, CourseUnit>();
  for (const c of courses) {
    const key = `${c.name}@@${c.teacher}@@${c.courseNumber ?? ""}`;
    let u = map.get(key);
    if (!u) {
      u = { key, name: c.name, teacher: c.teacher, credits: c.credits ?? 0, slots: [], courses: [] };
      map.set(key, u);
    }
    if (!u.slots.some((s) => s.day === c.day && s.period === c.period)) {
      u.slots.push({ day: c.day, period: c.period });
      u.courses.push(c);
    }
    u.credits = Math.max(u.credits, c.credits ?? 0); // 単位はユニットにつき1つ（コマ間で同じはず）
  }
  return [...map.values()];
}

export interface WizardConstraints {
  requiredKeys: string[]; // 必ず含めるユニットの key
  minCredits: number;
  maxCredits: number;
  maxResults?: number; // 返す組み合わせの上限（既定 30）
}

export interface WizardResult {
  units: CourseUnit[];
  totalCredits: number;
  gapCount: number; // 各曜日の最初〜最後のコマ間に空くコマ数の合計（少ないほど詰まった時間割）
}

export interface WizardOutcome {
  results: WizardResult[];
  requiredConflict: boolean; // 必須ユニット同士が衝突して不可能
  truncated: boolean; // 探索打ち切り（結果上限/ノード上限に到達）
}

// 空きコマ（同じ曜日で授業の間に空く時限）の合計。ランキングの2次キー。
function countGaps(units: CourseUnit[]): number {
  const byDay = new Map<Day, number[]>();
  for (const u of units)
    for (const s of u.slots) {
      const arr = byDay.get(s.day) ?? [];
      arr.push(s.period);
      byDay.set(s.day, arr);
    }
  let gaps = 0;
  for (const periods of byDay.values()) {
    if (periods.length < 2) continue;
    periods.sort((a, b) => a - b);
    gaps += periods[periods.length - 1] - periods[0] + 1 - periods.length;
  }
  return gaps;
}

const MAX_NODES = 200000; // 組み合わせ爆発の保険（候補が多すぎても固まらない）

export function generateTimetables(units: CourseUnit[], c: WizardConstraints): WizardOutcome {
  const maxResults = c.maxResults ?? 30;
  // 詰まった時間割を先に見つけやすいよう、任意ユニットは単位数の多い順に試す。
  const required = units.filter((u) => c.requiredKeys.includes(u.key));
  const optional = units
    .filter((u) => !c.requiredKeys.includes(u.key))
    .sort((a, b) => b.credits - a.credits);

  // 必須ユニットをまず配置（衝突チェック）。
  const occupied = new Set<string>();
  let baseCredits = 0;
  for (const u of required) {
    for (const s of u.slots) {
      const k = slotKey(s.day, s.period);
      if (occupied.has(k)) return { results: [], requiredConflict: true, truncated: false };
      occupied.add(k);
    }
    baseCredits += u.credits;
  }
  if (baseCredits > c.maxCredits) return { results: [], requiredConflict: false, truncated: false };

  const collectCap = Math.max(maxResults * 3, 60); // 少し多めに集めてから並べ替え・上位抽出
  const results: WizardResult[] = [];
  const chosen: CourseUnit[] = [];
  let nodes = 0;
  let truncated = false;

  const fits = (u: CourseUnit): boolean =>
    u.slots.every((s) => !occupied.has(slotKey(s.day, s.period)));
  const add = (u: CourseUnit) => {
    for (const s of u.slots) occupied.add(slotKey(s.day, s.period));
  };
  const remove = (u: CourseUnit) => {
    for (const s of u.slots) occupied.delete(slotKey(s.day, s.period));
  };
  const record = (credits: number) => {
    if (credits < c.minCredits || credits > c.maxCredits) return;
    const all = [...required, ...chosen];
    results.push({ units: all, totalCredits: credits, gapCount: countGaps(all) });
  };

  const dfs = (i: number, credits: number) => {
    if (results.length >= collectCap || ++nodes > MAX_NODES) {
      truncated = true;
      return;
    }
    if (credits >= c.minCredits) record(credits); // 現在の選択が範囲内なら1つの解として記録
    if (i >= optional.length || credits >= c.maxCredits) return;
    for (let j = i; j < optional.length; j++) {
      const u = optional[j];
      if (credits + u.credits > c.maxCredits || !fits(u)) continue;
      add(u);
      chosen.push(u);
      dfs(j + 1, credits + u.credits);
      chosen.pop();
      remove(u);
      if (results.length >= collectCap || nodes > MAX_NODES) {
        truncated = true;
        return;
      }
    }
  };
  dfs(0, baseCredits);

  // ランキング: 単位数が多い順（範囲内で詰まった時間割）→ 空きコマ少ない順。
  results.sort((a, b) => b.totalCredits - a.totalCredits || a.gapCount - b.gapCount);
  return { results: results.slice(0, maxResults), requiredConflict: false, truncated };
}
