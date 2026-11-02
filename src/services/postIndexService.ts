// ============================================================
// 投稿検索の索引（学校掲示板・森で共用）
//
// 以前は「各掲示板の最新N件を取ってクライアントで絞る」方式だったので、
// N件より古い投稿は検索に出てこなかった。2-gram の array-contains で引く。
//
// 索引は投稿本体と別文書（schools/{sd}/postIndex/{postId}）。本体に grams を
// 持たせると一覧取得のたびに2-gramを数百個ダウンロードしてしまう。
// 学校ぶんは1コレクションなので、掲示板をまたいだ検索が1クエリで済む。
// ============================================================
import {
  collection,
  doc,
  documentId,
  setDoc,
  writeBatch,
  getDocs,
  limit,
  query,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { makePostGrams, queryGram } from "../utils/ngram";
import type { PostIndexDoc } from "../types/postIndex";

// array-contains で引く候補の上限（1回の検索でこの件数まで読む）。
export const POST_INDEX_CANDIDATES = 150;

// documentId() の in クエリの上限（Firestore の制限）。
const IN_CHUNK = 30;

export function schoolPostIndexCol(schoolDomain: string): CollectionReference<DocumentData> {
  return collection(db, "schools", schoolDomain, "postIndex");
}

export function loungePostIndexCol(loungeId: string): CollectionReference<DocumentData> {
  return collection(db, "lounges", loungeId, "postIndex");
}

export function schoolPostIndexDoc(schoolDomain: string, postId: string) {
  return doc(db, "schools", schoolDomain, "postIndex", postId);
}

export function loungePostIndexDoc(loungeId: string, postId: string) {
  return doc(db, "lounges", loungeId, "postIndex", postId);
}

// 投稿作成と同じバッチで書く索引の中身。
export function buildPostIndex(
  boardId: string,
  authorUid: string,
  title: string,
  body: string
): PostIndexDoc {
  return {
    boardId,
    authorUid,
    grams: makePostGrams(title, body),
    createdAt: Date.now(),
  };
}

// 投稿本体と索引を1つのバッチで書く。バッチは「全部か無か」なので、索引が書けなければ
// 投稿自体が失敗する。索引のルールがまだ配備されていない状態で新しいアプリが先に
// 行き渡ると、それだけで投稿ができなくなるので、permission-denied のときは
// **本体だけ**で書き直す。索引が欠けた投稿は scripts/backfill-post-index.mjs が後で補う。
export async function commitPostWithIndex(
  postRef: DocumentReference,
  postData: Record<string, unknown>,
  indexRef: DocumentReference,
  indexData: PostIndexDoc
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(postRef, postData);
  batch.set(indexRef, indexData);
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string })?.code !== "permission-denied") throw e;
    // 学校ちがい等で本体そのものが拒否された場合は、ここでも同じ理由で失敗する。
    console.warn("post index write denied; posting without index:", e);
    await setDoc(postRef, postData);
  }
}

// 索引を引いて {postId, boardId} を返す。
// null = キーワードから2-gramが作れない（1文字など）＝索引では引けない。
// 呼び出し側は「最新N件の走査」だけで結果を出す。
export async function searchPostIndex(
  indexCol: CollectionReference<DocumentData>,
  keyword: string
): Promise<{ postId: string; boardId: string }[] | null> {
  const gram = queryGram(keyword);
  if (!gram || gram.length < 2) return null;
  // orderBy は付けない。複合索引（grams + createdAt）が必要になり、
  // 規則デプロイとは別に索引デプロイが要るため。並べ替えは呼び出し側が本体取得後に行う。
  const snap = await getDocs(
    query(indexCol, where("grams", "array-contains", gram), limit(POST_INDEX_CANDIDATES))
  );
  return snap.docs.map((d) => ({
    postId: d.id,
    boardId: (d.data().boardId ?? "") as string,
  }));
}

// postId を boardId ごとにまとめ、documentId() の in クエリで本体を取る。
// 索引ヒットを本体に引き当てる処理は掲示板と森で同じなのでここに置く。
export async function fetchByIndexHits<T>(
  hits: { postId: string; boardId: string }[],
  postsColOf: (boardId: string) => CollectionReference<DocumentData> | null,
  pick: (boardId: string, id: string, data: DocumentData) => T | null
): Promise<T[]> {
  const byBoard = new Map<string, string[]>();
  for (const h of hits) {
    if (!h.boardId) continue;
    const ids = byBoard.get(h.boardId) ?? [];
    ids.push(h.postId);
    byBoard.set(h.boardId, ids);
  }
  const out: T[] = [];
  await Promise.all(
    [...byBoard].map(async ([boardId, ids]) => {
      const col = postsColOf(boardId);
      if (!col) return; // 消えたカスタム掲示板
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const snap = await getDocs(
          query(col, where(documentId(), "in", ids.slice(i, i + IN_CHUNK)))
        );
        snap.docs.forEach((d) => {
          const v = pick(boardId, d.id, d.data());
          if (v) out.push(v);
        });
      }
    })
  );
  return out;
}
