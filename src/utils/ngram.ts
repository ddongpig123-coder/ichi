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

// ============================================================
// 投稿（掲示板・森）の検索索引
//
// 掲示板は「最新N件を取ってクライアントで絞る」方式だったため、N件より古い投稿は
// 検索に出てこなかった。投稿にも2-gramを持たせて array-contains で引く。
//
// ⚠️ grams は投稿本体ではなく **別文書**（postIndex/{postId}）に置く。
//    本体に持たせると一覧取得（orderBy createdAt の20件ページ）のたびに
//    数百個の2-gramまで毎回ダウンロードしてしまう。
// ============================================================

// 本文は先頭この文字数だけを索引に入れる。全文を入れると2-gramが数千個になり、
// 索引文書が肥大して検索自体が重くなる（本文末尾の一致は拾えなくなる = 既知の割り切り）。
export const POST_INDEX_BODY_CHARS = 400;

// 索引配列の上限（array-contains の索引エントリ数を抑える）。
export const POST_GRAMS_MAX = 400;

// サロゲートペア（絵文字・一部の漢字は UTF-16 の2単位で1文字）を取り除く。
// 2文字窓で切ると単独サロゲートができ、Firestore が不正な文字列として
// 書き込み・検索を拒否する（INVALID_ARGUMENT）。投稿索引では絵文字を
// 検索対象にしないので、索引化と検索語の両方で先に落とす。
// ⚠️ 講義名の nameGrams（makeBigrams 直呼び）には適用しない — クローラ側
//    （scripts/load-firestore.mjs）と同一でなければならず、講義名に絵文字は無い。
export function stripSurrogates(s: string): string {
  return (s ?? "").replace(/[\uD800-\uDFFF]/g, "");
}

// タイトルと本文冒頭から2-gram集合を作る。タイトルと本文は別々に gram 化して
// 束ねる（連結すると境界に実在しない2-gramができる）。
// ⚠️ scripts/backfill-post-index.mjs の同名関数と**完全に同一**に保つこと。
export function makePostGrams(title: string, body: string): string[] {
  const set = new Set<string>([
    ...makeBigrams(stripSurrogates(title ?? "")),
    ...makeBigrams(stripSurrogates((body ?? "").slice(0, POST_INDEX_BODY_CHARS))),
  ]);
  return [...set].slice(0, POST_GRAMS_MAX);
}
