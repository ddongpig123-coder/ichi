import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

// ── リアルタイム購読 ───────────────────────────────────────
// 相手が承認した瞬間に双方の友達一覧へ反映するため、friendships と受信箱を onSnapshot で見る
// （2026-11-06 準熙: 承認後に一覧が変わらない / 送った側は開き直さないと出ない）。
// 初回スナップショットが件数ぶんの読み取り、以後は変更分だけ。戻り値で購読解除。
export function subscribeFriendUids(
  uid: string,
  onChange: (uids: string[]) => void
): () => void {
  const q = query(collection(db, "friendships"), where("participants", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      const uids = snap.docs
        .map((d) => (d.data().participants as string[]).find((p) => p !== uid))
        .filter((p): p is string => !!p);
      onChange(uids);
    },
    (e) => console.warn("friendships listen failed:", e)
  );
}

export function subscribeReceivedRequests(
  uid: string,
  onChange: (requests: FriendRequest[]) => void
): () => void {
  const q = query(requestsCol(), where("toUid", "==", uid), where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) => {
      const requests = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, "id">) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      onChange(requests);
    },
    (e) => console.warn("friendRequests listen failed:", e)
  );
}

// 承認: status更新(toUid本人のみ・ルール強制) と friendships作成を1つのバッチで行う。
// requestId はルールが「本当に承認された申請か」を確かめるために必要
// （これが無いと、相手の承認なしに friendships を作って友達限定の時間割を読めてしまう）。
export async function acceptFriendRequest(request: FriendRequest): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "friendRequests", request.id), { status: "accepted" });
  batch.set(friendshipDoc(request.fromUid, request.toUid), {
    participants: [request.fromUid, request.toUid].sort(),
    requestId: request.id,
    createdAt: Date.now(),
  });
  await batch.commit();
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "rejected" });
}

// ── 招待リンクで友達追加（招待した側の承認なし） ──────────
// 招待リンク（docs/INVITE-LINK.md）を開いた側が friendships を直接作る。
// リンクを配った本人の意思表示とみなし、招待した側の承認は取らない（2026-11-05 準熙決定）。
// ただし **開いた側** には画面で一度確認する（2026-11-10）。開いただけで友達になると、
// 知らない人のリンクを踏んだだけで時間割（友達まで公開）が見えてしまうため。
// inviteToken はリンクに載っていた値。#50 以降のルールは users/{inviter}.inviteToken と
// 照合し、落ちれば permission-denied → "invalid"（古いリンク・改ざん・作り直し後）。
export type InviteAddResult = "added" | "already-friends" | "self" | "invalid";

// 確認画面を出す前の判定（書き込みなし）。自分のリンク・既に友達なら確認は要らない
export async function checkInviteStatus(
  uid: string,
  inviterUid: string
): Promise<"self" | "already-friends" | "ready"> {
  if (uid === inviterUid) return "self";
  const existing = await getDoc(friendshipDoc(uid, inviterUid));
  return existing.exists() ? "already-friends" : "ready";
}

export async function addFriendByInvite(
  uid: string,
  inviterUid: string,
  inviteToken: string
): Promise<InviteAddResult> {
  if (uid === inviterUid) return "self";
  if (!inviteToken) return "invalid";
  const ref = friendshipDoc(uid, inviterUid);
  const existing = await getDoc(ref);
  if (existing.exists()) return "already-friends";
  try {
    await setDoc(ref, {
      participants: [uid, inviterUid].sort(),
      createdAt: Date.now(),
      via: "invite",
      inviteToken,
    });
  } catch (e: any) {
    if (e?.code === "permission-denied") return "invalid";
    throw e;
  }
  // 相手から自分宛てに pending の申請が残っていれば片付ける
  // （status を変えられるのは受信者だけなので、自分が送った分は触らない。失敗しても追加は成立）
  try {
    const snap = await getDocs(
      query(requestsCol(), where("fromUid", "==", inviterUid), where("toUid", "==", uid), where("status", "==", "pending"))
    );
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { status: "accepted" })));
  } catch (e) {
    console.warn("invite: pending request cleanup failed:", e);
  }
  return "added";
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

// 友達解除。承認済みの申請も消す: 残っていると、解除されたあとで古い申請を根拠に
// friendships を作り直し、相手の「友達のみ」の時間割を読めてしまう（ルールは承認済み申請を確認する）。
// 申請の掃除に失敗しても解除そのものは成立させる。
export async function removeFriendship(uid: string, otherUid: string): Promise<void> {
  await deleteDoc(friendshipDoc(uid, otherUid));
  try {
    const [mine, theirs] = await Promise.all(
      [[uid, otherUid], [otherUid, uid]].map(([from, to]) =>
        getDocs(query(requestsCol(), where("fromUid", "==", from), where("toUid", "==", to), where("status", "==", "accepted")))
      )
    );
    await Promise.all([...mine.docs, ...theirs.docs].map((d) => deleteDoc(d.ref)));
  } catch (e) {
    console.warn("accepted request cleanup failed:", e);
  }
}
