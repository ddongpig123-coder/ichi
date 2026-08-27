import { Platform, Share } from "react-native";
import * as Linking from "expo-linking";

// 友達招待リンク。
// リンクは自分の uid を載せ、開いた相手が /add-friend 画面から申請を送れる。
// - ネイティブ: uni-community://add-friend?u=<uid>（アプリが入っていれば開く）
// - Web: <origin>/add-friend?u=<uid>
// ※ LINE等から「リンクを開いてアプリ起動」を完全対応するにはユニバーサル/アプリリンク
//   + 配布（EAS・ホスティング）が必要。ここはその土台となるアプリ内リンク生成・受け口。
export function buildInviteUrl(uid: string): string {
  return Linking.createURL("/add-friend", { queryParams: { u: uid } });
}

export type ShareResult = "shared" | "copied" | "failed";

// 招待リンクを共有する。message は本文（呼び出し側で i18n 済みの文言を渡す）。
// ネイティブは OS の共有シート（LINE 等が出る）、Web は navigator.share → クリップボードの順。
export async function shareInvite(uid: string, message: string): Promise<ShareResult> {
  const url = buildInviteUrl(uid);
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
