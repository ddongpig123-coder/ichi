export type BoardId = string;

export type BoardCategory = "official" | "department" | "custom";

export interface BoardMeta {
  id: BoardId;
  label: string;
  description: string;
  category: BoardCategory;
  createdBy?: string;
  createdAt?: number;
}

export const OFFICIAL_BOARDS: BoardMeta[] = [
  { id: "free",          label: "自由掲示板",   description: "なんでも自由に話しましょう", category: "official" },
  { id: "international", label: "留学生掲示板", description: "留学生同士で情報共有",       category: "official" },
  { id: "question",      label: "質問掲示板",   description: "学校・授業の質問はこちら",   category: "official" },
  { id: "trade",         label: "取引掲示板",   description: "売買・譲渡はこちら",         category: "official" },
  { id: "club",          label: "サークル掲示板", description: "サークル・部活の情報交換",  category: "official" },
];

// 旧名称のエイリアス（既存コードの互換性維持）
export const BOARDS = OFFICIAL_BOARDS;

// deleted: hard delete の代わりに立てるフラグ（MODERATION.md §1）。
// 発信者情報開示請求に備え、投稿記録は原則6ヶ月保存する必要があるため
// ドキュメント自体は消さない。既存ドキュメントにはこのフィールドが無いので
// 省略可能にしてある（undefined = 未削除）。
export interface Post {
  id: string;
  boardId: BoardId;
  schoolDomain: string;
  title: string;
  body: string;
  authorUid: string;
  commentCount: number;
  likeCount: number;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  authorUid: string;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}
