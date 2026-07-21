// 留学生ラウンジ（全国単位の掲示板）。学校掲示板と違い schoolDomain スコープを持たない。
// Firestore パス: lounges/{loungeId}/posts/{postId}（firestore.rules 定義済み）。

export type LoungeId = "visa" | "parttime" | "housing" | "market" | "job";

export interface LoungeMeta {
  id: LoungeId;
  label: string;
  description: string;
  icon: string;
}

// ROADMAP 9月4週: ビザ / アルバイト / 不動産 / 中古 / 就職 の5カテゴリ
export const LOUNGES: LoungeMeta[] = [
  { id: "visa", label: "ビザ・在留", description: "ビザ・在留資格の情報交換", icon: "🛂" },
  { id: "parttime", label: "アルバイト", description: "バイト探し・体験談", icon: "💼" },
  { id: "housing", label: "住まい・不動産", description: "部屋探し・引っ越し・契約", icon: "🏠" },
  { id: "market", label: "売買・譲渡", description: "中古品の売買・ゆずります", icon: "🛒" },
  { id: "job", label: "就活・キャリア", description: "就職活動・インターン・進路", icon: "🎓" },
];

// deleted の扱いは src/types/board.ts の Post と同じ（MODERATION.md §1）
export interface LoungePost {
  id: string;
  loungeId: LoungeId;
  title: string;
  body: string;
  authorUid: string;
  commentCount: number;
  likeCount: number;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface LoungeComment {
  id: string;
  postId: string;
  body: string;
  authorUid: string;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}
