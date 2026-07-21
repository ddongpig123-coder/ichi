import { BANNED_WORDS } from "../data/bannedWords";

// ============================================================
// 投稿前の禁止語チェック（MODERATION.md §5 / Phase 1）
// クライアント判定のみ。サーバー強制ではないので「抑止」であって「防止」ではない。
// 悪意ある利用者は回避できるが、それは通報→運営対応（24時間体制）の担当範囲。
// ============================================================

// 「し ね」「Ｓ Ｎ Ｓ」のような空白・全角による簡単な回避を吸収する。
// scripts/ の n-gram 正規化と同じ考え方だが、用途が別なので共有はしない。
function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

// 検出された禁止語を返す（空配列 = 問題なし）。
// 警告UIで「どの語が引っかかったか」を出せるよう、真偽値ではなく語を返す。
export function findBannedWords(...texts: (string | null | undefined)[]): string[] {
  const haystack = normalize(texts.filter(Boolean).join(" "));
  if (!haystack) return [];
  const hits = BANNED_WORDS.filter((word) => haystack.includes(normalize(word)));
  // 「死ね」「しね」のように正規化後に同じ語へ潰れる項目があるため重複を除く
  return [...new Set(hits)];
}

export function containsBannedWord(...texts: (string | null | undefined)[]): boolean {
  return findBannedWords(...texts).length > 0;
}
