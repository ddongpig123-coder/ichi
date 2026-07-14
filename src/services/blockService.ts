import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { BlockedUser } from "../types/moderation";

// ブロックリストは users/{uid}/blocks/{blockedUid}（本人のみ読み書き・相手には見えない）。
// フィルタリングはクライアントで行う（Firestore の not-in 制限のため）。docs/MODERATION.md §3 参照。

function blocksCol(uid: string) {
  return collection(db, "users", uid, "blocks");
}

function toMs(val: Timestamp | number | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
}

export async function blockUser(myUid: string, blockedUid: string): Promise<void> {
  if (myUid === blockedUid) return; // 自分自身はブロックできない
  await setDoc(doc(blocksCol(myUid), blockedUid), {
    blockedUid,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(myUid: string, blockedUid: string): Promise<void> {
  await deleteDoc(doc(blocksCol(myUid), blockedUid));
}

export async function fetchBlockedUsers(myUid: string): Promise<BlockedUser[]> {
  const snap = await getDocs(blocksCol(myUid));
  return snap.docs
    .map((d) => ({
      blockedUid: (d.data().blockedUid as string) ?? d.id,
      createdAt: toMs(d.data().createdAt),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
