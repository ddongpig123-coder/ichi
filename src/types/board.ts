export type BoardId = string;

export type BoardCategory = "official" | "department" | "custom";

export interface BoardMeta {
  id: BoardId;
  label: string;             // 日本語（正本）
  description: string;
  labelKo?: string;          // 韓国語表示名（公式掲示板のみ。ユーザー作成板はja表示）
  descriptionKo?: string;
  category: BoardCategory;
  createdBy?: string;
  createdAt?: number;
}

export const OFFICIAL_BOARDS: BoardMeta[] = [
  { id: "free",          label: "自由掲示板",   description: "なんでも自由に話しましょう", labelKo: "자유게시판",   descriptionKo: "무엇이든 자유롭게 이야기해요", category: "official" },
  { id: "international", label: "留学生掲示板", description: "留学生同士で情報共有",       labelKo: "유학생게시판", descriptionKo: "유학생끼리 정보 공유",         category: "official" },
  { id: "question",      label: "質問掲示板",   description: "学校・授業の質問はこちら",   labelKo: "질문게시판",   descriptionKo: "학교·수업 질문은 여기",        category: "official" },
  { id: "trade",         label: "取引掲示板",   description: "売買・譲渡はこちら",         labelKo: "거래게시판",   descriptionKo: "매매·양도는 여기",             category: "official" },
  { id: "club",          label: "サークル掲示板", description: "サークル・部活の情報交換",  labelKo: "동아리게시판", descriptionKo: "동아리·부활동 정보 교환",     category: "official" },
];

// 旧名称のエイリアス（既存コードの互換性維持）
export const BOARDS = OFFICIAL_BOARDS;

// 表示言語に応じた掲示板名・説明を返す（ko が無ければ ja にフォールバック）。
export function boardLabel(b: BoardMeta, lang: "ja" | "ko"): string {
  return lang === "ko" && b.labelKo ? b.labelKo : b.label;
}
export function boardDescription(b: BoardMeta, lang: "ja" | "ko"): string {
  return lang === "ko" && b.descriptionKo ? b.descriptionKo : b.description;
}

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
  likeCount: number;
  // 返信（대댓글）: スレッドの親コメント（トップレベル）の id。未設定/なし = トップレベル。
  // 返信への返信も同じ親（スレッド root）にぶら下げる = 1階層フラット。
  parentId?: string | null;
  // メンション対象の uid（返信先の人）。表示は「@匿名N」。null = メンションなし。
  mentionUid?: string | null;
  deleted?: boolean;
  deletedAt?: number;
}
