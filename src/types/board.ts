export type BoardId = string;

// "department" は 1.1 S4（2026-11-05）で廃止 — UI からは作れず一覧にも出ないが、
// Firestore に残る category:"department" 文書と型を合わせるため値は残す（BOARD-ACCESS §3-3 Q3）。
// 既存の学部掲示板は "custom" と同じ扱いで表示する（useBoards）。
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
  // 投稿画面の本文に最初から入れる書式（アンケート協力・ゼミ）。空欄埋め式にして投稿の質と敷居を揃える。
  bodyTemplate?: string;
}

// 公式掲示板。boardId は Firestore パスに入るので変更禁止。追加は規則変更なしで OTA（BOARD-ACCESS §7-0）。
// 1.1 S4（2026-11-05）: 今日の授業・アンケート協力・ゼミ を追加（§7。「出席コード」板は作らず今日の授業に）。
// 留学生掲示板は留学生の森と並存させる（DECISIONS 2026-11-05 準希決定）。
export const OFFICIAL_BOARDS: BoardMeta[] = [
  { id: "free",          label: "自由掲示板",   description: "なんでも自由に話しましょう", labelKo: "자유게시판",   descriptionKo: "무엇이든 자유롭게 이야기해요", category: "official" },
  { id: "question",      label: "質問掲示板",   description: "学校・授業の質問はこちら",   labelKo: "질문게시판",   descriptionKo: "학교·수업 질문은 여기",        category: "official" },
  { id: "todayclass",    label: "今日の授業",   description: "授業の感想・休講・課題のシェア", labelKo: "오늘의 수업", descriptionKo: "수업 감상·휴강·과제 공유", category: "official" },
  { id: "survey",        label: "アンケート協力", description: "卒論・ゼミの調査に協力し合う", labelKo: "설문 협력", descriptionKo: "졸논·제미 설문조사 서로 돕기", category: "official",
    bodyTemplate: "・調査テーマ：\n・対象：（例：明治大生 / 留学生 / 20代全般）\n・所要時間：約〇分\n・締切：〇月〇日\n・リンク：\n" },
  { id: "zemi",          label: "ゼミ",         description: "ゼミ紹介・選考体験記・募集情報", labelKo: "제미(세미나)", descriptionKo: "제미 소개·선발 체험기·모집 정보", category: "official",
    bodyTemplate: "・ゼミ名：\n・担当教員：\n・募集人数：\n・選考方法：（面接 / 課題 / 成績）\n・活動内容：\n・雰囲気：\n" },
  { id: "trade",         label: "教科書ゆずり",     description: "教科書・参考書の売買・ゆずります", labelKo: "교과서 물려받기", descriptionKo: "교과서·참고서 매매·물려주기",   category: "official" },
  { id: "club",          label: "サークル掲示板", description: "サークル・部活の情報交換",  labelKo: "동아리게시판", descriptionKo: "동아리·부활동 정보 교환",     category: "official" },
  { id: "international", label: "留学生掲示板", description: "この大学の留学生同士で情報共有", labelKo: "유학생게시판", descriptionKo: "우리 대학 유학생끼리 정보 공유",         category: "official" },
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
  // 質問掲示板（知恵袋化）: 解決済みフラグ と ベストアンサーに選ばれたコメントid。
  // 質問の作成者のみが設定（firestore.rules の canUpdatePost = 本人更新で許可済み）。
  resolved?: boolean;
  bestCommentId?: string | null;
  // 閲覧数（詳細を開くたびに+1）。既存ドキュメントには無いので undefined=0。
  viewCount?: number;
  // 質問掲示板のカテゴリ（QA_TAGS の id）。質問板のみ。
  tag?: string | null;
}

// 質問掲示板の boardId（知恵袋スタイルの Q&A 表示を適用する板）。
export const QA_BOARD_ID = "question";
export function isQaBoard(boardId: string): boolean {
  return boardId === QA_BOARD_ID;
}

// 質問掲示板のカテゴリ（軽量タグ・単一選択）。留学生向けに ビザ・バイト を含む。
export interface QaTag {
  id: string;
  ja: string;
  ko: string;
}
export const QA_TAGS: QaTag[] = [
  { id: "jugyo", ja: "授業・履修", ko: "수업·이수" },
  { id: "circle", ja: "サークル・部活", ko: "동아리·부활동" },
  { id: "seikatsu", ja: "生活", ko: "생활" },
  { id: "visa", ja: "ビザ・在留", ko: "비자·체류" },
  { id: "baito", ja: "バイト", ko: "아르바이트" },
  { id: "sonota", ja: "その他", ko: "기타" },
];
export function qaTagLabel(tagId: string | undefined | null, lang: "ja" | "ko"): string | null {
  if (!tagId) return null;
  const t = QA_TAGS.find((x) => x.id === tagId);
  return t ? (lang === "ko" ? t.ko : t.ja) : null;
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
