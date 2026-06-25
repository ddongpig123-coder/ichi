import {
  collection,
  addDoc,
  getDocs,
  getDoc,
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
import type { BoardId, Post, Comment } from "../types/board";

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
  const posts: Post[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Post, "id">),
    createdAt: toMs(d.data().createdAt),
  }));
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

export async function createComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  authorUid: string,
  body: string
): Promise<void> {
  await addDoc(commentsCol(schoolDomain, boardId, postId), {
    postId,
    body,
    authorUid,
    createdAt: serverTimestamp(),
  });
  // increment counter on the post
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    commentCount: increment(1),
  });
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
  }));
}
