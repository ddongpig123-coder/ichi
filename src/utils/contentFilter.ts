import { BANNED_WORDS, BANNED_WORD_GUARDS } from "../data/bannedWords";

// ============================================================
// 投稿前の禁止語チェック（MODERATION.md §5・§7 / Phase 1）
// クライアント判定のみ。サーバー強制ではないので「抑止」であって「防止」ではない。
// 悪意ある利用者は回避できるが、それは通報→運営対応（24時間体制）の担当範囲。
//
// 2026-11-02 から検知＝**投稿できない**（BannedWordWarning に「このまま投稿する」は無い）。
// つまり誤検知はそのまま「正当な投稿が止まる」になるので、当てかたを語の種類で分ける。
// ============================================================

// 日本語・韓国語用。「し ね」「Ｓ Ｎ Ｓ」のような空白・全角による回避を吸収する。
function normalizeCjk(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

// ラテン文字の語用。**空白を残す**。
// 空白を潰すと別々の単語がつながって禁止語ができてしまい、普通の文が止まる。
// 2026-11-02 実測: "This hit me hard" / "I will push it" / "Class hitting hard"
// がいずれも shit として弾かれていた。
function normalizeLatin(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

// ラテン文字だけでできた語か（空白を含む "kill yourself" も該当）。
function isLatinWord(word: string): boolean {
  return /^[a-z0-9' ]+$/.test(word.toLowerCase());
}

// ラテン文字の語は単語境界で見る。shit は "shit" には当たり "this hit" には当たらない。
// 語は英数字・空白・アポストロフィだけなので（isLatinWord）、正規表現の特殊文字は含まない。
function matchesLatin(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, "u").test(haystack);
}

// 日本語・韓国語の語。誤検知よけ（BANNED_WORD_GUARDS）がある語は、
// 「侮辱ではない出現」を先に無効化してから探す。だから同じ文に本物が混じっていれば
// なお検知する（「しねしね」は検知、「課題が多いしね」は検知しない）。
function matchesCjk(haystack: string, word: string): boolean {
  const guard = BANNED_WORD_GUARDS[word];
  const target = guard ? haystack.replace(guard.pattern, guard.keep) : haystack;
  return target.includes(word);
}

// 検出された禁止語を返す（空配列 = 問題なし）。
// 警告UIで「どの語が引っかかったか」を出せるよう、真偽値ではなく語を返す。
export function findBannedWords(...texts: (string | null | undefined)[]): string[] {
  const joined = texts.filter(Boolean).join(" ");
  if (!joined.trim()) return [];
  const cjk = normalizeCjk(joined);
  const latin = normalizeLatin(joined);

  const hits = BANNED_WORDS.filter((word) =>
    isLatinWord(word)
      ? matchesLatin(latin, word.toLowerCase())
      : matchesCjk(cjk, normalizeCjk(word))
  );
  // 「死ね」「しね」のように正規化後に同じ語へ潰れる項目があるため重複を除く
  return [...new Set(hits)];
}

export function containsBannedWord(...texts: (string | null | undefined)[]): boolean {
  return findBannedWords(...texts).length > 0;
}
