import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  updateDoc,
  writeBatch,
  runTransaction,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { toggleLikeDoc } from "./likeToggle";
import {
  buildPostIndex,
  commitPostWithIndex,
  fetchByIndexHits,
  loungePostIndexCol,
  loungePostIndexDoc,
  searchPostIndex,
} from "./postIndexService";
import { loungesOfForest, type ForestId, type LoungeId, type LoungePost, type LoungeComment } from "../types/lounge";

// 留学生ラウンジ（全国単位）のデータアクセス。boardService と同じ形だが、
// schoolDomain スコープを持たず lounges/{loungeId}/posts/... を対象にする。

function postsCol(loungeId: LoungeId) {
  return collection(db, "lounges", loungeId, "posts");
}

function commentsCol(loungeId: LoungeId, postId: string) {
  return collection(db, "lounges", loungeId, "posts", postId, "comments");
}

function likesCol(loungeId: LoungeId, postId: string) {
  return collection(db, "lounges", loungeId, "posts", postId, "likes");
}

function toMs(val: Timestamp | number | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
}

// ── Posts ──────────────────────────────────────────────

// tag は質問掲示板（qa の板）のカテゴリ。学校の createPost と同じく、あるときだけ書く。
export async function createLoungePost(
  loungeId: LoungeId,
  authorUid: string,
  title: string,
  body: string,
  tag: string | null = null
): Promise<string> {
  // 本体と検索索引を1つのバッチで書く（掲示板の createPost と同じ）。
  const ref = doc(postsCol(loungeId));
  await commitPostWithIndex(
    ref,
    {
      loungeId,
      title,
      body,
      authorUid,
      commentCount: 0,
      likeCount: 0,
      createdAt: serverTimestamp(),
      ...(tag ? { tag } : {}),
    },
    loungePostIndexDoc(loungeId, ref.id),
    buildPostIndex(loungeId, authorUid, title, body)
  );
  return ref.id;
}

// 森（全国）の検索。学校掲示板の searchPosts と同じ2段構成:
//   ① 検索索引(postIndex)の2-gram → 最新N件より古い投稿も拾う
//   ② 各森の最新 pageSize 件の走査 → 索引を持たない投稿と1文字検索のため
// 森は数が固定（5件）なので①も森ごとに引く。
export async function searchLoungePosts(keyword: string, pageSize = 100): Promise<LoungePost[]> {
  const { LOUNGES } = await import("../types/lounge");
  const { normalizeForSearch } = await import("./boardService");
  const kw = normalizeForSearch(keyword.trim());
  if (!kw) return [];
  const loungeIds = new Set<string>(LOUNGES.map((l) => l.id as string));
  const found = new Map<string, LoungePost>();
  // 2-gram は候補を絞るだけなので、最終判定はここで行う。
  const take = (loungeId: string, id: string, data: DocumentData) => {
    if (!loungeIds.has(loungeId) || data.deleted) return null;
    if (
      !normalizeForSearch(data.title).includes(kw) &&
      !normalizeForSearch(data.body).includes(kw)
    ) {
      return null;
    }
    if (!found.has(id)) {
      found.set(id, {
        id,
        ...(data as Omit<LoungePost, "id">),
        loungeId: loungeId as LoungeId,
        createdAt: toMs(data.createdAt),
      });
    }
    return null;
  };

  await Promise.all(
    LOUNGES.flatMap((l) => [
      // 索引が失敗しても最新走査の結果は返す（boardService.searchPosts と同じ理由）。
      (async () => {
        try {
          const hits = await searchPostIndex(loungePostIndexCol(l.id), keyword);
          if (!hits) return;
          await fetchByIndexHits(hits, (lid) => (loungeIds.has(lid) ? postsCol(lid as LoungeId) : null), take);
        } catch (e) {
          console.warn("lounge index search failed (falling back to recent scan):", e);
        }
      })(),
      (async () => {
        const snap = await getDocs(
          query(postsCol(l.id), orderBy("createdAt", "desc"), limit(pageSize))
        );
        snap.docs.forEach((d) => take(l.id, d.id, d.data()));
      })(),
    ])
  );

  return [...found.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchLoungePosts(
  loungeId: LoungeId,
  pageSize = 20
): Promise<LoungePost[]> {
  const q = query(postsCol(loungeId), orderBy("createdAt", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  // 削除済みはクライアントで除外（理由は boardService.fetchPosts のコメント参照）
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as Omit<LoungePost, "id">),
      createdAt: toMs(d.data().createdAt),
    }))
    .filter((p) => !p.deleted);
}

// 森の板の一覧（ページング付き）。学校の boardService.fetchPosts と同じ形。
// 以前は最新 20 件だけで、それより古い投稿は一覧から辿れなかった（2026-11-14 学校の森に揃えた）。
export async function fetchLoungePostsPage(
  loungeId: LoungeId,
  pageSize = 20,
  after?: QueryDocumentSnapshot<DocumentData>
): Promise<{ posts: LoungePost[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const q = after
    ? query(postsCol(loungeId), orderBy("createdAt", "desc"), startAfter(after), limit(pageSize))
    : query(postsCol(loungeId), orderBy("createdAt", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  const posts = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LoungePost, "id">), createdAt: toMs(d.data().createdAt) }))
    .filter((p) => !p.deleted);
  // hasMore は生ドキュメント数で判定（削除ぶん posts は減るため。boardService.fetchPosts と同じ）
  return { posts, lastDoc: snap.docs[snap.docs.length - 1] ?? null, hasMore: snap.docs.length === pageSize };
}

// 森のベスト投稿（その森の板ぜんぶから いいね数トップ N）。学校の fetchBestPosts と同じ集め方。
// 板ごとに likeCount 降順で N 件 → まとめて並べ替え。単一フィールドの並べ替えなので複合索引は要らない。
export type BestLoungePost = LoungePost & { loungeId: LoungeId };
export async function fetchBestLoungePosts(forest: ForestId, topN = 20): Promise<BestLoungePost[]> {
  const all: BestLoungePost[] = [];
  await Promise.all(
    loungesOfForest(forest).map(async (l) => {
      const snap = await getDocs(query(postsCol(l.id), orderBy("likeCount", "desc"), limit(topN)));
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.deleted) return;
        all.push({
          id: d.id,
          ...(data as Omit<LoungePost, "id">),
          loungeId: l.id,
          likeCount: (data.likeCount ?? 0) as number,
          createdAt: toMs(data.createdAt),
        });
      });
    })
  );
  return all.filter((p) => p.likeCount > 0).sort((a, b) => b.likeCount - a.likeCount).slice(0, topN);
}

// ── ベストアンサー（質問掲示板） ─────────────────────────
// 学校の boardService.setBestComment / clearBestComment と同じ。作成者本人の update なので
// firestore.rules の isAuthorEditOfPost（resolved / bestCommentId）で許可済み。
export async function setBestLoungeComment(loungeId: LoungeId, postId: string, commentId: string): Promise<void> {
  await updateDoc(doc(postsCol(loungeId), postId), { bestCommentId: commentId, resolved: true });
}

export async function clearBestLoungeComment(loungeId: LoungeId, postId: string): Promise<void> {
  await updateDoc(doc(postsCol(loungeId), postId), { bestCommentId: null, resolved: false });
}

// ラウンジ内の検索（ヘッダーの🔍から）。boardService.searchPostsInBoard と同じ定番方式：
// 最近の投稿を最大 max 件取得 → タイトル/本文のキーワード部分一致(小文字)で絞る。
// ラウンジ内検索の「候補」を取得。最近 max 件を1回取得するだけで、
// キーワード絞り込みは画面側でクライアント実行（入力ごとの即時フィルタ用）。
export async function fetchLoungeSearchCandidates(
  loungeId: LoungeId,
  max = 200
): Promise<LoungePost[]> {
  const q = query(postsCol(loungeId), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LoungePost, "id">), createdAt: toMs(d.data().createdAt) }))
    .filter((p) => !p.deleted);
}

// ── 削除（ソフトデリート） ──────────────────────────────
// MODERATION.md §1。学校掲示板と同じ扱い（boardService.softDeletePost 参照）。
export async function softDeleteLoungePost(
  loungeId: LoungeId,
  postId: string
): Promise<void> {
  await updateDoc(doc(postsCol(loungeId), postId), {
    deleted: true,
    deletedAt: Date.now(),
  });
}

export async function softDeleteLoungeComment(
  loungeId: LoungeId,
  postId: string,
  commentId: string
): Promise<void> {
  // boardService.softDeleteComment と同じ: 削除フラグとカウンター -1 を 1 トランザクションで。
  // lastCommentId で「本当に削除されたコメントの分か」をルールが確かめる（#50）。
  const postRef = doc(postsCol(loungeId), postId);
  const commentRef = doc(commentsCol(loungeId, postId), commentId);
  await runTransaction(db, async (tx) => {
    const post = await tx.get(postRef);
    const count = (post.data()?.commentCount as number | undefined) ?? 0;
    tx.update(commentRef, { deleted: true, deletedAt: Date.now() });
    if (count > 0) {
      tx.update(postRef, { commentCount: increment(-1), lastCommentId: commentId });
    }
  });
}

export async function fetchLoungePost(
  loungeId: LoungeId,
  postId: string
): Promise<LoungePost | null> {
  const snap = await getDoc(doc(postsCol(loungeId), postId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<LoungePost, "id">),
    createdAt: toMs(snap.data().createdAt),
  };
}

// ── Comments ───────────────────────────────────────────

// parentId を渡すと返信（대댓글）。parentId はスレッド root（トップレベル）の id。
// mentionUid は返信先の人の uid（表示は @匿名N、通知にも使える）。
export async function createLoungeComment(
  loungeId: LoungeId,
  postId: string,
  authorUid: string,
  body: string,
  parentId: string | null = null,
  mentionUid: string | null = null
): Promise<void> {
  // boardService.createComment と同じ: コメント文書と +1 を 1 バッチで、id を lastCommentId に載せる
  //（ルールが existsAfter で「本当にコメントが増えたか」を確かめる。docs/SECURITY-1.1.md §7）。
  const commentRef = doc(commentsCol(loungeId, postId));
  const batch = writeBatch(db);
  batch.set(commentRef, {
    postId,
    body,
    authorUid,
    parentId,
    mentionUid,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(postsCol(loungeId), postId), {
    commentCount: increment(1),
    lastCommentId: commentRef.id,
  });
  await batch.commit();
}

export async function fetchLoungeComments(
  loungeId: LoungeId,
  postId: string
): Promise<LoungeComment[]> {
  const q = query(commentsCol(loungeId, postId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<LoungeComment, "id">),
    createdAt: toMs(d.data().createdAt),
    likeCount: (d.data().likeCount ?? 0) as number,
    parentId: (d.data().parentId ?? null) as string | null,
    mentionUid: (d.data().mentionUid ?? null) as string | null,
  }));
}

// ── コメント/返信のいいね（posts の likes と同じ構造） ──────
function commentLikesCol(loungeId: LoungeId, postId: string, commentId: string) {
  return collection(db, "lounges", loungeId, "posts", postId, "comments", commentId, "likes");
}

export async function toggleLoungeCommentLike(
  loungeId: LoungeId,
  postId: string,
  commentId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(commentLikesCol(loungeId, postId, commentId), uid);
  const commentRef = doc(commentsCol(loungeId, postId), commentId);
  return toggleLikeDoc(likeRef, commentRef, uid);
}

export async function fetchLikedLoungeCommentIds(
  loungeId: LoungeId,
  postId: string,
  commentIds: string[],
  uid: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  await Promise.all(
    commentIds.map(async (cid) => {
      const snap = await getDoc(doc(commentLikesCol(loungeId, postId, cid), uid));
      if (snap.exists()) liked.add(cid);
    })
  );
  return liked;
}

// ── Likes ──────────────────────────────────────────────

export async function toggleLoungeLike(
  loungeId: LoungeId,
  postId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(likesCol(loungeId, postId), uid);
  const postRef = doc(postsCol(loungeId), postId);
  return toggleLikeDoc(likeRef, postRef, uid);
}

export async function checkLoungeLiked(
  loungeId: LoungeId,
  postId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(doc(likesCol(loungeId, postId), uid));
  return snap.exists();
}
