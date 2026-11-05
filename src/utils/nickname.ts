// ニックネームの表示。ゲストは作成時にサーバへ「ゲスト」（日本語）で保存されるため、
// 表示時に今の言語の「ゲスト / 게스트」に置き換える（韓国語モードで日本語が出ないように）。
const STORED_GUEST_NAMES = new Set(["", "ゲスト", "게스트"]);

export function displayNickname(nickname: string | null | undefined, guestLabel: string): string {
  const n = (nickname ?? "").trim();
  return STORED_GUEST_NAMES.has(n) ? guestLabel : n;
}

// ゲストのままの名前か（ニックネーム未設定の判定）
export function isGuestNickname(nickname: string | null | undefined): boolean {
  return STORED_GUEST_NAMES.has((nickname ?? "").trim());
}
