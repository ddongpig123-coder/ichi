import type { ClassSession } from "../types/timetable";
import { PRESET_COLORS } from "../types/timetable";

/**
 * ローカルの友達時間割モックデータ。
 * 将来的には useFriendTimetable フックが Firestore から取得するため、
 * このファイルは削除またはシード用途に変更する予定。
 * キー: 友達のUID（現時点はモックID）
 */
export const MOCK_FRIEND_TIMETABLES: Record<string, ClassSession[]> = {
  "1": [
    { id: "f1-1", day: "月", period: 2, name: "マーケティング論", teacher: "田中 誠", room: "2204教室", color: PRESET_COLORS[0] },
    { id: "f1-2", day: "火", period: 1, name: "経営学入門", teacher: "山田 花子", room: "1101教室", color: PRESET_COLORS[2] },
    { id: "f1-3", day: "水", period: 3, name: "統計学A", teacher: "佐藤 健", room: "3305教室", color: PRESET_COLORS[3] },
    { id: "f1-4", day: "木", period: 4, name: "英語コミュニケーション", teacher: "Smith J.", room: "語学棟201", color: PRESET_COLORS[1] },
  ],
  "2": [
    { id: "f2-1", day: "月", period: 1, name: "会計学基礎", teacher: "鈴木 良子", room: "2101教室", color: PRESET_COLORS[1] },
    { id: "f2-2", day: "水", period: 2, name: "情報処理論", teacher: "中村 大輔", room: "PC棟301", color: PRESET_COLORS[0] },
    { id: "f2-3", day: "金", period: 3, name: "法学概論", teacher: "高橋 優", room: "1201教室", color: PRESET_COLORS[4] },
  ],
  "3": [
    { id: "f3-1", day: "火", period: 2, name: "デザイン思考", teacher: "伊藤 あかり", room: "創造棟102", color: PRESET_COLORS[4] },
    { id: "f3-2", day: "木", period: 1, name: "国際ビジネス論", teacher: "渡辺 賢二", room: "2305教室", color: PRESET_COLORS[2] },
    { id: "f3-3", day: "金", period: 5, name: "スポーツ科学", teacher: "小林 俊介", room: "体育館A", color: PRESET_COLORS[3] },
  ],
  "4": [
    { id: "f4-1", day: "月", period: 3, name: "心理学概論", teacher: "加藤 美咲", room: "1303教室", color: PRESET_COLORS[3] },
    { id: "f4-2", day: "水", period: 4, name: "社会学入門", teacher: "松本 弘之", room: "2402教室", color: PRESET_COLORS[0] },
  ],
  "5": [
    { id: "f5-1", day: "火", period: 3, name: "音楽理論", teacher: "清水 奈々", room: "芸術棟201", color: PRESET_COLORS[1] },
    { id: "f5-2", day: "木", period: 2, name: "文章表現", teacher: "井上 博文", room: "1102教室", color: PRESET_COLORS[4] },
    { id: "f5-3", day: "金", period: 1, name: "倫理学", teacher: "木村 正夫", room: "3101教室", color: PRESET_COLORS[2] },
    { id: "f5-4", day: "土", period: 2, name: "ゼミ（2年）", teacher: "林 静子", room: "演習室A", color: PRESET_COLORS[0] },
  ],
};
