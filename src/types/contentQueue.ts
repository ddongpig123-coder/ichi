// コンテンツ投稿キュー（docs/CONTENT-OPS.md §9）。
// Firestore パス: contentQueue/{itemId}。運営アカウント（operators/{uid} に登録済み）のみ読み書き可。
// firestore.rules の isValidQueueItem() と1:1で一致させること。
//
// 流れ: draft（下書き: 手書き or AI生成）→ approved（運営が承認）→ posted（GitHub Actions が投稿）
//       draft → rejected（却下。同じネタの再生成を防ぐため消さずに残す。物理削除はルールで禁止）
//
// 投稿された記事の側には運営の印を付けない（非表示方針, CONTENT-OPS §3 / §9-2）。
// 記事は誰でも読めるため、印があると運営投稿だと分かってしまう。
// 運営投稿の追跡・一括削除はこのキューの postedPath で行う。

export type ContentQueueStatus = "draft" | "approved" | "rejected" | "posted";

// manual = 運営が手書き / ai = scripts/content/generate.mjs が生成
export type ContentSource = "manual" | "ai";

// 投稿先の種類。
//   school: schools/{schoolDomain}/boards/{boardId}/posts
//   lounge: lounges/{boardId}/posts（boardId に loungeId を入れる。schoolDomain は null）
export type ContentScope = "school" | "lounge";

// 投稿画面（app/post/[boardId]/write.tsx）のタイトル上限と揃える。本文は余裕を持たせた上限。
export const CONTENT_TITLE_MAX = 100;
export const CONTENT_BODY_MAX = 5000;

export interface ContentQueueItem {
  id: string;
  status: ContentQueueStatus;
  source: ContentSource;
  scope: ContentScope;
  schoolDomain: string | null;   // scope = "school" のときのみ。lounge は null
  boardId: string;               // school: boardId / lounge: loungeId
  title: string;
  body: string;
  topic: string | null;          // AI生成の主題（例: "discussion"）。手書きは null
  sourceUrl: string | null;      // お知らせ・日程の要約元。承認時の事実確認用（記事には書かない）
  createdBy: string;             // 作成した運営アカウントの uid
  createdAt: number;
  updatedAt: number;
  // 以下は投稿後に post-next.mjs が付ける（ルールでは検証しない）
  postedAt?: number | null;
  postedPath?: string | null;    // 投稿したドキュメントのパス（追跡・一括削除用）
}
