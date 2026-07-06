import { type ClassSession } from "../types/timetable";
import { PRESET_COLORS } from "../types/timetable";

export type Semester = "春" | "秋";
export type SemesterKey = `${number}-${"春" | "秋"}`;

export const ENROLLMENT_YEAR = 2024;

export const SEMESTER_TIMETABLES: Record<SemesterKey, ClassSession[]> = {
  "2024-春": [
    { id: "s1", day: "月", period: 3, name: "経営学入門", teacher: "田中 誠一", room: "201教室", color: PRESET_COLORS[0] },
    { id: "s2", day: "火", period: 2, name: "基礎英語A", teacher: "Smith J.", room: "語学棟L21", color: PRESET_COLORS[2] },
    { id: "s3", day: "水", period: 4, name: "情報処理基礎", teacher: "木村 健太", room: "PC実習室A", color: PRESET_COLORS[3] },
    { id: "s4", day: "木", period: 1, name: "ミクロ経済学入門", teacher: "山田 花子", room: "301教室", color: PRESET_COLORS[4] },
    { id: "s5", day: "金", period: 2, name: "商学概論", teacher: "伊藤 隆", room: "102教室", color: PRESET_COLORS[1] },
  ],
  "2024-秋": [
    { id: "a1", day: "月", period: 2, name: "マクロ経済学入門", teacher: "山田 花子", room: "301教室", color: PRESET_COLORS[0] },
    { id: "a2", day: "火", period: 3, name: "基礎英語B", teacher: "Smith J.", room: "語学棟L21", color: PRESET_COLORS[2] },
    { id: "a3", day: "水", period: 2, name: "会計学基礎", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[1] },
    { id: "a4", day: "木", period: 3, name: "経営統計学", teacher: "鈴木 博", room: "203教室", color: PRESET_COLORS[3] },
    { id: "a5", day: "金", period: 4, name: "日本経済史", teacher: "渡辺 悠", room: "104教室", color: PRESET_COLORS[4] },
  ],
  "2025-春": [
    { id: "b1", day: "月", period: 1, name: "マーケティング論", teacher: "佐藤 明", room: "401教室", color: PRESET_COLORS[0] },
    { id: "b2", day: "火", period: 4, name: "商業英語A", teacher: "Brown M.", room: "語学棟L11", color: PRESET_COLORS[2] },
    { id: "b3", day: "水", period: 2, name: "簿記A", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[1] },
    { id: "b4", day: "木", period: 2, name: "流通論", teacher: "原 頼利", room: "305教室", color: PRESET_COLORS[3] },
    { id: "b5", day: "金", period: 3, name: "経営組織論", teacher: "田中 誠一", room: "401教室", color: PRESET_COLORS[4] },
    { id: "b6", day: "月", period: 4, name: "データサイエンス入門", teacher: "木村 健太", room: "PC実習室B", color: "#16A3B0" },
  ],
  "2025-秋": [
    { id: "c1", day: "月", period: 3, name: "消費者行動論", teacher: "佐藤 明", room: "401教室", color: PRESET_COLORS[0] },
    { id: "c2", day: "火", period: 2, name: "商業英語B", teacher: "Brown M.", room: "語学棟L11", color: PRESET_COLORS[2] },
    { id: "c3", day: "水", period: 3, name: "簿記B", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[1] },
    { id: "c4", day: "木", period: 4, name: "国際ビジネス論", teacher: "渡辺 悠", room: "302教室", color: PRESET_COLORS[3] },
    { id: "c5", day: "金", period: 1, name: "人的資源管理論", teacher: "田中 誠一", room: "402教室", color: PRESET_COLORS[4] },
  ],
  "2026-春": [
    { id: "1", day: "木", period: 1, name: "商品学A", teacher: "上原 義子", room: "1013教室", color: PRESET_COLORS[0] },
    { id: "2", day: "水", period: 3, name: "レジャービジネス論", teacher: "野澤 智行", room: "1013教室", color: PRESET_COLORS[1] },
    { id: "3", day: "木", period: 4, name: "商学専門演習（4年）", teacher: "鈴木 仁里", room: "2121番教室", color: PRESET_COLORS[2] },
    { id: "4", day: "木", period: 5, name: "流通システム論B", teacher: "原 頼利", room: "1063教室", color: PRESET_COLORS[3] },
  ],
  "2026-秋": [],
};

export const SEMESTER_FRIEND_OVERLAPS: Record<SemesterKey, Record<string, string[]>> = {
  "2024-春": { "木-1": ["2", "6"], "金-2": ["5"] },
  "2024-秋": { "火-3": ["1", "7"], "木-3": ["8"] },
  "2025-春": { "水-2": ["2", "5"], "金-3": ["6", "7"] },
  "2025-秋": { "水-3": ["3", "8"], "月-3": ["1"] },
  "2026-春": {
    "木-1": ["1", "5"],
    "水-3": ["2", "6", "7"],
    "木-4": ["3"],
    "木-5": ["5", "8"],
  },
  "2026-秋": {},
};

export function getCurrentSemester(): Semester {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 8 ? "春" : "秋";
}

export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from(
    { length: currentYear - ENROLLMENT_YEAR + 1 },
    (_, i) => ENROLLMENT_YEAR + i
  );
}

export function isSemesterAvailable(year: number, semester: Semester): boolean {
  const currentYear = new Date().getFullYear();
  const currentSemester = getCurrentSemester();
  if (year < currentYear) return true;
  if (year === currentYear) return semester === "春" || currentSemester === "秋";
  return false;
}
