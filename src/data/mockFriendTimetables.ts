import type { ClassSession } from "../types/timetable";
import { PRESET_COLORS } from "../types/timetable";
import type { SemesterKey } from "./semesterTimetables";

// Key format: `${friendId}-${year}-${semester}`
export type FriendSemesterKey = `${string}-${SemesterKey}`;

export const MOCK_FRIEND_TIMETABLES: Record<FriendSemesterKey, ClassSession[]> = {
  // りく (1)
  "1-2026-春": [
    { id: "f1-1", day: "月", period: 2, name: "マーケティング論", teacher: "田中 誠", room: "2204教室", color: PRESET_COLORS[0] },
    { id: "f1-2", day: "火", period: 1, name: "経営学入門", teacher: "山田 花子", room: "1101教室", color: PRESET_COLORS[2] },
    { id: "f1-3", day: "水", period: 3, name: "統計学A", teacher: "佐藤 健", room: "3305教室", color: PRESET_COLORS[3] },
    { id: "f1-4", day: "木", period: 1, name: "商品学A", teacher: "上原 義子", room: "1013教室", color: PRESET_COLORS[0] },
    { id: "f1-5", day: "金", period: 2, name: "ビジネス法", teacher: "中島 義朗", room: "1202教室", color: PRESET_COLORS[4] },
  ],
  "1-2025-秋": [
    { id: "f1-a1", day: "月", period: 3, name: "消費者行動論", teacher: "佐藤 明", room: "401教室", color: PRESET_COLORS[0] },
    { id: "f1-a2", day: "水", period: 2, name: "マクロ経済学", teacher: "山田 花子", room: "301教室", color: PRESET_COLORS[2] },
    { id: "f1-a3", day: "金", period: 4, name: "日本経済史", teacher: "渡辺 悠", room: "104教室", color: PRESET_COLORS[3] },
  ],
  "1-2025-春": [
    { id: "f1-b1", day: "火", period: 2, name: "流通論", teacher: "原 頼利", room: "305教室", color: PRESET_COLORS[1] },
    { id: "f1-b2", day: "木", period: 3, name: "簿記A", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[3] },
    { id: "f1-b3", day: "金", period: 1, name: "経営組織論", teacher: "田中 誠一", room: "401教室", color: PRESET_COLORS[4] },
  ],

  // さくらもち (2)
  "2-2026-春": [
    { id: "f2-1", day: "月", period: 1, name: "会計学基礎", teacher: "鈴木 良子", room: "2101教室", color: PRESET_COLORS[1] },
    { id: "f2-2", day: "水", period: 3, name: "レジャービジネス論", teacher: "野澤 智行", room: "1013教室", color: PRESET_COLORS[1] },
    { id: "f2-3", day: "金", period: 3, name: "法学概論", teacher: "高橋 優", room: "1201教室", color: PRESET_COLORS[4] },
    { id: "f2-4", day: "木", period: 2, name: "金融論", teacher: "岡田 幸夫", room: "2305教室", color: PRESET_COLORS[2] },
  ],
  "2-2025-秋": [
    { id: "f2-a1", day: "月", period: 2, name: "簿記B", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[1] },
    { id: "f2-a2", day: "水", period: 3, name: "国際ビジネス論", teacher: "渡辺 悠", room: "302教室", color: PRESET_COLORS[3] },
    { id: "f2-a3", day: "木", period: 1, name: "経営統計学", teacher: "鈴木 博", room: "203教室", color: PRESET_COLORS[0] },
  ],

  // ゆうたろう (3)
  "3-2026-春": [
    { id: "f3-1", day: "火", period: 2, name: "デザイン思考", teacher: "伊藤 あかり", room: "創造棟102", color: PRESET_COLORS[4] },
    { id: "f3-2", day: "木", period: 4, name: "商学専門演習（4年）", teacher: "鈴木 仁里", room: "2121番教室", color: PRESET_COLORS[2] },
    { id: "f3-3", day: "金", period: 5, name: "スポーツ科学", teacher: "小林 俊介", room: "体育館A", color: PRESET_COLORS[3] },
    { id: "f3-4", day: "月", period: 3, name: "経済史", teacher: "松田 浩二", room: "1304教室", color: PRESET_COLORS[0] },
  ],
  "3-2025-秋": [
    { id: "f3-a1", day: "火", period: 3, name: "コミュニケーション論", teacher: "斉藤 由紀", room: "3201教室", color: PRESET_COLORS[1] },
    { id: "f3-a2", day: "木", period: 2, name: "メディア論", teacher: "林 正人", room: "2501教室", color: PRESET_COLORS[4] },
  ],

  // ちょこばななだいすき (4)
  "4-2026-春": [
    { id: "f4-1", day: "月", period: 3, name: "心理学概論", teacher: "加藤 美咲", room: "1303教室", color: PRESET_COLORS[3] },
    { id: "f4-2", day: "水", period: 4, name: "社会学入門", teacher: "松本 弘之", room: "2402教室", color: PRESET_COLORS[0] },
    { id: "f4-3", day: "土", period: 1, name: "ゼミ（3年）", teacher: "加藤 美咲", room: "演習室B", color: PRESET_COLORS[3] },
  ],
  "4-2025-秋": [
    { id: "f4-a1", day: "月", period: 2, name: "人的資源管理論", teacher: "田中 誠一", room: "402教室", color: PRESET_COLORS[4] },
    { id: "f4-a2", day: "水", period: 3, name: "簿記B", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[1] },
    { id: "f4-a3", day: "金", period: 1, name: "国際ビジネス論", teacher: "渡辺 悠", room: "302教室", color: PRESET_COLORS[2] },
  ],

  // あお (5)
  "5-2026-春": [
    { id: "f5-1", day: "木", period: 1, name: "商品学A", teacher: "上原 義子", room: "1013教室", color: PRESET_COLORS[0] },
    { id: "f5-2", day: "木", period: 5, name: "流通システム論B", teacher: "原 頼利", room: "1063教室", color: PRESET_COLORS[3] },
    { id: "f5-3", day: "金", period: 1, name: "倫理学", teacher: "木村 正夫", room: "3101教室", color: PRESET_COLORS[2] },
    { id: "f5-4", day: "土", period: 2, name: "ゼミ（2年）", teacher: "林 静子", room: "演習室A", color: PRESET_COLORS[0] },
  ],
  "5-2025-秋": [
    { id: "f5-a1", day: "月", period: 1, name: "消費者行動論", teacher: "佐藤 明", room: "401教室", color: PRESET_COLORS[0] },
    { id: "f5-a2", day: "水", period: 4, name: "データサイエンス", teacher: "木村 健太", room: "PC実習室B", color: "#16A3B0" },
    { id: "f5-a3", day: "金", period: 3, name: "経営組織論", teacher: "田中 誠一", room: "401教室", color: PRESET_COLORS[4] },
  ],

  // かいと (6)
  "6-2026-春": [
    { id: "f6-1", day: "水", period: 3, name: "レジャービジネス論", teacher: "野澤 智行", room: "1013教室", color: PRESET_COLORS[1] },
    { id: "f6-2", day: "火", period: 4, name: "商業英語A", teacher: "Brown M.", room: "語学棟L11", color: PRESET_COLORS[2] },
    { id: "f6-3", day: "金", period: 2, name: "マーケティング論", teacher: "佐藤 明", room: "401教室", color: PRESET_COLORS[0] },
  ],
  "6-2025-秋": [
    { id: "f6-a1", day: "火", period: 2, name: "商業英語B", teacher: "Brown M.", room: "語学棟L11", color: PRESET_COLORS[2] },
    { id: "f6-a2", day: "木", period: 3, name: "国際ビジネス論", teacher: "渡辺 悠", room: "302教室", color: PRESET_COLORS[3] },
  ],

  // なな (7)
  "7-2026-春": [
    { id: "f7-1", day: "水", period: 3, name: "レジャービジネス論", teacher: "野澤 智行", room: "1013教室", color: PRESET_COLORS[1] },
    { id: "f7-2", day: "月", period: 2, name: "心理学概論", teacher: "加藤 美咲", room: "1303教室", color: PRESET_COLORS[3] },
    { id: "f7-3", day: "木", period: 3, name: "経営統計学", teacher: "鈴木 博", room: "203教室", color: PRESET_COLORS[0] },
  ],
  "7-2025-秋": [
    { id: "f7-a1", day: "月", period: 3, name: "消費者行動論", teacher: "佐藤 明", room: "401教室", color: PRESET_COLORS[0] },
    { id: "f7-a2", day: "金", period: 2, name: "人的資源管理論", teacher: "田中 誠一", room: "402教室", color: PRESET_COLORS[4] },
  ],

  // まなと (8)
  "8-2026-春": [
    { id: "f8-1", day: "木", period: 5, name: "流通システム論B", teacher: "原 頼利", room: "1063教室", color: PRESET_COLORS[3] },
    { id: "f8-2", day: "火", period: 1, name: "会計学基礎", teacher: "鈴木 良子", room: "2101教室", color: PRESET_COLORS[1] },
    { id: "f8-3", day: "水", period: 2, name: "金融論", teacher: "岡田 幸夫", room: "2305教室", color: PRESET_COLORS[2] },
    { id: "f8-4", day: "金", period: 4, name: "日本経済史", teacher: "渡辺 悠", room: "104教室", color: PRESET_COLORS[4] },
  ],
  "8-2025-秋": [
    { id: "f8-a1", day: "水", period: 3, name: "簿記B", teacher: "中村 良子", room: "201教室", color: PRESET_COLORS[1] },
    { id: "f8-a2", day: "木", period: 4, name: "国際ビジネス論", teacher: "渡辺 悠", room: "302教室", color: PRESET_COLORS[3] },
    { id: "f8-a3", day: "金", period: 1, name: "人的資源管理論", teacher: "田中 誠一", room: "402教室", color: PRESET_COLORS[4] },
  ],
};
