// 書き込み失敗の理由をユーザー向けの文に直す（1.1 / docs/BOARD-ACCESS.md §3）
//
// 1.1 で学校掲示板の投稿・コメント作成に所属検証（users.schoolDomain の一致）が
// 入った。ルールが弾くと Firestore は permission-denied を返すが、素のメッセージは
// "Missing or insufficient permissions." で、なぜ書けないのかが全く分からない。
// → 所属違いのときだけ案内文に差し替える。
//
// 通常 UI では学校は AuthContext から取るので経路が一致し、ここは通らない
// （所属検証は多層防御）。通るのは次のような場合:
//   - 学校未選択（schoolDomain=null）のまま学校掲示板に書こうとした
//   - 画面を開いたまま別の学校に変更した（AuthContext と画面の学校がずれた）

import type { TranslationKey } from "../i18n/translations";

export function isPermissionDenied(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  if (code === "permission-denied") return true;
  // Web SDK は code を落とす場合があるのでメッセージも見る
  const msg = (e as { message?: string } | null)?.message ?? "";
  return /permission|insufficient/i.test(msg);
}

// 失敗ダイアログの本文。所属違いなら案内文、それ以外は元のメッセージをそのまま。
export function writeErrorBody(e: unknown, t: (key: TranslationKey) => string): string {
  if (isPermissionDenied(e)) return t("school.writeBlocked");
  return (e as { message?: string } | null)?.message ?? String(e);
}

// 通信系の失敗か（オフライン・タイムアウト・サーバー一時停止）
export function isNetworkError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code ?? "";
  if (/unavailable|deadline-exceeded|network-request-failed/.test(code)) return true;
  const msg = (e as { message?: string } | null)?.message ?? "";
  return /offline|network|timeout|failed to fetch/i.test(msg);
}

// 書き込み以外も含めた一般の失敗メッセージ。Firebase の英語の生メッセージは
// 利用者には意味が分からないので出さない（原因はコンソールに残す）。
export function friendlyErrorBody(e: unknown, t: (key: TranslationKey) => string): string {
  console.warn(e);
  if (isNetworkError(e)) return t("common.networkError");
  return t("common.tryAgainLater");
}
