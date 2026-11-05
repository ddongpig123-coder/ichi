// 森（全国単位の掲示板）。学校掲示板と違い schoolDomain スコープを持たない。
// Firestore パス: lounges/{loungeId}/posts/{postId}（firestore.rules 定義済み。loungeId はワイルドカードで
// 固定リストの検証は無い → カテゴリ追加に規則変更は不要）。
//
// 1.1 S4（2026-11-05, BOARD-ACCESS §4）: 旧「留学生ラウンジ」を森2つに分けた。
//   みんなの森  — 全国・全員（雑談・話題 / 売買・譲渡 / 就活・キャリア）
//   留学生の森  — 全国・留学生向け。入場制限は設けない（DECISIONS 2026-11-05: 全員開放）
// 「どの森に属するか」は forest フィールドで表現するだけで、Firestore パスは変えない。
// 🔴 loungeId は既存投稿を保つため絶対に変えない（market/job は森が変わっただけ）。

export type ForestId = "minna" | "ryugakusei";

export interface ForestMeta {
  id: ForestId;
  label: string;         // 日本語（正本）
  labelKo: string;
  description: string;
  descriptionKo: string;
}

export const FORESTS: ForestMeta[] = [
  { id: "minna", label: "みんなの森", labelKo: "모두의 숲", description: "全国の大学生みんなで話す場所", descriptionKo: "전국 대학생이 함께 이야기하는 곳" },
  { id: "ryugakusei", label: "留学生の森", labelKo: "유학생의 숲", description: "留学生向けの情報交換。誰でも参加できます", descriptionKo: "유학생을 위한 정보 교환. 누구나 참여할 수 있어요" },
];

export type LoungeId = "chat" | "market" | "job" | "visa" | "parttime" | "housing" | "shinokubo";

export interface LoungeMeta {
  id: LoungeId;
  forest: ForestId;      // 所属する森（表示上の分類。パスには影響しない）
  label: string;         // 日本語（正本）
  description: string;
  labelKo: string;       // 韓国語表示名
  descriptionKo: string;
  icon: string;          // Ionicons のアイコン名（以前は絵文字）
}

export const LOUNGES: LoungeMeta[] = [
  // ── みんなの森 ──
  { id: "chat", forest: "minna", label: "雑談・話題", description: "日常のこと・気になる話題をゆるく", labelKo: "잡담·화제", descriptionKo: "일상·요즘 화제를 가볍게", icon: "chatbubbles-outline" },
  { id: "market", forest: "minna", label: "売買・譲渡", description: "中古品の売買・ゆずります", labelKo: "매매·양도", descriptionKo: "중고품 매매·나눔", icon: "cart-outline" },
  { id: "job", forest: "minna", label: "就活・キャリア", description: "就職活動・インターン・進路", labelKo: "취업·커리어", descriptionKo: "취업활동·인턴·진로", icon: "school-outline" },
  // ── 留学生の森 ──
  { id: "visa", forest: "ryugakusei", label: "ビザ・在留", description: "ビザ・在留資格の情報交換", labelKo: "비자·체류", descriptionKo: "비자·체류자격 정보 교환", icon: "id-card-outline" },
  { id: "parttime", forest: "ryugakusei", label: "アルバイト", description: "バイト探し・体験談", labelKo: "아르바이트", descriptionKo: "알바 찾기·경험담", icon: "briefcase-outline" },
  { id: "housing", forest: "ryugakusei", label: "住まい・不動産", description: "部屋探し・引っ越し・契約", labelKo: "집·부동산", descriptionKo: "방 구하기·이사·계약", icon: "home-outline" },
  { id: "shinokubo", forest: "ryugakusei", label: "新大久保グルメ", description: "新大久保周辺のおすすめ店・新メニュー", labelKo: "신오쿠보 맛집", descriptionKo: "신오쿠보 주변 추천 가게·신메뉴", icon: "restaurant-outline" },
];

export function loungesOfForest(forest: ForestId): LoungeMeta[] {
  return LOUNGES.filter((l) => l.forest === forest);
}
export function forestOfLounge(loungeId: string | undefined | null): ForestMeta | undefined {
  const l = LOUNGES.find((x) => x.id === loungeId);
  return l ? FORESTS.find((f) => f.id === l.forest) : undefined;
}

// 表示言語に応じた名前・説明を返す。
export function forestLabel(f: ForestMeta, lang: "ja" | "ko"): string {
  return lang === "ko" ? f.labelKo : f.label;
}
export function forestDescription(f: ForestMeta, lang: "ja" | "ko"): string {
  return lang === "ko" ? f.descriptionKo : f.description;
}
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
