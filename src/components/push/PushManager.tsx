import { useEffect } from "react";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import {
  canAskPushNow,
  canUsePush,
  installForegroundHandler,
  markPushSetupAsked,
  onPushTap,
  syncPush,
  wasPushSetupAsked,
} from "../../services/pushService";
import { setTutorialStage, useTutorialStage } from "../../services/tutorialStore";

// プッシュ通知の受け口（画面には何も描かない）。タブのレイアウトに 1 つだけ置く。
// ① アプリ内で通知を受けたときの表示 ② 通知をタップしたらその投稿・メッセージ画面へ
// ③ 起動時・アカウント／言語が変わったときに端末トークンを登録し直す（変わっていなければ何もしない）
// ④ 既存ユーザー（はじめの設定を通らない人）に、アップデート後 1 回だけ「通知をオンにしよう」を出す
// 写真選択と同じく、通知の部品が無い旧バイナリ・Web では何もしない（canUsePush）。
export default function PushManager() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useI18n();
  const stage = useTutorialStage();

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

  // ④ 既存ユーザーへの 1 回だけの案内。はじめの設定・使い方ツアーの途中（stage が done 以外）は出さない。
  // 新規ユーザーは はじめの設定 ④ で聞く（そこで「聞いた」印が付くので、ここでは二度聞かない）
  useEffect(() => {
    if (!canUsePush || !uid || stage !== "done") return;
    let alive = true;
    (async () => {
      if (await wasPushSetupAsked()) return;
      const askable = await canAskPushNow();
      markPushSetupAsked(); // OS で許可・拒否が決まっている人にも、この案内はもう出さない
      if (alive && askable) setTutorialStage("pushOnly");
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, stage]);

  return null;
}
