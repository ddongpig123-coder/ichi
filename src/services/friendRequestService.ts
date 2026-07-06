import { MOCK_REGISTERED_USERS, type RegisteredUser } from "../data/mockRegisteredUsers";

// TODO(network): Firestoreの "users" コレクションを email で検索するクエリに置き換える。
// const q = query(collection(db, "users"), where("email", "==", email));
// const snap = await getDocs(q);
// return snap.empty ? null : (snap.docs[0].data() as RegisteredUser);
export async function findUserByEmail(email: string): Promise<RegisteredUser | null> {
  await new Promise((resolve) => setTimeout(resolve, 300)); // ネットワーク遅延のシミュレーション
  return MOCK_REGISTERED_USERS.find((u) => u.email === email) ?? null;
}

// TODO(network): Firestoreの "friendRequests" コレクションにドキュメントを作成する。
// { fromUid, toUid, status: "pending", createdAt: Date.now() }
// 相手への通知（プッシュ通知など）もここで送信する。
export async function sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
  console.log(`[stub] friend request sent: ${fromUid} -> ${toUid}`);
}

// TODO(network): 対象の "friendRequests" ドキュメントの status を "accepted" に更新し、
// userService.addFriend を使って双方の friendIds に相手を追加する。
export async function acceptFriendRequest(requestId: string): Promise<void> {
  console.log(`[stub] friend request accepted: ${requestId}`);
}
