// ============================================================
// 講義名の部分一致検索のための 2-gram ユーティリティ
//
// Firestore は前方一致しかできないため、講義名を2文字ずつの配列(nameGrams)にして
// 保存し、array-contains でクエリ語の1つの2-gramを引き当てる。ヒットした候補を
// クライアントで「クエリ語を実際に含むか」で再フィルタして最終結果を出す。
//
// ⚠️ この実装は crawler の scripts/load-firestore.mjs と**完全に同一**でなければ
//    検索が壊れる。片方を変えたら必ず両方を揃えること（依存パッケージが別のため
//    import 共有できず、意図的に二重管理している）。
// ============================================================

// 正規化: NFKC(全角英数→半角・互換文字統一) + 小文字化 + 空白除去
export function normalizeForSearch(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
}

// 正規化文字列から隣接2文字のスライディング窓で2-gram集合を作る。
// 1文字だけの語はその1文字を返す。重複は除く。
export function makeBigrams(name: string): string[] {
  const norm = normalizeForSearch(name);
  if (norm.length === 0) return [];
  if (norm.length === 1) return [norm];
  const set = new Set<string>();
  for (let i = 0; i < norm.length - 1; i++) {
    set.add(norm.slice(i, i + 2));
  }
  return [...set];
}

// 検索クエリから array-contains に使う代表2-gramを1つ選ぶ。
// （array-contains は単一値のみ。先頭の2-gramを使い、残りはクライアント再フィルタで担保）
export function queryGram(query: string): string | null {
  const grams = makeBigrams(query);
  return grams[0] ?? null;
}

// array-contains ヒット候補を、クエリ語を実際に含むかで最終判定する。
export function matchesQuery(name: string, query: string): boolean {
  const n = normalizeForSearch(name);
  const q = normalizeForSearch(query);
  return q.length > 0 && n.includes(q);
}
