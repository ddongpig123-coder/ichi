export type BoardId = "free" | "international" | "question" | "trade";

export interface BoardMeta {
  id: BoardId;
  label: string;
  description: string;
}

export const BOARDS: BoardMeta[] = [
  { id: "free",          label: "自由掲示板",       description: "なんでも自由に話しましょう" },
  { id: "international", label: "留学生掲示板",     description: "留学生同士で情報共有" },
  { id: "question",      label: "質問掲示板",       description: "学校・授業の質問はこちら" },
  { id: "trade",         label: "取引掲示板",       description: "売買・譲渡はこちら" },
];

export interface Post {
  id: string;
  boardId: BoardId;
  schoolDomain: string;
  title: string;
  body: string;
  authorUid: string;      // stored but never displayed
  commentCount: number;
  likeCount: number;
  createdAt: number;      // unix ms
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  authorUid: string;
  createdAt: number;
}
