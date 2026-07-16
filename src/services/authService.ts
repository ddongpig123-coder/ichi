import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithPopup,
  OAuthProvider,
  sendEmailVerification,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { Platform } from "react-native";
import { auth } from "../config/firebase";
import { createUserProfile } from "./userService";

// ── Microsoft（大学アカウント）認証 ──────────────────────────
// FirebaseはMicrosoftのIDトークン直接検証を非対応のため、
// Firebase Authのpopupフロー(__/auth/handler経由)を使用する。
// 前提: Firebaseコンソール側でMicrosoftプロバイダ有効化済み +
//       AzureアプリにリダイレクトURI https://ichi-6b8f7.firebaseapp.com/__/auth/handler 登録済み。
// NOTE: popupはWeb専用。ネイティブ対応はPhase 1bで別途
//       （expo-web-browser + カスタムスキーム or dev-client検討）。
export const MICROSOFT_WEB_ONLY_ERROR = "MICROSOFT_WEB_ONLY";

function microsoftProvider(): OAuthProvider {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

// ゲスト(匿名)のuidを維持したままMicrosoftアカウントを連結する
export async function linkAnonymousWithMicrosoft(): Promise<User> {
  if (Platform.OS !== "web") throw new Error(MICROSOFT_WEB_ONLY_ERROR);
  const current = auth.currentUser;
  if (!current) throw new Error("ログイン状態が確認できません");
  if (!current.isAnonymous) throw new Error("既にアカウント登録済みです");
  const result = await linkWithPopup(current, microsoftProvider());
  return result.user;
}

// 既にMicrosoft登録済みのユーザーのログイン
export async function signInWithMicrosoft(): Promise<User> {
  if (Platform.OS !== "web") throw new Error(MICROSOFT_WEB_ONLY_ERROR);
  const result = await signInWithPopup(auth, microsoftProvider());
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// パスワードは Firebase Auth に直接渡すだけで、こちら側では一切保持・保存しない。
// ハッシュ化・暗号化・検証はすべて Firebase のサーバー側で行われる。
export async function signUpWithEmail(
  email: string,
  password: string,
  nickname: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await createUserProfile(result.user.uid, email, nickname);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

// ── 匿名アカウントの昇格（アカウント連携） ────────────────────
// ゲスト(匿名)のuidを維持したままメール認証情報を連結する。
// 新規アカウントを作らないため、ゲスト時代の時間割・友達データがそのまま残る。
// パスワードはFirebase Authに直接渡すのみ（保持・保存しない）。
export async function linkAnonymousWithEmail(
  email: string,
  password: string,
  nickname: string
): Promise<User> {
  const current = auth.currentUser;
  if (!current) throw new Error("ログイン状態が確認できません");
  if (!current.isAnonymous) throw new Error("既にアカウント登録済みです");

  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(current, credential);

  // usersドキュメントは ensureUserProfile で作成済み → email/nicknameのみ更新
  const { updateAccountInfo } = await import("./userService");
  await updateAccountInfo(result.user.uid, email, nickname);
  return result.user;
}

// Returns true only if the email domain is a known university domain.
// Extend this list or replace with a Firestore allowlist.
export function isUniversityEmail(email: string): boolean {
  const allowed = [
    ".ac.jp",
    ".edu",
    ".university",
  ];
  return allowed.some((suffix) => email.endsWith(suffix));
}

// ── 学校メール認証（sendEmailVerification） ──────────────────
// M365未導入の大学をカバーするための所有確認。認証されると学校認証バッジを表示する。
// verificationLevel の昇格はサーバー側(Cloud Functions)の責務のまま — ここでは
// Firebase Auth の emailVerified フラグのみを使う（クライアントからFirestoreは触らない）。

export async function sendSchoolVerificationEmail(): Promise<void> {
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error("ログイン状態が確認できません");
  await sendEmailVerification(u);
}

// メールのリンクを開いた後に呼ぶ。Authユーザーを再読込して認証状態を反映する。
export async function reloadAndCheckEmailVerified(): Promise<boolean> {
  const u = auth.currentUser;
  if (!u) return false;
  await u.reload();
  return u.emailVerified;
}

export function isMicrosoftLinked(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "microsoft.com");
}

// 学校認証バッジの表示判定:
// 大学メール かつ（メール認証済み or Microsoft(M365)連携済み = 組織アカウントで所有証明済み）
export function isSchoolVerified(user: User | null): boolean {
  if (!user?.email || !isUniversityEmail(user.email)) return false;
  return user.emailVerified || isMicrosoftLinked(user);
}
