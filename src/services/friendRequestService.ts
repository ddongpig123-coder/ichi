import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { getPublicProfile, lookupUidByEmail, type PublicProfile } from "./userService";

// ============================================================
// 友達申請・友達関係の実データ層
// Firestore（firestore.rules と1:1対応）:
//   friendRequests/{autoId} = { fromUid, toUid, status, createdAt }
//     - 作成: fromUid本人のみ / status変更: toUid本人のみ(statusフィールド限定)
//   friendships/{pairId}    = { participants: [uid小, uid大], createdAt }
//     - pairId はソート済み "uid1_uid2"（ルール側の pairId() と同一規則）
// ============================================================

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: FriendRequestStatus;
  createdAt: number;
}

export interface FriendRequestWithSender extends FriendRequest {
  sender: PublicProfile | null;
}

// ルールの pairId() と同一のソート規則（uidはASCIIなので辞書順比較で一致する）
export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

const requestsCol = () => collection(db, "friendRequests");
const friendshipDoc = (a: string, b: string) => doc(db, "friendships", pairId(a, b));

// ── 検索 ─────────────────────────────────────────────────
// emailIndex → usersPublic の2段引き。見つからなければ null。
export async function findUserByEmail(email: string): Promise<PublicProfile | null> {
  const uid = await lookupUidByEmail(email);
  if (!uid) return null;
  return getPublicProfile(uid);
}

// ── 申請 ─────────────────────────────────────────────────
export type SendRequestResult =
  | "sent"
  | "self"            // 自分自身への申請
  | "already-friends" // 既に友達
  | "already-sent"    // 送信済みの保留中申請あり
  | "incoming-exists"; // 相手から既に申請が届いている（受信箱で承認を促す）

export async function sendFriendRequest(
  fromUid: string,
  toUid: string
): Promise<SendRequestResult> {
  if (fromUid === toUid) return "self";

  // 既に友達か（pairIdで1点読み）
  const fs = await getDoc(friendshipDoc(fromUid, toUid));
  if (fs.exists()) return "already-friends";

  // 自分→相手の保留中申請（等価フィルタのみなので複合インデックス不要）
  const dupSnap = await getDocs(
    query(
      requestsCol(),
      where("fromUid", "==", fromUid),
      where("toUid", "==", toUid),
      where("status", "==", "pending")
    )
  );
  if (!dupSnap.empty) return "already-sent";

  // 相手→自分の保留中申請（相互申請なら受信箱で承認してもらう）
  const incomingSnap = await getDocs(
    query(
      requestsCol(),
      where("fromUid", "==", toUid),
      where("toUid", "==", fromUid),
      where("status", "==", "pending")
    )
  );
  if (!incomingSnap.empty) return "incoming-exists";

  await addDoc(requestsCol(), {
    fromUid,
    toUid,
    status: "pending",
    createdAt: Date.now(),
  });
  return "sent";
}

// ── 受信箱 ────────────────────────────────────────────────
export async function fetchReceivedRequests(uid: string): Promise<FriendRequestWithSender[]> {
  const snap = await getDocs(
    query(requestsCol(), where("toUid", "==", uid), where("status", "==", "pending"))
  );
  const requests = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, "id">) }));
  // 送信者の公開プロフィールを結合（申請数は高々数件なので逐次getで十分）
  const withSender = await Promise.all(
    requests.map(async (r) => ({
      ...r,
      sender: await getPublicProfile(r.fromUid).catch(() => null),
    }))
  );
  return withSender.sort((a, b) => b.createdAt - a.createdAt);
}

// 承認: status更新(toUid本人のみ・ルール強制) → friendships作成
export async function acceptFriendRequest(request: FriendRequest): Promise<void> {
  await updateDoc(doc(db, "friendRequests", request.id), { status: "accepted" });
  await setDoc(friendshipDoc(request.fromUid, request.toUid), {
    participants: [request.fromUid, request.toUid].sort(),
    createdAt: Date.now(),
  });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "rejected" });
}

// ── 友達一覧 ──────────────────────────────────────────────
export async function fetchFriendUids(uid: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, "friendships"), where("participants", "array-contains", uid))
  );
  return snap.docs
    .map((d) => (d.data().participants as string[]).find((p) => p !== uid))
    .filter((p): p is string => !!p);
}

export async function fetchFriendProfiles(uid: string): Promise<PublicProfile[]> {
  const uids = await fetchFriendUids(uid);
  const profiles = await Promise.all(
    uids.map((fid) => getPublicProfile(fid).catch(() => null))
  );
  return profiles.filter((p): p is PublicProfile => p !== null);
}

export async function removeFriendship(uid: string, otherUid: string): Promise<void> {
  await deleteDoc(friendshipDoc(uid, otherUid));
}
