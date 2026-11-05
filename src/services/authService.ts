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
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  User,
} from "firebase/auth";
import { Platform } from "react-native";
import { auth } from "../config/firebase";
import { createUserProfile, deleteSelfData } from "./userService";
import { clearGradState } from "./gradRecordService";

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

// ── アカウント削除（Apple/Google 必須要件） ─────────────────────
// 本人識別データ(プロフィール等)を削除 → Firebase Auth アカウントを削除。
// 投稿・コメント・쪽지は法的対応のため保存(匿名のまま)。詳細は STORE-PRIVACY-LABELS §4。
// 直近ログインが古いと deleteUser は auth/requires-recent-login を投げるため、先に再認証する。
//
// ⚠️ 実機(ネイティブ)で「削除する → 画面が固まる・通知が一切出ない」不具合への対策 (2026-10-23):
//   原因になりうる「await が永久に返らない」経路を全部塞ぐ。
//   - Firestore の書き込みはサーバー ack まで解決しない。ネイティブでストリームが確立できて
//     いないと promise が pending のままになり、成功も失敗も通知されずボタンが無効のまま残る。
//   - 動的 import(`await import(...)`) は Metro/Hermes の非同期チャンク解決に依存するため、
//     ネイティブ実機では返らない可能性がある → 静的 import に変更。
//   - 全ステップに制限時間を付け、必ず resolve か reject のどちらかで終わらせる。
//   - 本人データ削除(Firestore)の失敗・タイムアウトで Auth 削除を止めない。Auth が残ると
//     「削除したのに同じメールで登録できない」状態になり Apple 審査 5.1.1(v) を満たせないため、
//     最優先は deleteUser の実行。消し残りは本人が辿れない孤児データになる（LAUNCH-RUNBOOK 付録）。
//   - どのステップで止まったかログに残す（`npx expo start` のターミナルで追える）。
//     パスワード・メールアドレスはログに出さない（AGENTS.md の不変制約）。
export const DELETE_PASSWORD_REQUIRED = "DELETE_PASSWORD_REQUIRED";
export const DELETE_SOCIAL_WEB_ONLY = "DELETE_SOCIAL_WEB_ONLY";
export const DELETE_TIMEOUT = "DELETE_TIMEOUT";

const REAUTH_TIMEOUT_MS = 15000; // 再認証（通信1往復）
const DATA_CLEANUP_TIMEOUT_MS = 8000; // Firestore の本人データ削除
const LOCAL_CLEANUP_TIMEOUT_MS = 3000; // 端末ローカル(AsyncStorage)の削除
const AUTH_DELETE_TIMEOUT_MS = 15000; // Auth アカウント削除

// 制限時間付き await。時間内に終わらなければ code=DELETE_TIMEOUT で reject する
// （promise が pending のままでも、呼び出し側は必ず先へ進める）。
function withTimeout<T>(task: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${DELETE_TIMEOUT}: ${step} (${ms}ms)`) as Error & {
        code: string;
        step: string;
      };
      err.code = DELETE_TIMEOUT;
      err.step = step;
      reject(err);
    }, ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export async function deleteAccount(password?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("ログイン状態が確認できません");

  // 1) 再認証（匿名ゲストは不要）。パスワードを持つなら最優先（最も確実）、無ければソーシャル popup。
  if (!user.isAnonymous) {
    const providerIds = user.providerData.map((p) => p.providerId);
    const hasPassword = providerIds.includes("password");
    const oauthId = providerIds.find((id) => id !== "password");
    if (hasPassword) {
      if (!password) throw new Error(DELETE_PASSWORD_REQUIRED);
      console.log("[deleteAccount] 1/4 再認証（パスワード）");
      const cred = EmailAuthProvider.credential(user.email ?? "", password);
      await withTimeout(
        reauthenticateWithCredential(user, cred),
        REAUTH_TIMEOUT_MS,
        "reauthenticate"
      );
    } else if (oauthId) {
      // ソーシャル/Microsoft は popup 再認証（Web 専用。ネイティブは Phase 1b）。
      if (Platform.OS !== "web") throw new Error(DELETE_SOCIAL_WEB_ONLY);
      console.log("[deleteAccount] 1/4 再認証（popup）");
      const provider =
        oauthId === "microsoft.com" ? microsoftProvider() : makeSocialProvider(oauthId as any);
      // popup は本人の操作待ちなので制限時間は付けない。
      await reauthenticateWithPopup(user, provider);
    }
  }

  // 2) 本人識別データを削除（再認証後 = auth 有効なうちに）。
  //    失敗・タイムアウトしても Auth 削除へ進む（上記コメント参照）。
  console.log("[deleteAccount] 2/4 プロフィール等の削除（Firestore）");
  try {
    await withTimeout(
      deleteSelfData(user.uid, user.email),
      DATA_CLEANUP_TIMEOUT_MS,
      "deleteSelfData"
    );
  } catch (e) {
    console.warn("[deleteAccount] プロフィール削除が未完了:", (e as Error)?.message ?? e);
  }

  // 3) 端末ローカルの成績記録も消す。
  console.log("[deleteAccount] 3/4 端末ローカルの成績記録を削除");
  try {
    await withTimeout(clearGradState(user.uid), LOCAL_CLEANUP_TIMEOUT_MS, "clearGradState");
  } catch (e) {
    console.warn("[deleteAccount] ローカル削除が未完了:", (e as Error)?.message ?? e);
  }

  // 4) Auth アカウント削除。直後に AuthContext が匿名で再ログインする。
  console.log("[deleteAccount] 4/4 Auth アカウントを削除");
  await withTimeout(deleteUser(user), AUTH_DELETE_TIMEOUT_MS, "deleteUser");
  console.log("[deleteAccount] 完了");
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

// パスワード再設定メールを送る（メールは Firebase が送信。アプリはパスワードに触れない）。
// 「そのメールは未登録」は利用者に伝えない: 他人のメールアドレスが登録済みかを
// 調べる手段にさせないため（Firebase のメール列挙保護と同じ考え方）。
export async function sendPasswordReset(email: string, language: "ja" | "ko"): Promise<void> {
  auth.languageCode = language;
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") return;
    throw e;
  }
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
  // .ac.jp を使わない大学の例外ドメイン。ドメイン直下(@waseda.jp)だけでなく
  // サブドメイン(@toki.waseda.jp / @ruri.waseda.jp 等, 早稲田は学部別サブドメインが実在)も許可する。
  // 学校を追加したらここも更新する。
  const exceptionDomains = ["waseda.jp", "keio.jp"];
  return exceptionDomains.some((d) => lower.endsWith("@" + d) || lower.endsWith("." + d));
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
