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
  serverTimestamp,
  increment,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { LoungeId, LoungePost, LoungeComment } from "../types/lounge";

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

export async function createLoungePost(
  loungeId: LoungeId,
  authorUid: string,
  title: string,
  body: string
): Promise<string> {
  const ref = await addDoc(postsCol(loungeId), {
    loungeId,
    title,
    body,
    authorUid,
    commentCount: 0,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
  await updateDoc(doc(commentsCol(loungeId, postId), commentId), {
    deleted: true,
    deletedAt: Date.now(),
  });
  await updateDoc(doc(postsCol(loungeId), postId), {
    commentCount: increment(-1),
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

export async function createLoungeComment(
  loungeId: LoungeId,
  postId: string,
  authorUid: string,
  body: string
): Promise<void> {
  await addDoc(commentsCol(loungeId, postId), {
    postId,
    body,
    authorUid,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(postsCol(loungeId), postId), {
    commentCount: increment(1),
  });
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
  }));
}

// ── Likes ──────────────────────────────────────────────

export async function toggleLoungeLike(
  loungeId: LoungeId,
  postId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(likesCol(loungeId, postId), uid);
  const postRef = doc(postsCol(loungeId), postId);
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

export async function checkLoungeLiked(
  loungeId: LoungeId,
  postId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(doc(likesCol(loungeId, postId), uid));
  return snap.exists();
}
