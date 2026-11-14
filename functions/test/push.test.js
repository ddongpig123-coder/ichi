import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidExpoToken, tokenDocId, snippet, buildCommentPush, buildMessagePush, chunk } from "../push.js";

test("Expo トークンの形だけ通す", () => {
  assert.equal(isValidExpoToken("ExponentPushToken[abcDEF123_-xyz]"), true);
  assert.equal(isValidExpoToken("ExpoPushToken[abcDEF123_-xyz]"), true);
  assert.equal(isValidExpoToken("ExponentPushToken[short]"), false);
  assert.equal(isValidExpoToken("ExponentPushToken[abc def 12345]"), false);
  assert.equal(isValidExpoToken("fcm:abcdefghijklmnop"), false);
  assert.equal(isValidExpoToken(null), false);
});

test("トークン → 文書 ID は固定長・同じトークンなら同じ", () => {
  const a = tokenDocId("ExponentPushToken[abcDEF123_-xyz]");
  assert.equal(a.length, 40);
  assert.equal(a, tokenDocId("ExponentPushToken[abcDEF123_-xyz]"));
  assert.notEqual(a, tokenDocId("ExponentPushToken[abcDEF123_-xyZ]"));
});

test("snippet は改行をつぶして切る", () => {
  assert.equal(snippet("あ\nい  う", 10), "あ い う");
  assert.equal(snippet("1234567890abc", 10), "1234567890…");
  assert.equal(snippet(undefined, 5), "");
});

test("コメント通知: 日本語・韓国語・返信", () => {
  const ja = buildCommentPush({ to: "T", lang: "ja", kind: "post", postTitle: "履修の相談", body: "それなら\\n経営学総論がおすすめ", url: "/post/free/p1" });
  assert.equal(ja.title, "新しいコメント");
  assert.match(ja.body, /^「履修の相談」 /);
  assert.equal(ja.channelId, "comments");
  assert.deepEqual(ja.data, { url: "/post/free/p1", type: "comment" });
  const ko = buildCommentPush({ to: "T", lang: "ko", kind: "reply", postTitle: "x", body: "y", url: "/u" });
  assert.equal(ko.title, "내 댓글에 답글이 달렸어요");
  const other = buildCommentPush({ to: "T", lang: "fr", kind: "post", postTitle: "x", body: "y", url: "/u" });
  assert.equal(other.title, "新しいコメント");
});

test("メッセージ通知には本文を入れない", () => {
  const m = buildMessagePush({ to: "T", lang: "ja", url: "/(tabs)/messages/a_b" });
  assert.equal(m.title, "新しいメッセージ");
  assert.equal(m.channelId, "messages");
  assert.equal(JSON.stringify(m).includes("text"), false);
});

test("chunk", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
