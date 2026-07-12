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

// 初回進入時にusersドキュメントを保証する（匿名ユーザー含む）。
// 存在しない場合のみ作成 — 時間割・友達など全データの土台になるため、
// 認証方式に関係なく必ずドキュメントが存在する状態を作る。
// verificationLevel は必ず0（firestore.rulesで強制済み）。
export async function ensureUserProfile(uid: string, email: string | null): Promise<void> {
  const snap = await getDoc(userDoc(uid));
  if (snap.exists()) return;
  await createUserProfile(uid, email ?? "", "ゲスト");
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// アカウント連携(匿名→メール)完了時にemail/nicknameを反映する
export async function updateAccountInfo(
  uid: string,
  email: string,
  nickname: string
): Promise<void> {
  await setDoc(userDoc(uid), { uid, email, nickname }, { merge: true });
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
