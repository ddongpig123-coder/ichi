// プッシュ通知の文面づくりと検証（純粋関数 — テストしやすく分けてある）。
// 方針（2026-11-14 準熙）: 最初は「自分の投稿へのコメント・自分のコメントへの返信」と「メッセージ」だけ。
// お知らせ・広告の通知は送らない。docs/PUSH-NOTIFICATIONS.md
//
// 🔑 メッセージ（쪽지）の通知には本文を入れない。通知の文面は Expo・Apple・Google のサーバーを通り、
//    ロック画面にも出るため。コメントは掲示板で誰でも読める内容なので、一部を入れる。

import { createHash } from "node:crypto";

// Expo のプッシュトークン（getExpoPushTokenAsync が返す形）
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$/;

export function isValidExpoToken(token) {
  return typeof token === "string" && EXPO_TOKEN.test(token);
}

// トークンをそのまま文書 ID にしない（長さ・記号を気にしなくて済むように）
export function tokenDocId(token) {
  return createHash("sha256").update(token).digest("hex").slice(0, 40);
}

export function snippet(text, max) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

const TEXT = {
  ja: {
    commentTitle: "新しいコメント",
    replyTitle: "あなたのコメントに返信がありました",
    messageTitle: "新しいメッセージ",
    messageBody: "メッセージが届きました。タップして確認しましょう",
  },
  ko: {
    commentTitle: "새 댓글",
    replyTitle: "내 댓글에 답글이 달렸어요",
    messageTitle: "새 쪽지",
    messageBody: "쪽지가 도착했어요. 눌러서 확인해 보세요",
  },
};
const L = (lang) => TEXT[lang === "ko" ? "ko" : "ja"];

/**
 * コメント通知。kind: "post"（自分の投稿にコメント）| "reply"（自分のコメントに返信）
 * url はアプリ内の行き先（タップで開く画面）
 */
export function buildCommentPush({ to, lang, kind, postTitle, body, url }) {
  const t = L(lang);
  return {
    to,
    title: kind === "reply" ? t.replyTitle : t.commentTitle,
    body: `「${snippet(postTitle, 24)}」 ${snippet(body, 60)}`,
    data: { url, type: "comment" },
    sound: "default",
    channelId: "comments",
    priority: "high",
  };
}

/** メッセージ通知（本文なし） */
export function buildMessagePush({ to, lang, url }) {
  const t = L(lang);
  return {
    to,
    title: t.messageTitle,
    body: t.messageBody,
    data: { url, type: "message" },
    sound: "default",
    channelId: "messages",
    priority: "high",
  };
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
