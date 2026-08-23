import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  TwitterAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithPopup,
  AuthProvider,
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

// ── ソーシャルログイン（Google / X(Twitter) / LINE） ──────────
// いずれも popup フローのため **Web 専用**（Microsoft と同じ。ネイティブは EAS dev-client 段階で）。
// 前提（各プロバイダごとに Firebase コンソール側の有効化 + 外部アプリ登録が必要）:
//   - google.com : Firebase Console → Authentication → Google を有効化（追加登録ほぼ不要）
//   - twitter.com: X(Twitter) Developer でアプリ作成 → API Key/Secret を Firebase に登録
//   - oidc.line  : LINE Developers で LINE Login チャネル作成 → Firebase で OIDC プロバイダ
//                  （プロバイダID "line" → Firebase 上は "oidc.line"）を追加。callback に
//                  https://ichi-6b8f7.firebaseapp.com/__/auth/handler を登録
// どのプロバイダも上記の外部設定が未完だと auth/operation-not-allowed 等で失敗する。
export type SocialProviderId = "microsoft.com" | "google.com" | "twitter.com" | "oidc.line";
export const SOCIAL_WEB_ONLY_ERROR = "SOCIAL_WEB_ONLY";

function makeSocialProvider(id: SocialProviderId): AuthProvider {
  if (id === "google.com") {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }
  if (id === "twitter.com") {
    return new TwitterAuthProvider();
  }
  // microsoft.com / oidc.line は汎用 OAuthProvider（OIDC 含む）で扱う
  const p = new OAuthProvider(id);
  if (id === "microsoft.com") p.setCustomParameters({ prompt: "select_account" });
  if (id === "oidc.line") p.addScope("openid"), p.addScope("profile"), p.addScope("email");
  return p;
}

// ゲスト(匿名)の uid を維持したままソーシャルアカウントを連結する
export async function linkAnonymousWithSocial(id: SocialProviderId): Promise<User> {
  if (Platform.OS !== "web") throw new Error(SOCIAL_WEB_ONLY_ERROR);
  const current = auth.currentUser;
  if (!current) throw new Error("ログイン状態が確認できません");
  if (!current.isAnonymous) throw new Error("既にアカウント登録済みです");
  const result = await linkWithPopup(current, makeSocialProvider(id));
  return result.user;
}

// 既にソーシャル登録済みのユーザーのログイン
export async function signInWithSocial(id: SocialProviderId): Promise<User> {
  if (Platform.OS !== "web") throw new Error(SOCIAL_WEB_ONLY_ERROR);
  const result = await signInWithPopup(auth, makeSocialProvider(id));
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
  const lower = email.toLowerCase();
  const suffixes = [
    ".ac.jp",
    ".edu",
    ".university",
  ];
  if (suffixes.some((suffix) => lower.endsWith(suffix))) return true;
  // .ac.jp を使わない大学の例外ドメイン（@付きで厳密一致）。
  // 例: 早稲田(waseda.jp)・慶應(keio.jp)。学校を追加したらここも更新する。
  const exactDomains = ["waseda.jp", "keio.jp"];
  return exactDomains.some((d) => lower.endsWith("@" + d));
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
