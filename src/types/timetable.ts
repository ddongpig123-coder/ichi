export const DAYS = ["月", "火", "水", "木", "金", "土"] as const;
export type Day = (typeof DAYS)[number];

export const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_TIMES: Record<Period, { start: string; end: string }> = {
  1: { start: "09:00", end: "10:40" },
  2: { start: "10:50", end: "12:30" },
  3: { start: "13:30", end: "15:10" },
  4: { start: "15:20", end: "17:00" },
  5: { start: "17:10", end: "18:50" },
  6: { start: "19:00", end: "20:40" },
  7: { start: "20:50", end: "21:40" },
};

export interface ClassSession {
  id: string;
  day: Day;
  period: Period;
  name: string;
  teacher: string;
  room: string;
  color: string;
}

// 色選択UIのデフォルト5色（+ボタンを押すと拡張パレットが開く）
export const PRESET_COLORS = ["#2F6AD9", "#E2574C", "#2FA84F", "#F0A93B", "#8E5CD9"];

// 拡張パレット（+ボタンで表示）
export const EXTRA_COLORS = [
  "#16A3B0", "#D94A8C", "#6B7280", "#C2410C", "#0EA5E9",
  "#65A30D", "#A21CAF", "#DC2626", "#0D9488", "#7C3AED",
  "#CA8A04", "#475569",
];

// 教務システム連携前の仮データ。ClassSession[] であれば useTimetable に渡すだけで
// 表示に反映されるので、将来 Firestore などに置き換えても呼び出し側は変更不要。
export const MOCK_TIMETABLE: ClassSession[] = [
  { id: "1", day: "木", period: 1, name: "商品学A", teacher: "上原 義子", room: "1013教室", color: PRESET_COLORS[0] },
  { id: "2", day: "水", period: 3, name: "レジャービジネス論", teacher: "野澤 智行", room: "1013教室", color: PRESET_COLORS[1] },
  { id: "3", day: "木", period: 4, name: "商学専門演習（4年）", teacher: "鈴木 仁里", room: "2121番教室", color: PRESET_COLORS[2] },
  { id: "4", day: "木", period: 5, name: "流通システム論B", teacher: "原 頼利", room: "1063教室", color: PRESET_COLORS[3] },
];
