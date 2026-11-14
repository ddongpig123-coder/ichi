import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";
import { TRANSLATIONS } from "../i18n/translations";

// ============================================================
// プッシュ通知（RELEASE-PLAN N2 / docs/PUSH-NOTIFICATIONS.md）
// 送るのは「自分の投稿へのコメント・自分のコメントへの返信」と「メッセージ」だけ。
// お知らせ・広告の通知は送らない（2026-11-14 準熙）。送信はサーバー（functions/index.js）。
//
// 端末トークンの登録・解除は Cloud Function（registerPushToken / unregisterPushToken）経由。
// Firestore に直接書かない（firestore.rules の変更が要らない・他人のトークンを触れない）。
//
// 🔴 旧バイナリ（ストア版 1.0.0）を落とさないこと — expo-notifications は新しいネイティブ部品。
//   トップレベルで import せず、部品があるときだけ関数の中で require する（AGENTS.md 作業手順）。
//   部品の無いアプリ・Web では canUsePush = false → 設定行も案内も出さない。
// ============================================================

type NotificationsModule = typeof import("expo-notifications");
export type PushLang = "ja" | "ko";

export const canUsePush: boolean =
  Platform.OS !== "web" && requireOptionalNativeModule("ExpoPushTokenManager") != null;

function loadN(): NotificationsModule | null {
  if (!canUsePush) return null;
  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

export interface PushPrefs {
  comments: boolean;
  messages: boolean;
}

// 既定は両方オン（2026-11-14 準熙「基本はオン、オフにもできる」）。
// iPhone は OS の許可なしに通知を出せないので、許可をもらった時点でこの値で登録する
export const DEFAULT_PUSH_PREFS: PushPrefs = { comments: true, messages: true };

// 端末ローカル（AsyncStorage）
const PREFS_KEY = "ichi:pushPrefs"; // この端末で受け取る種類。未設定 = まだ一度もオンにしていない
const REG_KEY = "ichi:pushReg"; // 最後にサーバーへ登録した内容（同じなら登録し直さない）
const OFFERED_KEY = "ichi:pushOffered"; // 「通知しましょうか？」の案内を出したか（1 回だけ）
const SETUP_ASKED_KEY = "ichi:pushSetupAsked"; // はじめの設定 ④ / アップデート後の「通知をオンにしよう」を出したか

interface Registration extends PushPrefs {
  uid: string;
  token: string;
  lang: PushLang;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});
}

export function loadPushPrefs(): Promise<PushPrefs | null> {
  return readJson<PushPrefs>(PREFS_KEY);
}

export type PermissionState = "granted" | "denied" | "undetermined" | "unavailable";

export async function getPushPermission(): Promise<PermissionState> {
  const N = loadN();
  if (!N) return "unavailable";
  try {
    const p = await N.getPermissionsAsync();
    return p.status === "granted" ? "granted" : p.status === "denied" ? "denied" : "undetermined";
  } catch {
    return "unavailable";
  }
}

const fns = () => getFunctions(app, "asia-northeast1");

// Android 8+ は通知チャンネルが要る（端末の設定で種類ごとにオン・オフできる）。
// Android 13+ は、チャンネルを作ってからでないと許可ダイアログが出ない
async function ensureChannels(N: NotificationsModule, lang: PushLang) {
  if (Platform.OS !== "android") return;
  const L = TRANSLATIONS[lang];
  await N.setNotificationChannelAsync("comments", {
    name: L["push.channelComments"],
    importance: N.AndroidImportance.HIGH,
  });
  await N.setNotificationChannelAsync("messages", {
    name: L["push.channelMessages"],
    importance: N.AndroidImportance.HIGH,
  });
}

async function getToken(N: NotificationsModule): Promise<string> {
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const { data } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data;
}

async function register(N: NotificationsModule, uid: string, lang: PushLang, prefs: PushPrefs): Promise<boolean> {
  try {
    const token = await getToken(N);
    if (!prefs.comments && !prefs.messages) {
      await httpsCallable(fns(), "unregisterPushToken")({ token });
      AsyncStorage.removeItem(REG_KEY).catch(() => {});
      return true;
    }
    await httpsCallable(fns(), "registerPushToken")({ token, platform: Platform.OS, lang, ...prefs });
    writeJson(REG_KEY, { uid, token, lang, ...prefs } satisfies Registration);
    return true;
  } catch (e) {
    // Android で google-services.json が無いビルド・シミュレーター・通信エラーなど
    console.warn("push register failed:", e);
    return false;
  }
}

export type EnableResult = "enabled" | "denied" | "unavailable" | "failed";

/**
 * 通知の種類を設定する。どれかがオンなら（必要なら OS の許可を求めて）サーバーに登録、
 * 全部オフならサーバーから外す。
 */
export async function setPushPrefs(uid: string, lang: PushLang, prefs: PushPrefs): Promise<EnableResult> {
  const N = loadN();
  if (!N) return "unavailable";
  writeJson(PREFS_KEY, prefs);
  if (!prefs.comments && !prefs.messages) {
    return (await register(N, uid, lang, prefs)) ? "enabled" : "failed";
  }
  try {
    await ensureChannels(N, lang);
    let { status } = await N.getPermissionsAsync();
    if (status !== "granted") status = (await N.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";
  } catch (e) {
    console.warn("push permission failed:", e);
    return "failed";
  }
  return (await register(N, uid, lang, prefs)) ? "enabled" : "failed";
}

/** 両方オンで有効にする（案内の「通知を受け取る」） */
export function enablePush(uid: string, lang: PushLang): Promise<EnableResult> {
  return setPushPrefs(uid, lang, { comments: true, messages: true });
}

/**
 * 起動時・ログイン相手や言語が変わったときに呼ぶ。トークンは変わることがあるので、
 * 前回の登録内容と違うときだけ登録し直す（同じなら何も送らない）
 */
export async function syncPush(uid: string, lang: PushLang): Promise<void> {
  const N = loadN();
  if (!N) return;
  if ((await getPushPermission()) !== "granted") return;
  // まだ設定画面を触っていない = 既定（両方オン）。Android 12 以下は許可ダイアログなしで granted になる
  const prefs = (await loadPushPrefs()) ?? DEFAULT_PUSH_PREFS;
  if (!prefs.comments && !prefs.messages) return;
  try {
    await ensureChannels(N, lang);
    const token = await getToken(N);
    const reg = await readJson<Registration>(REG_KEY);
    if (
      reg &&
      reg.uid === uid &&
      reg.token === token &&
      reg.lang === lang &&
      reg.comments === prefs.comments &&
      reg.messages === prefs.messages
    ) {
      return;
    }
    await register(N, uid, lang, prefs);
  } catch (e) {
    console.warn("push sync failed:", e);
  }
}

/** ログアウトの直前に呼ぶ（まだ前のアカウントでログインしている間に）。この端末への通知を止める */
export async function unregisterPush(): Promise<void> {
  if (!canUsePush) return;
  const reg = await readJson<Registration>(REG_KEY);
  if (!reg?.token) return;
  try {
    await httpsCallable(fns(), "unregisterPushToken")({ token: reg.token });
  } catch (e) {
    console.warn("push unregister failed:", e);
  }
  AsyncStorage.removeItem(REG_KEY).catch(() => {});
}

// ── 「通知しましょうか？」の案内（初めて投稿・コメント・メッセージをしたあとに 1 回だけ）
// OS の許可ダイアログはいきなり出さず、何の通知かを先に説明してから出す（断られにくく、審査上も丁寧）

export async function shouldOfferPush(): Promise<boolean> {
  if (!canUsePush) return false;
  if (await AsyncStorage.getItem(OFFERED_KEY).catch(() => "1")) return false;
  if (await loadPushPrefs()) return false; // 設定画面で一度でも触った
  return (await getPushPermission()) === "undetermined";
}

export function markPushOffered() {
  AsyncStorage.setItem(OFFERED_KEY, "1").catch(() => {});
}

// はじめの設定 ④（新規）・アップデート後 1 回（既存）の「通知をオンにしよう」用
/** OS の許可がまだ決まっていない（＝聞ける）か */
export async function canAskPushNow(): Promise<boolean> {
  return canUsePush && (await getPushPermission()) === "undetermined";
}
export async function wasPushSetupAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SETUP_ASKED_KEY)) === "1";
  } catch {
    return true; // 読めないときは出さない
  }
}
export function markPushSetupAsked() {
  AsyncStorage.setItem(SETUP_ASKED_KEY, "1").catch(() => {});
}

// ── 通知の表示とタップ

let activeUrl: string | null = null;

/** いま開いている画面の URL（メッセージ画面）。同じ部屋の通知はアプリ内では出さない */
export function setActivePushUrl(url: string | null) {
  activeUrl = url;
}

let handlerInstalled = false;
export function installForegroundHandler() {
  const N = loadN();
  if (!N || handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async (n) => {
      const url = (n.request.content.data as { url?: unknown } | undefined)?.url;
      const show = !(activeUrl && url === activeUrl);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
}

function urlOf(r: { notification: { request: { content: { data?: unknown } } } } | null): string | null {
  const url = (r?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  // アプリ内の画面だけ（外部 URL は開かない）
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

// 同じタップを 2 回開かない（起動直後は「最後のタップ」と「タップの知らせ」の両方で届くことがある）
const handledTaps = new Set<string>();

/** 通知をタップしたら呼ばれる。アプリが閉じていたときの 1 件も起動後に渡す。戻り値で購読解除 */
export function onPushTap(cb: (url: string) => void): () => void {
  const N = loadN();
  if (!N) return () => {};
  const handle = (r: Parameters<Parameters<NotificationsModule["addNotificationResponseReceivedListener"]>[0]>[0] | null) => {
    const url = urlOf(r);
    const id = r ? `${r.notification.request.identifier}:${r.actionIdentifier}` : "";
    if (!url || handledTaps.has(id)) return;
    handledTaps.add(id);
    cb(url);
  };
  N.getLastNotificationResponseAsync()
    .then((r) => {
      handle(r);
      if (r) N.clearLastNotificationResponseAsync().catch(() => {});
    })
    .catch(() => {});
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
