import { Platform, Share } from "react-native";
import * as Crypto from "expo-crypto";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// ============================================================
// 友達招待リンク
//
// リンクは https（公開 Web の /add-friend）にする。LINE 等のメッセンジャーは
// http(s) しか自動リンク化しないので、カスタムスキーム（uni-community://）を
// そのまま送ると「ただの文字」になって押せない（QA 2026-11-05）。
//
//   https://ichi-6b8f7.web.app/add-friend?u=<uid>&k=<inviteToken>
//
// - アプリ内（ネイティブ）で開いた場合: /add-friend 画面が招待者を見せて「友達になりますか？」と
//   一度だけ確認し、[友達になる] で friendships を作る（招待した側の承認は取らない）
// - Safari/Chrome で開いた場合（Web）: 「アプリで開く」(カスタムスキーム/intent) と
//   ストアのボタンだけを出す。Web 側のゲスト口座はアプリと別人なので、Web では友達を作らない
// - ユニバーサルリンク（タップで直接アプリ起動）はネイティブ設定が要るので 1.2 再ビルドで
//
// inviteToken は users/{uid}.inviteToken（本人しか読めない）。リンクを開いた側が
// friendships に書き込み、ルール側（#50）が users/{inviter}.inviteToken と照合する想定。
// 詳細: docs/INVITE-LINK.md
// ============================================================

// 公開 Web のオリジン（firebase.json hosting / scripts/deploy-web.mjs と同じ）
export const WEB_ORIGIN = "https://ichi-6b8f7.web.app";
// app.json の scheme / ios.bundleIdentifier / android.package と一致させること
export const APP_SCHEME = "uni-community";
export const ANDROID_PACKAGE = "jp.timetable.app";
// App Store（ascAppId 6825671804）
export const APP_STORE_URL = "https://apps.apple.com/jp/app/id6825671804";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
// Google Play はまだ本番公開前（2026-11-14 Play Console で確認: トラックは alpha・内部テストのみ）。
// 公開されたら true にして Web を再デプロイ（npm run deploy:web）。true の間は招待ページに Google Play ボタン
export const PLAY_STORE_PUBLIC = false;

// 招待トークン。無ければ作って users/{uid} に保存する。
// 「リンクを無効にしたい」場合はこの値を作り直せばよい（将来のUI）。
export async function getOrCreateInviteToken(uid: string): Promise<string> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data() as { inviteToken?: unknown }).inviteToken : undefined;
  if (typeof existing === "string" && existing.length >= 16) return existing;
  const token = Crypto.randomUUID().replace(/-/g, "");
  await setDoc(ref, { inviteToken: token }, { merge: true });
  return token;
}

// 招待リンクを作り直す。新しいトークンを保存すると、**今まで配ったリンクは全部その場で死ぬ**
// （#50 のルールが users/{inviter}.inviteToken と照合するため）。
// LINE のグループに貼った・スクショが出回った、というときの唯一の出口。
// 🔴 取り消し不可。呼ぶ側で必ず確認ダイアログを出すこと（SECURITY-1.1 §8-3）。
export async function regenerateInviteToken(uid: string): Promise<string> {
  const token = Crypto.randomUUID().replace(/-/g, "");
  await setDoc(doc(db, "users", uid), { inviteToken: token }, { merge: true });
  return token;
}

function invitePath(uid: string, token: string): string {
  return `add-friend?u=${encodeURIComponent(uid)}&k=${encodeURIComponent(token)}`;
}

// メッセンジャーに貼る https リンク。
// Web 上では自分のオリジン（本番 = WEB_ORIGIN、ローカル確認時は localhost）を使う。
export function buildInviteUrl(uid: string, token: string): string {
  const origin =
    Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : WEB_ORIGIN;
  return `${origin}/${invitePath(uid, token)}`;
}

export type MobileOS = "ios" | "android" | "other";

// Web の受け口（/add-friend）が「アプリで開く」に使う URL。
// - iOS: カスタムスキーム。アプリがあれば起動、無ければ Safari がエラーを出す（1.2 のユニバーサルリンクで解消）
// - Android: Chrome の intent URL。アプリがあれば起動、無ければ fallback（Play 公開後）へ
export function buildAppOpenUrl(uid: string, token: string, os: MobileOS): string {
  const path = invitePath(uid, token);
  if (os === "android") {
    const fallback = PLAY_STORE_PUBLIC ? `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};` : "";
    return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};${fallback}end`;
  }
  return `${APP_SCHEME}://${path}`;
}

// Web の UA からスマホOSを判定（ストアボタンの出し分け用。厳密さは不要）
export function detectMobileOS(): MobileOS {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

export type ShareResult = "shared" | "copied" | "failed";

// 招待リンクを共有する。message は本文（呼び出し側で i18n 済みの文言を渡す）。
// ネイティブは OS の共有シート（LINE 等が出る）、Web は navigator.share → クリップボードの順。
export async function shareInvite(uid: string, message: string): Promise<ShareResult> {
  let url: string;
  try {
    url = buildInviteUrl(uid, await getOrCreateInviteToken(uid));
  } catch (e) {
    console.warn("invite token failed:", e);
    return "failed";
  }
  const full = `${message}\n${url}`;

  if (Platform.OS === "web") {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    try {
      if (nav?.share) {
        await nav.share({ text: full });
        return "shared";
      }
    } catch (e: any) {
      // ユーザーが共有シートを閉じただけ（AbortError）は失敗扱いにしない
      if (e?.name === "AbortError") return "shared";
      // それ以外はクリップボードにフォールバック
    }
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(full);
        return "copied";
      }
    } catch {
      /* noop */
    }
    return "failed";
  }

  try {
    await Share.share({ message: full });
    return "shared";
  } catch {
    return "failed";
  }
}
