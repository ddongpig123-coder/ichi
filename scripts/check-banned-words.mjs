// 禁止語フィルタの回帰チェック（MODERATION.md §5・§7）
//
//   node check-banned-words.mjs
//
// なぜ要るか:
//   2026-11-02 から検知＝**投稿できない**（ブロック）。つまり誤検知はそのまま
//   「正当な投稿が止まる」になる。語を足すたびに、普通の文が巻き込まれていないかを
//   見ないといけない。実際に初版では「課題が多いしね」のような**ごく普通の日本語**が
//   全部弾かれていた（「〜だしね」の「しね」に当たっていた）。
//
//   ⚠️ 語を足したら必ずここに例を足すこと。ストア提出前にも1回。
//
// 仕組み:
//   src/utils/contentFilter.ts を一時フォルダに tsc でコンパイルして読み込む。
//   アプリと同じ実装をそのまま試すので、コピーを持たなくて済む。

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── 必ずブロックされるべき入力 ───────────────────────────
const MUST_BLOCK = [
  "死ね",
  "しね",
  "し ね", // 空白による回避
  "しねしね",
  "お前しね",
  "殺すぞ",
  "レイプ",
  "デブ",
  "お前デブだろ",
  "クズが",
  "ブス",
  "씨발",
  "시발 진짜",
  "병신같은",
  "개새끼",
  "자살해",
  "fuck you",
  "You are a SHIT",
  "what a bitch",
  "kill yourself",
  "Kill  Yourself please",
  "援助交際",
  "パパ活",
];

// ── 必ず通るべき入力（誤検知の回帰テスト） ───────────────
const MUST_PASS = [
  // 「〜だしね」「〜ないしね」は接続表現。侮辱ではない
  "この授業、課題が多いしねー",
  "単位も取りやすいしね",
  "バイト忙しいしね、時間ない",
  "まだ決めてないしね",
  "そんなに高くないしねぇ",
  "テストもあるしね",
  "和泉キャンパスは遠いしね",
  // カタカナ2文字が別の語に埋もれている
  "デブリ（宇宙ごみ）の研究室",
  "クズ鉄のリサイクルについて",
  "ブスッと刺さった",
  // 空白を潰すと別の単語がつながって禁止語になってしまう例
  "This hit me hard",
  "I will push it tomorrow",
  "Class hitting hard",
  "shiitake mushrooms",
  // 始發（시발점・시발역）
  "시발점에서 출발하는 버스",
  "시발역이 어디예요?",
  "이번 학기 시발점은 4월입니다",
  // リストから意図的に外した語（日常語と重なるため）
  "バカみたいに暑い",
  "아 진짜 죽어도 못 하겠다",
  "気持ち悪いくらい暑い",
  // ごく普通の投稿
  "サークルの新歓はいつですか？",
  "履修登録のコツ教えてください",
  "학식 뭐가 제일 맛있나요?",
];

const out = mkdtempSync(join(tmpdir(), "ichi-bw-"));
try {
  // npx ではなく tsc 本体を node で直接呼ぶ（Windows の npx.cmd は shell 無しだと起動できない）
  execFileSync(
    process.execPath,
    [join(ROOT, "node_modules", "typescript", "bin", "tsc"),
     join("src", "utils", "contentFilter.ts"), "--ignoreConfig",
     "--target", "es2022", "--module", "esnext", "--outDir", out],
    { cwd: ROOT, stdio: "pipe" }
  );

  const stripModule = (file) =>
    readFileSync(join(out, file), "utf8")
      .replace(/^import .*$/gm, "")
      .replace(/^export /gm, "");

  const data = stripModule(join("data", "bannedWords.js"));
  const { BANNED_WORDS, BANNED_WORD_GUARDS } = new Function(
    data + "; return { BANNED_WORDS, BANNED_WORD_GUARDS };"
  )();
  const filter = stripModule(join("utils", "contentFilter.js"));
  const { findBannedWords } = new Function(
    "BANNED_WORDS", "BANNED_WORD_GUARDS",
    filter + "; return { findBannedWords };"
  )(BANNED_WORDS, BANNED_WORD_GUARDS);

  console.log(`禁止語 ${BANNED_WORDS.length}件 / 誤検知よけ ${Object.keys(BANNED_WORD_GUARDS).length}件`);

  let missed = 0;
  for (const text of MUST_BLOCK) {
    if (findBannedWords(text).length === 0) {
      missed++;
      console.log(`  通ってしまう  ${text}`);
    }
  }

  let wrong = 0;
  for (const text of MUST_PASS) {
    const hits = findBannedWords(text);
    if (hits.length) {
      wrong++;
      console.log(`  誤検知「${hits.join(", ")}」  ${text}`);
    }
  }

  console.log(
    `\nブロック漏れ ${missed}/${MUST_BLOCK.length} · 誤検知 ${wrong}/${MUST_PASS.length}`
  );
  if (missed || wrong) process.exit(1);
  console.log("OK");
} finally {
  rmSync(out, { recursive: true, force: true });
}
