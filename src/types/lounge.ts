// 森（全国単位の掲示板）。学校掲示板と違い schoolDomain スコープを持たない。
// Firestore パス: lounges/{loungeId}/posts/{postId}（firestore.rules 定義済み。loungeId はワイルドカードで
// 固定リストの検証は無い → カテゴリ追加に規則変更は不要）。
//
// 1.1 S4（2026-11-05, BOARD-ACCESS §4）: 旧「留学生ラウンジ」を森2つに分けた。
//   みんなの森  — 全国・全員（雑談・話題 / 売買・譲渡 / 就活・キャリア）
//   留学生の森  — 全国・留学生向け。入場制限は設けない（DECISIONS 2026-11-05: 全員開放）
// 「どの森に属するか」は forest フィールドで表現するだけで、Firestore パスは変えない。
// 🔴 loungeId は既存投稿を保つため絶対に変えない（market/job は森が変わっただけ）。
//
// 2026-11-14 準熙（BOARD-ACCESS §9）: 板の構成を「学校の森」に合わせて3つの森で揃えた。
//   どの森も 先頭 = 自由掲示板 → 質問掲示板、そのあと森ごとの板。森の板一覧の最上段にベスト投稿。
//   - みんなの森「雑談・話題」は **名前だけ** 自由掲示板に（id "chat" はそのまま → 既存投稿はそのまま）
//   - 新設: minna_question / ryugakusei_free / ryugakusei_question（学校の板 id と衝突しない名前にする）

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

export type LoungeId =
  | "chat" | "minna_question" | "market" | "job"
  | "ryugakusei_free" | "ryugakusei_question" | "visa" | "parttime" | "housing" | "shinokubo";

export interface LoungeMeta {
  id: LoungeId;
  forest: ForestId;      // 所属する森（表示上の分類。パスには影響しない）
  label: string;         // 日本語（正本）
  description: string;
  labelKo: string;       // 韓国語表示名
  descriptionKo: string;
  icon: string;          // Ionicons のアイコン名（以前は絵文字）
  // 質問掲示板（知恵袋スタイル: 受付中/解決済み・ベストアンサー・カテゴリ）。学校の「質問掲示板」と同じ挙動
  qa?: boolean;
}

// 並び順 = 表示順（森の板一覧・新着ブロック）。自由 → 質問 → 森ごとの板。
export const LOUNGES: LoungeMeta[] = [
  // ── みんなの森 ──
  { id: "chat", forest: "minna", label: "自由掲示板", description: "全国の大学生となんでも自由に話しましょう", labelKo: "자유게시판", descriptionKo: "전국 대학생과 무엇이든 자유롭게 이야기해요", icon: "chatbubbles-outline" },
  { id: "minna_question", forest: "minna", label: "質問掲示板", description: "大学生活・進路の質問はこちら", labelKo: "질문게시판", descriptionKo: "대학 생활·진로 질문은 여기", icon: "help-circle-outline", qa: true },
  { id: "market", forest: "minna", label: "売買・譲渡", description: "中古品の売買・ゆずります", labelKo: "매매·양도", descriptionKo: "중고품 매매·나눔", icon: "cart-outline" },
  { id: "job", forest: "minna", label: "就活・キャリア", description: "就職活動・インターン・進路", labelKo: "취업·커리어", descriptionKo: "취업활동·인턴·진로", icon: "school-outline" },
  // ── 留学生の森 ──
  { id: "ryugakusei_free", forest: "ryugakusei", label: "自由掲示板", description: "留学生どうしでなんでも自由に話しましょう", labelKo: "자유게시판", descriptionKo: "유학생끼리 무엇이든 자유롭게 이야기해요", icon: "chatbubbles-outline" },
  { id: "ryugakusei_question", forest: "ryugakusei", label: "質問掲示板", description: "ビザ・生活・日本語の質問はこちら", labelKo: "질문게시판", descriptionKo: "비자·생활·일본어 질문은 여기", icon: "help-circle-outline", qa: true },
  { id: "visa", forest: "ryugakusei", label: "ビザ・在留", description: "ビザ・在留資格の情報交換", labelKo: "비자·체류", descriptionKo: "비자·체류자격 정보 교환", icon: "id-card-outline" },
  { id: "parttime", forest: "ryugakusei", label: "アルバイト", description: "バイト探し・体験談", labelKo: "아르바이트", descriptionKo: "알바 찾기·경험담", icon: "briefcase-outline" },
  { id: "housing", forest: "ryugakusei", label: "住まい・不動産", description: "部屋探し・引っ越し・契約", labelKo: "집·부동산", descriptionKo: "방 구하기·이사·계약", icon: "home-outline" },
  { id: "shinokubo", forest: "ryugakusei", label: "新大久保グルメ", description: "新大久保周辺のおすすめ店・新メニュー", labelKo: "신오쿠보 맛집", descriptionKo: "신오쿠보 주변 추천 가게·신메뉴", icon: "restaurant-outline" },
];

// 質問掲示板（知恵袋スタイル）か。学校の isQaBoard と対になる
export function isQaLounge(loungeId: string | undefined | null): boolean {
  return !!LOUNGES.find((l) => l.id === loungeId)?.qa;
}

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
  // 直前のコメント操作（作成/ソフトデリート）のコメント id。commentCount と同じ
  // バッチ/トランザクションで書く（boardService.createComment / softDeleteComment）。
  // firestore.rules がこの id の文書を exists/existsAfter/getAfter で見て
  // 「本当にコメントが増減したか」を確かめるためだけに置く値（docs/SECURITY-1.1.md §7）。
  // 表示には使わない。古い投稿には無い（段階1の規則は無くても通す）。
  lastCommentId?: string;
  likeCount: number;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
  // 質問掲示板（qa: true の板）だけで使う。学校の Post と同じ意味・同じ規則
  // （firestore.rules の isAuthorEditOfPost が作成者に resolved / bestCommentId / tag の更新を許可済み）。
  resolved?: boolean;
  bestCommentId?: string | null;
  tag?: string | null;   // QA_TAGS の id（src/types/board.ts）
  // 匿名/記名の切り替え（S4-4, BOARD-ACCESS §8）。**作成時に固定**で、あとから変更できない
  // （firestore.rules の更新許可リストに入れていない）。
  // 既存文書にはこのフィールドが無い → undefined = 匿名。つまり既定は匿名（true）。
  anonymous?: boolean;
  // anonymous:false のときだけ入る usersPublic.nickname のスナップショット。
  // 一覧や詳細を描くたびに usersPublic を読まずに済ませるため（表示時の読み取り 0 件）。
  // 匿名のときは null / 無し（規則で強制。「匿名で出した」のに名前が残るのを防ぐ）。
  // 🔴 authorUid は記名でも匿名でもそのまま残す（法的対応の記録 — AGENTS.md の不変制約）。
  authorNickname?: string | null;
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
  // 匿名/記名の切り替え（S4-4, BOARD-ACCESS §8）。**作成時に固定**で、あとから変更できない
  // （firestore.rules の更新許可リストに入れていない）。
  // 既存文書にはこのフィールドが無い → undefined = 匿名。つまり既定は匿名（true）。
  anonymous?: boolean;
  // anonymous:false のときだけ入る usersPublic.nickname のスナップショット。
  // 一覧や詳細を描くたびに usersPublic を読まずに済ませるため（表示時の読み取り 0 件）。
  // 匿名のときは null / 無し（規則で強制。「匿名で出した」のに名前が残るのを防ぐ）。
  // 🔴 authorUid は記名でも匿名でもそのまま残す（法的対応の記録 — AGENTS.md の不変制約）。
  authorNickname?: string | null;
}
