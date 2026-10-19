import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  limit,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { ChatRoom, ChatMessage } from "../types/chat";

function toMs(val: Timestamp | number | null | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
}

// lastRead マップ（uid → Timestamp）を ms に正規化する。
// 既読を書いた直後のローカルスナップショットは serverTimestamp が null で届くので
// toMs が「今」を返す＝サーバ確定までの間もバッジは消えたまま（ちらつかない）。
// 旧データ（端末の Date.now() を入れていた頃の number）もそのまま読める。
function toMsMap(val: unknown): Record<string, number> | undefined {
  if (!val || typeof val !== "object") return undefined;
  const out: Record<string, number> = {};
  Object.entries(val as Record<string, Timestamp | number | null>).forEach(([uid, v]) => {
    out[uid] = toMs(v);
  });
  return out;
}

// チャット文書 → ChatRoom（時刻は全部 ms に正規化してから画面に渡す）
function mapChat(d: QueryDocumentSnapshot): ChatRoom {
  const data = d.data();
  return {
    id: d.id,
    ...(data as Omit<ChatRoom, "id">),
    lastRead: toMsMap(data.lastRead),
    lastMessageAt: toMs(data.lastMessageAt),
    createdAt: toMs(data.createdAt),
  };
}

function chatsCol(schoolDomain: string) {
  return collection(db, "schools", schoolDomain, "chats");
}

function messagesCol(schoolDomain: string, chatId: string) {
  return collection(db, "schools", schoolDomain, "chats", chatId, "messages");
}

function chatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join("_");
}

export async function getOrCreateChat(
  schoolDomain: string,
  myUid: string,
  otherUid: string,
  relatedPostTitle: string
): Promise<string> {
  const id = chatId(myUid, otherUid);
  const ref = doc(chatsCol(schoolDomain), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [myUid, otherUid],
      relatedPostTitle,
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
  return id;
}

export async function sendMessage(
  schoolDomain: string,
  chatRoomId: string,
  senderUid: string,
  text: string
): Promise<void> {
  await addDoc(messagesCol(schoolDomain, chatRoomId), {
    senderUid,
    text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(chatsCol(schoolDomain), chatRoomId), {
    lastMessage: text.length > 40 ? text.slice(0, 40) + "…" : text,
    lastMessageAt: serverTimestamp(),
    lastSenderUid: senderUid, // 未読バッジ判定（自分が送ったものは未読にしない）
  });
}

export function subscribeToMessages(
  schoolDomain: string,
  chatRoomId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const q = query(messagesCol(schoolDomain, chatRoomId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const messages: ChatMessage[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ChatMessage, "id">),
      createdAt: toMs(d.data().createdAt),
    }));
    callback(messages);
  });
}

export async function fetchMyChats(
  schoolDomain: string,
  uid: string
): Promise<ChatRoom[]> {
  // array-contains는 orderBy와 조합 시 인덱스 불필요, 정렬은 클라이언트에서
  const q = query(
    chatsCol(schoolDomain),
    where("participants", "array-contains", uid),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapChat).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

// ── 未読バッジ ──────────────────────────────────────────
// 「最後に読んだ時刻」はチャット文書の lastRead マップ（キー=uid）に持つ。
// firestore.rules の chats update は参加者に許可済みなのでルール変更は不要。
// 端末をまたいで同期される（ローカル保存にしない理由）。
// lastMessageAt と同じ serverTimestamp で保存する（端末の時計がずれていても
// 比較の基準が同じサーバ時刻になるので、バッジが誤って点く・消えるのを防ぐ）。

export function isChatUnread(chat: ChatRoom, uid: string): boolean {
  if (chat.lastSenderUid === uid) return false; // 自分が最後に送った
  if (!chat.lastMessage) return false;          // まだ本文なし（作成直後）
  return chat.lastMessageAt > (chat.lastRead?.[uid] ?? 0);
}

// 自分が参加するチャットの購読（未読バッジ用。リアルタイムで届く）
export function subscribeToMyChats(
  schoolDomain: string,
  uid: string,
  callback: (chats: ChatRoom[]) => void
): () => void {
  const q = query(chatsCol(schoolDomain), where("participants", "array-contains", uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map(mapChat));
    },
    (e) => console.warn("chats subscribe failed:", e)
  );
}

// 既読にする（チャット画面を開いたとき）。失敗しても表示は壊さない。
export async function markChatRead(
  schoolDomain: string,
  chatRoomId: string,
  uid: string
): Promise<void> {
  await updateDoc(doc(chatsCol(schoolDomain), chatRoomId), {
    [`lastRead.${uid}`]: serverTimestamp(),
  }).catch((e) => console.warn("markChatRead failed:", e));
}
