// ダイアログの共通窓口。
// Alert.alert は react-native-web では何も表示されない(no-op)ため、Web では
// window.alert / window.confirm にフォールバックする。画面ごとに同じ関数を
// 複製していたのをここに集約した（新しい画面はこれを使うこと）。
import { Alert, Platform } from "react-native";

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// 確認ダイアログ。OK を押したときだけ onConfirm が呼ばれる。
// destructive: 削除・破棄など取り返しのつかない操作（iOS で赤字になる）
export function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  labels: { cancel: string; ok: string },
  options: { destructive?: boolean } = { destructive: true }
) {
  if (Platform.OS === "web") {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: labels.cancel, style: "cancel" },
      { text: labels.ok, style: options.destructive ? "destructive" : "default", onPress: onConfirm },
    ]);
  }
}
