import { useCallback, useEffect, useState } from "react";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useI18n } from "../contexts/I18nContext";
import { confirmDialog } from "../utils/dialog";

// 書きかけの入力があるまま戻ろうとしたら「破棄しますか？」と確認する。
// 戻る操作（ヘッダーの戻る・Android の戻るボタン・iOS のスワイプ）をすべて捕まえる。
//
// 投稿に成功して自分から戻るときは確認を出したくないので、戻る処理は
// 返り値の leave(() => router.back()) 経由で呼ぶこと（確認を外してから実行する）。
export function useConfirmDiscard(dirty: boolean) {
  const navigation = useNavigation();
  const { t } = useI18n();
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  usePreventRemove(dirty && !pendingLeave, ({ data }) => {
    confirmDialog(
      t("post.discardTitle"),
      t("post.discardMessage"),
      () => navigation.dispatch(data.action),
      { cancel: t("common.cancel"), ok: t("common.discard") }
    );
  });

  // 確認を外した状態で再描画されてから実行する（同じ描画内で戻ると確認が出てしまう）
  useEffect(() => {
    if (pendingLeave) pendingLeave();
  }, [pendingLeave]);

  return useCallback((fn: () => void) => setPendingLeave(() => fn), []);
}
