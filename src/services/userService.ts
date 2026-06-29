import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../config/firebase";
import type { UserProfile } from "../types/user";

function userDoc(uid: string) {
  return doc(db, "users", uid);
}

// Firebase Auth がアカウント作成済みであることが前提。パスワードはここでは一切扱わない。
export async function createUserProfile(
  uid: string,
  email: string,
  nickname: string
): Promise<void> {
  await setDoc(userDoc(uid), {
    uid,
    email,
    nickname,
    photoURL: null,
    friendIds: [],
    createdAt: Date.now(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateNickname(uid: string, nickname: string): Promise<void> {
  await updateDoc(userDoc(uid), { nickname });
}

export async function updatePhotoURL(uid: string, photoURL: string): Promise<void> {
  await updateDoc(userDoc(uid), { photoURL });
}

export async function addFriend(uid: string, friendUid: string): Promise<void> {
  await updateDoc(userDoc(uid), { friendIds: arrayUnion(friendUid) });
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  await updateDoc(userDoc(uid), { friendIds: arrayRemove(friendUid) });
}
