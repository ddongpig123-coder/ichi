import { confirmDialog, notify } from "../../utils/dialog";
import { enablePush, markPushOffered, shouldOfferPush } from "../../services/pushService";
import type { TranslationKey } from "../../i18n/translations";
import type { UserLanguage } from "../../types/user";

// 初めて投稿・コメント・メッセージをしたあとに 1 回だけ「通知しましょうか？」と聞く。
// OS の許可ダイアログはここで「通知を受け取る」を押したときに初めて出る（いきなり出さない）。
// 通知の部品が無いアプリ・Web・もう聞いた・設定画面で触った・OS で許可/拒否済み → 何もしない。

export type OfferKind = "post" | "comment" | "message";

const TITLE: Record<OfferKind, TranslationKey> = {
  post: "push.offerPostTitle",
  comment: "push.offerCommentTitle",
  message: "push.offerMessageTitle",
};

export async function offerPushAfter(
  kind: OfferKind,
  uid: string,
  language: UserLanguage,
  t: (key: TranslationKey) => string
): Promise<void> {
  try {
    if (!(await shouldOfferPush())) return;
  } catch {
    return;
  }
  markPushOffered();
  confirmDialog(
    t(TITLE[kind]),
    t("push.offerBody"),
    () => {
      enablePush(uid, language).then((r) => {
        if (r === "denied") notify(t("push.deniedTitle"), t("push.deniedBody"));
        else if (r === "failed") notify(t("push.failed"));
      });
    },
    { cancel: t("push.offerLater"), ok: t("push.offerOk") },
    { destructive: false }
  );
}
