// 投稿検索の索引文書（学校掲示板・森で共用）
//
// パス: schools/{schoolDomain}/postIndex/{postId} / lounges/{loungeId}/postIndex/{postId}
// ドキュメントIDは投稿本体と同じ。学校ぶんは1コレクションなので、掲示板を
// またいだ検索が1クエリで済む（以前は掲示板ごとに引いていた）。
//
// firestore.rules の postIndex ブロックと1:1。作成のみ許可で更新・削除は禁止。
// 投稿の論理削除は本体の deleted で判定する（索引は本体と食い違わない）。
export interface PostIndexDoc {
  boardId: string;   // 学校掲示板は boardId、森は loungeId
  authorUid: string; // 投稿者（ルールが本人確認に使う）
  grams: string[];   // makePostGrams(title, body)
  createdAt: number;
}
