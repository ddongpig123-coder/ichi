import { Platform } from "react-native";
import * as Updates from "expo-updates";

// ============================================================
// ストアに出ている最新版と「新しいバージョンがあります」案内（RELEASE-PLAN §5-3）
//
// 1.1.0 が出ると、1.0.0 のアプリ（runtime 1.0.0）にはその後の OTA が届かなくなる。
// そこで、1.1.0 がストアで公開された日に、ここを "1.1.0" に書き換えて 1.0.0 向けに最後の OTA を出す
// → 1.0.0 の人に「新しいバージョンがあります」を出してストアへ案内する。
//
// 🔴 まだストアに無いバージョンを書かないこと（押しても更新できない案内になる）。プラットフォームごとに別。
// expo-updates は 1.0.0 のアプリにも入っている（OTA が届いている）のでトップレベルで import してよい。
// ============================================================

export const STORE_LATEST: Record<"ios" | "android", string> = {
  ios: "1.0.0",
  android: "1.0.0",
};

/** "1.10.0" > "1.9.2" のように数値で比べる。a<b なら負 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** このアプリ本体（runtime = アプリのバージョン）がストアの最新より古いか。Web・開発中は false */
export function needsStoreUpdate(): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  const runtime = Updates.runtimeVersion; // runtimeVersion の policy が appVersion なので = アプリのバージョン
  if (!runtime) return false;
  return compareVersions(runtime, STORE_LATEST[Platform.OS]) < 0;
}
