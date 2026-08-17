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
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  increment,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { BoardId, BoardMeta, Post, Comment } from "../types/board";

// Extract school domain from email (e.g. "user@foo.ac.jp" → "foo.ac.jp")
export function schoolDomainFromEmail(email: string): string {
  return email.split("@")[1] ?? "unknown";
}

function postsCol(schoolDomain: string, boardId: BoardId) {
  return collection(db, "schools", schoolDomain, "boards", boardId, "posts");
}

function commentsCol(schoolDomain: string, boardId: BoardId, postId: string) {
  return collection(
    db,
    "schools",
    schoolDomain,
    "boards",
    boardId,
    "posts",
    postId,
    "comments"
  );
}

function toMs(val: Timestamp | number | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
}

// ── Posts ──────────────────────────────────────────────

export async function createPost(
  schoolDomain: string,
  boardId: BoardId,
  authorUid: string,
  title: string,
  body: string
): Promise<string> {
  const ref = await addDoc(postsCol(schoolDomain, boardId), {
    boardId,
    schoolDomain,
    title,
    body,
    authorUid,
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function fetchPosts(
  schoolDomain: string,
  boardId: BoardId,
  pageSize = 20,
  after?: QueryDocumentSnapshot<DocumentData>
): Promise<{ posts: Post[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const q = after
    ? query(postsCol(schoolDomain, boardId), orderBy("createdAt", "desc"), startAfter(after), limit(pageSize))
    : query(postsCol(schoolDomain, boardId), orderBy("createdAt", "desc"), limit(pageSize));

  const snap = await getDocs(q);
  // 削除済みはクライアントで除外する。既存ドキュメントには deleted フィールドが
  // 無く、Firestore の where("deleted","!=",true) はフィールド欠落を拾えないため。
  // ページあたりの表示件数は削除ぶん減るが、lastDoc は取得した最後のドキュメントを
  // そのまま返すのでページングはずれない。
  const posts: Post[] = snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Post, "id">),
      createdAt: toMs(d.data().createdAt),
    }))
    .filter((p) => !p.deleted);
  return { posts, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

export async function fetchPost(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<Post | null> {
  const snap = await getDoc(doc(postsCol(schoolDomain, boardId), postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Post, "id">), createdAt: toMs(snap.data().createdAt) };
}

// ── Comments ───────────────────────────────────────────

// parentId を渡すと返信（대댓글）。parentId はスレッド root（トップレベル）の id。
// mentionUid は返信先の人の uid（表示は @匿名N、通知にも使える）。
export async function createComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  authorUid: string,
  body: string,
  parentId: string | null = null,
  mentionUid: string | null = null
): Promise<void> {
  await addDoc(commentsCol(schoolDomain, boardId, postId), {
    postId,
    body,
    authorUid,
    parentId,
    mentionUid,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
  // increment counter on the post（返信もコメント数に含める）
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    commentCount: increment(1),
  });
}

// ── 削除（ソフトデリート） ──────────────────────────────
// MODERATION.md §1: hard delete せず deleted フラグを立て、記録は6ヶ月保存する。
// firestore.rules の canUpdatePost() / comments の update が本人更新を許可済みなので
// ルール変更は不要。本文は残す（開示請求時に内容の特定が必要なため）。
export async function softDeletePost(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<void> {
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    deleted: true,
    deletedAt: Date.now(),
  });
}

export async function softDeleteComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentId: string
): Promise<void> {
  await updateDoc(doc(commentsCol(schoolDomain, boardId, postId), commentId), {
    deleted: true,
    deletedAt: Date.now(),
  });
  // 削除済みコメントは一覧の件数に数えない
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    commentCount: increment(-1),
  });
}

function likesCol(schoolDomain: string, boardId: BoardId, postId: string) {
  return collection(db, "schools", schoolDomain, "boards", boardId, "posts", postId, "likes");
}

export async function toggleLike(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(likesCol(schoolDomain, boardId, postId), uid);
  const postRef = doc(postsCol(schoolDomain, boardId), postId);
  const likeSnap = await getDoc(likeRef);

  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likeCount: increment(-1) });
    const updated = await getDoc(postRef);
    return { liked: false, likeCount: (updated.data()?.likeCount ?? 0) as number };
  } else {
    await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
    await updateDoc(postRef, { likeCount: increment(1) });
    const updated = await getDoc(postRef);
    return { liked: true, likeCount: (updated.data()?.likeCount ?? 1) as number };
  }
}

export async function checkLiked(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(doc(likesCol(schoolDomain, boardId, postId), uid));
  return snap.exists();
}

// ── Dynamic boards ─────────────────────────────────────

function boardMetasCol(schoolDomain: string) {
  return collection(db, "schools", schoolDomain, "boardMetas");
}

export async function fetchCustomBoards(schoolDomain: string): Promise<BoardMeta[]> {
  const snap = await getDocs(query(boardMetasCol(schoolDomain), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BoardMeta, "id">),
    createdAt: toMs((d.data() as any).createdAt),
  }));
}

export async function createBoard(
  schoolDomain: string,
  label: string,
  description: string,
  category: BoardMeta["category"],
  createdBy: string
): Promise<string> {
  const ref = await addDoc(boardMetasCol(schoolDomain), {
    label,
    description,
    category,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function fetchBestPosts(
  schoolDomain: string,
  topN = 20,
  boards?: BoardMeta[]
): Promise<(Post & { boardLabel: string })[]> {
  const { OFFICIAL_BOARDS } = await import("../types/board");
  const allBoards: BoardMeta[] = boards ?? [
    ...OFFICIAL_BOARDS,
    ...(await fetchCustomBoards(schoolDomain)),
  ];
  const all: (Post & { boardLabel: string })[] = [];

  await Promise.all(
    allBoards.map(async (board) => {
      const q = query(postsCol(schoolDomain, board.id), orderBy("likeCount", "desc"), limit(topN));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.deleted) return;
        all.push({
          id: d.id,
          ...(data as Omit<Post, "id">),
          likeCount: (data.likeCount ?? 0) as number,
          createdAt: toMs(data.createdAt),
          boardLabel: board.label,
        });
      });
    })
  );

  return all
    .filter((p) => p.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, topN);
}

export async function searchPosts(
  schoolDomain: string,
  keyword: string,
  pageSize = 30,
  boards?: BoardMeta[]
): Promise<(Post & { boardLabel: string })[]> {
  const { OFFICIAL_BOARDS } = await import("../types/board");
  const allBoards: BoardMeta[] = boards ?? [
    ...OFFICIAL_BOARDS,
    ...(await fetchCustomBoards(schoolDomain)),
  ];
  const results: (Post & { boardLabel: string })[] = [];
  const kw = keyword.trim().toLowerCase();
  if (!kw) return results;

  await Promise.all(
    allBoards.map(async (board) => {
      const q = query(postsCol(schoolDomain, board.id), orderBy("createdAt", "desc"), limit(pageSize));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.deleted) return;
        if (
          data.title?.toLowerCase().includes(kw) ||
          data.body?.toLowerCase().includes(kw)
        ) {
          results.push({
            id: d.id,
            ...(data as Omit<Post, "id">),
            createdAt: toMs(data.createdAt),
            boardLabel: board.label,
          });
        }
      });
    })
  );

  return results.sort((a, b) => b.createdAt - a.createdAt);
}

// 単一掲示板内検索の「候補」を取得（各掲示板ヘッダーの🔍から）。
// 最近の投稿を最大 max 件取得するだけ。キーワード絞り込みは画面側でクライアント実行する
// （入力ごとに即時フィルタするため、キー入力毎の Firestore 再読み込みを避ける）。
// Firestore は全文検索が無いため、この「最近N件を1回取得 + クライアント絞り込み」が定番。
export async function fetchBoardSearchCandidates(
  schoolDomain: string,
  boardId: BoardId,
  max = 200
): Promise<Post[]> {
  const q = query(postsCol(schoolDomain, boardId), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">), createdAt: toMs(d.data().createdAt) }))
    .filter((p) => !p.deleted);
}

export async function fetchComments(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<Comment[]> {
  const q = query(
    commentsCol(schoolDomain, boardId, postId),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Comment, "id">),
    createdAt: toMs(d.data().createdAt),
    likeCount: (d.data().likeCount ?? 0) as number, // 旧データにフィールドが無い場合の既定
    parentId: (d.data().parentId ?? null) as string | null,
    mentionUid: (d.data().mentionUid ?? null) as string | null,
  }));
}

// ── コメント/返信のいいね（posts の likes と同じ構造） ──────
function commentLikesCol(schoolDomain: string, boardId: BoardId, postId: string, commentId: string) {
  return collection(db, "schools", schoolDomain, "boards", boardId, "posts", postId, "comments", commentId, "likes");
}

// 1コメントのいいねトグル。likeCount は他ユーザーも更新できる（rules: canUpdateComment）。
export async function toggleCommentLike(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(commentLikesCol(schoolDomain, boardId, postId, commentId), uid);
  const commentRef = doc(commentsCol(schoolDomain, boardId, postId), commentId);
  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(commentRef, { likeCount: increment(-1) });
    const updated = await getDoc(commentRef);
    return { liked: false, likeCount: (updated.data()?.likeCount ?? 0) as number };
  } else {
    await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
    await updateDoc(commentRef, { likeCount: increment(1) });
    const updated = await getDoc(commentRef);
    return { liked: true, likeCount: (updated.data()?.likeCount ?? 1) as number };
  }
}

// この投稿で自分がいいね済みのコメントID集合（コメント表示時に一括取得）。
export async function fetchLikedCommentIds(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentIds: string[],
  uid: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  await Promise.all(
    commentIds.map(async (cid) => {
      const snap = await getDoc(doc(commentLikesCol(schoolDomain, boardId, postId, cid), uid));
      if (snap.exists()) liked.add(cid);
    })
  );
  return liked;
}
