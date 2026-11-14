import { useEffect } from "react";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { canUsePush, installForegroundHandler, onPushTap, syncPush } from "../../services/pushService";

// プッシュ通知の受け口（画面には何も描かない）。タブのレイアウトに 1 つだけ置く。
// ① アプリ内で通知を受けたときの表示 ② 通知をタップしたらその投稿・メッセージ画面へ
// ③ 起動時・アカウント／言語が変わったときに端末トークンを登録し直す（変わっていなければ何もしない）
// 写真選択と同じく、通知の部品が無い旧バイナリ・Web では何もしない（canUsePush）。
export default function PushManager() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useI18n();

  useEffect(() => {
    if (!canUsePush) return;
    installForegroundHandler();
    return onPushTap((url) => router.push(url as Href));
  }, [router]);

  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!canUsePush || !uid) return;
    syncPush(uid, language).catch(() => {});
  }, [uid, language]);

  return null;
}
