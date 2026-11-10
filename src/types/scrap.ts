// スクラップ（投稿のブックマーク）。1.1 S4-5（2026-11-06 準熙決定: エブリタイムの「스크랩」相当）
// Firestore: users/{uid}/scraps/{scrapId} — 本人だけ読み書き（firestore.rules）。
// 表示に必要な最小限を投稿から写しておき、一覧を開くたびに投稿を読まなくて済むようにする。
// 🔴 本文は写さない（削除された投稿の内容が残らないように）。開いたときに投稿側を読む。

export type ScrapKind = "board" | "lounge";

export interface ScrapItem {
  // `${kind}_${boardId}_${postId}`（ドキュメント id。"/" を含まないので安全）
  key: string;
  kind: ScrapKind;
  // 学校掲示板の boardId / 森の loungeId
  boardId: string;
  postId: string;
  // 学校掲示板のときだけ。開くときの経路（schools/{schoolDomain}/…）に使う
  schoolDomain: string | null;
  // 投稿タイトルの写し（一覧表示用）
  title: string;
  // 板名の写し（ja 正本 / ko）
  boardLabel: string;
  boardLabelKo: string;
  // スクラップした時刻（ms）。一覧はこの降順
  createdAt: number;
}

export function scrapKey(kind: ScrapKind, boardId: string, postId: string): string {
  return `${kind}_${boardId}_${postId}`;
}
