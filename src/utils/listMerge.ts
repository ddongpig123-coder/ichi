// 一覧画面の「静かな再読み込み」用。
//
// 投稿詳細から一覧に戻るたびに一覧を空にして読み直すと、FlatList が作り直されて
// スクロールが先頭に戻り、さっき開いた投稿を探し直すことになる（QA 2026-11-06）。
// 代わりに先頭ページだけ取り直して既存一覧にマージする:
//   - 先頭ページ（新しい順 createdAt desc）はそのまま先頭に。内容が変わった項目も新しい方で置き換わる
//   - 先頭ページより古い既存項目（追加読み込み分）はそのまま残す → スクロール位置が保てる
//   - 先頭ページの範囲内にあったのに今回含まれない既存項目（削除・非表示）は落とす
export function mergeFirstPage<T extends { id: string; createdAt: number }>(prev: T[], first: T[]): T[] {
  if (first.length === 0) return first;
  const firstIds = new Set(first.map((x) => x.id));
  const oldest = first[first.length - 1].createdAt;
  const tail = prev.filter((x) => !firstIds.has(x.id) && x.createdAt < oldest);
  return [...first, ...tail];
}
