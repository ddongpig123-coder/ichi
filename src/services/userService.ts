import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../config/firebase";
import type { AcademicInfo, UserProfile } from "../types/user";

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
    // 認証レベルは必ず0で作成（昇格はCloud Functionsのみ。firestore.rulesで強制）
    verificationLevel: 0,
    language: "ja",
    schoolDomain: null,
    department: null,
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// 익명 사용자는 users/{uid} 문서가 없을 수 있으므로 setDoc(merge)로 자동 생성
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, nickname }, { merge: true });
}

export async function updatePhotoURL(uid: string, photoURL: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, photoURL }, { merge: true });
}

export async function updateAcademicInfo(uid: string, academic: AcademicInfo): Promise<void> {
  await setDoc(userDoc(uid), { uid, academic }, { merge: true });
}

export async function addFriend(uid: string, friendUid: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, friendIds: arrayUnion(friendUid) }, { merge: true });
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, friendIds: arrayRemove(friendUid) }, { merge: true });
}
