import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type {
  ContentQueueItem,
  ContentQueueStatus,
  ContentScope,
} from "../types/contentQueue";

// コンテンツ投稿キュー（docs/CONTENT-OPS.md §9）。運営アカウントのみ読み書き可（firestore.rules）。
// 投稿そのものは別リポジトリの post-next.mjs（GitHub Actions）が行う。ここは承認画面用。

const queueCol = collection(db, "contentQueue");

function toMs(val: Timestamp | number | null | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
}

function fromDoc(id: string, data: Record<string, any>): ContentQueueItem {
  return {
    ...(data as Omit<ContentQueueItem, "id">),
    id,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
    postedAt: data.postedAt ? toMs(data.postedAt) : null,
  };
}

// 自分が運営アカウントか（operators/{uid} の存在）。
// 一般ユーザーは自分の uid の get だけ許可されている（未登録なら exists=false）。
export async function isOperator(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "operators", uid));
    return snap.exists();
  } catch {
    return false;
  }
}

// ステータス別の一覧。where + orderBy は複合インデックスが要るため、並べ替えはクライアントで行う
// （キューは多くても数百件）。approved は「次に投稿される順」= 古い順、それ以外は新しい順。
export async function listQueue(status: ContentQueueStatus): Promise<ContentQueueItem[]> {
  const snap = await getDocs(query(queueCol, where("status", "==", status)));
  const items = snap.docs.map((d) => fromDoc(d.id, d.data()));
  return items.sort((a, b) =>
    status === "approved" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
  );
}

export async function getQueueItem(id: string): Promise<ContentQueueItem | null> {
  const snap = await getDoc(doc(queueCol, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

export interface QueueDraftInput {
  scope: ContentScope;
  schoolDomain: string | null;
  boardId: string;
  title: string;
  body: string;
  sourceUrl: string | null;
}

// 手書きの投稿を追加する。status は draft（あとで承認）か approved（すぐ予約に入れる）。
export async function createManualItem(
  uid: string,
  input: QueueDraftInput,
  status: "draft" | "approved"
): Promise<string> {
  const ref = await addDoc(queueCol, {
    status,
    source: "manual",
    scope: input.scope,
    schoolDomain: input.scope === "school" ? input.schoolDomain : null,
    boardId: input.boardId,
    title: input.title.trim(),
    body: input.body.trim(),
    topic: null,
    sourceUrl: input.sourceUrl?.trim() || null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// 内容の修正 + ステータス変更（承認・却下・下書きに戻す）。
// posted のものはここでは変えない（画面側で読み取り専用にする）。
export async function updateQueueItem(
  id: string,
  input: QueueDraftInput,
  status: Exclude<ContentQueueStatus, "posted">
): Promise<void> {
  await updateDoc(doc(queueCol, id), {
    status,
    scope: input.scope,
    schoolDomain: input.scope === "school" ? input.schoolDomain : null,
    boardId: input.boardId,
    title: input.title.trim(),
    body: input.body.trim(),
    sourceUrl: input.sourceUrl?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}
