// 留学生ラウンジ（全国単位の掲示板）。学校掲示板と違い schoolDomain スコープを持たない。
// Firestore パス: lounges/{loungeId}/posts/{postId}（firestore.rules 定義済み）。

export type LoungeId = "visa" | "parttime" | "housing" | "market" | "job";

export interface LoungeMeta {
  id: LoungeId;
  label: string;         // 日本語（正本）
  description: string;
  labelKo: string;       // 韓国語表示名
  descriptionKo: string;
  icon: string;
}

// ROADMAP 9月4週: ビザ / アルバイト / 不動産 / 中古 / 就職 の5カテゴリ
export const LOUNGES: LoungeMeta[] = [
  { id: "visa", label: "ビザ・在留", description: "ビザ・在留資格の情報交換", labelKo: "비자·체류", descriptionKo: "비자·체류자격 정보 교환", icon: "🛂" },
  { id: "parttime", label: "アルバイト", description: "バイト探し・体験談", labelKo: "아르바이트", descriptionKo: "알바 찾기·경험담", icon: "💼" },
  { id: "housing", label: "住まい・不動産", description: "部屋探し・引っ越し・契約", labelKo: "집·부동산", descriptionKo: "방 구하기·이사·계약", icon: "🏠" },
  { id: "market", label: "売買・譲渡", description: "中古品の売買・ゆずります", labelKo: "매매·양도", descriptionKo: "중고품 매매·나눔", icon: "🛒" },
  { id: "job", label: "就活・キャリア", description: "就職活動・インターン・進路", labelKo: "취업·커리어", descriptionKo: "취업활동·인턴·진로", icon: "🎓" },
];

// 表示言語に応じたラウンジ名・説明を返す。
export function loungeLabel(l: LoungeMeta, lang: "ja" | "ko"): string {
  return lang === "ko" ? l.labelKo : l.label;
}
export function loungeDescription(l: LoungeMeta, lang: "ja" | "ko"): string {
  return lang === "ko" ? l.descriptionKo : l.description;
}

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
  likeCount: number;
  // 返信（대댓글）: スレッドの親コメント（トップレベル）の id。未設定/なし = トップレベル。
  // 返信への返信も同じ親（スレッド root）にぶら下げる = 1階層フラット。
  parentId?: string | null;
  // メンション対象の uid（返信先の人）。表示は「@匿名N」。null = メンションなし。
  mentionUid?: string | null;
  deleted?: boolean;
  deletedAt?: number;
}
