import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { ChatRoom, ChatMessage } from "../types/chat";

function toMs(val: Timestamp | number | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
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
      // map field for querying: participants.{uid} == true
      [`participantMap.${myUid}`]: true,
      [`participantMap.${otherUid}`]: true,
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
  const q = query(
    chatsCol(schoolDomain),
    where(`participantMap.${uid}`, "==", true),
    orderBy("lastMessageAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ChatRoom, "id">),
    lastMessageAt: toMs((d.data() as any).lastMessageAt),
    createdAt: toMs((d.data() as any).createdAt),
  }));
}
