// Cloud Functions（2026-11-14〜）。デプロイは準熙のみ（AGENTS.md 정지선）: `npm run deploy:functions`
// 前提: Firebase を Blaze（従量制）にしてあること・ANTHROPIC_API_KEY を Secret に登録してあること
//   npx firebase-tools functions:secrets:set ANTHROPIC_API_KEY
// 詳しくは docs/TIMETABLE-OCR.md §5（運用）・docs/RELEASE-PLAN-2026-12.md N1。
// プッシュ通知（N2）は docs/PUSH-NOTIFICATIONS.md。

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_PERIODS, buildPrompt, extractJson, sanitizePeriods, sanitizeResult } from "./timetablePrompt.js";
import { isValidExpoToken, tokenDocId, buildCommentPush, buildMessagePush, chunk } from "./push.js";

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// docs/TIMETABLE-OCR.md §3-1: 精度テストで 22/22。1 枚あたり約 $0.014
const MODEL = "claude-sonnet-5-5";
// 1 日（日本時間）に全体で読み取れる枚数の上限。匿名アカウントを量産されても費用がここで止まる
// （App Check を入れるまでの保険。1 枚 $0.014 × 300 ≈ $4/日）
const DAILY_CAP = 300;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Anthropic の画像上限
const MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SEMESTER_KEY = /^\d{4}-(春|秋)$/;

function jstDay(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 時間割スクショ → 授業の一覧。アプリの「はじめの設定 ②」とホームから呼ぶ。
// 入力: { imageBase64, mediaType, semesterKey: "2026-秋", periods?: [{period,start,end}] }
// 出力: { sessions: [{day,period,name,teacher,room,confidence}], unplaced: [{name,reason}], notTimetable }
// 🔑 画像も読み取り結果も保存しない（使用記録だけ ocrUsage に残す）。ocrUsage / ocrDaily は
//    firestore.rules に match が無い = クライアントからは読み書きできない（Admin SDK のみ）
export const readTimetable = onCall(
  {
    region: "asia-northeast1",
    secrets: [ANTHROPIC_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 5,
    enforceAppCheck: false, // App Check（RELEASE-PLAN N7）を入れたら true に
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "login-required");

    const d = request.data ?? {};
    const semesterKey = typeof d.semesterKey === "string" ? d.semesterKey : "";
    const mediaType = typeof d.mediaType === "string" ? d.mediaType : "";
    const imageBase64 = typeof d.imageBase64 === "string" ? d.imageBase64 : "";
    if (!SEMESTER_KEY.test(semesterKey)) throw new HttpsError("invalid-argument", "bad-semester");
    if (!MEDIA_TYPES.has(mediaType)) throw new HttpsError("invalid-argument", "bad-media-type");
    const bytes = Math.floor((imageBase64.length * 3) / 4);
    if (!imageBase64 || bytes > MAX_IMAGE_BYTES) throw new HttpsError("invalid-argument", "bad-image-size");
    const periods = sanitizePeriods(d.periods) ?? DEFAULT_PERIODS;

    // ── 使用枠を先に押さえる（同時に2回押されても1回分しか使わない）
    const usageRef = db.doc(`ocrUsage/${uid}__${semesterKey}`);
    const dailyRef = db.doc(`ocrDaily/${jstDay()}`);
    await db.runTransaction(async (tx) => {
      const [usage, daily] = await Promise.all([tx.get(usageRef), tx.get(dailyRef)]);
      if (usage.exists) {
        const u = usage.data();
        const startedMs = u.startedAt?.toMillis?.() ?? 0;
        if (u.status === "done") throw new HttpsError("resource-exhausted", "already-used");
        if (u.status === "pending" && Date.now() - startedMs < 2 * 60 * 1000) {
          throw new HttpsError("aborted", "in-progress");
        }
      }
      if ((daily.data()?.count ?? 0) >= DAILY_CAP) throw new HttpsError("resource-exhausted", "daily-cap");
      tx.set(usageRef, { uid, semesterKey, status: "pending", startedAt: FieldValue.serverTimestamp() });
      tx.set(dailyRef, { count: FieldValue.increment(1) }, { merge: true });
    });

    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value(), maxRetries: 1 });
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        // 表の読み取りに「考える」工程は要らない。思考トークンも出力課金なので最低に（テストと同じ設定）
        output_config: { effort: "low" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: buildPrompt(periods) },
          ],
        }],
      });
      if (res.stop_reason === "refusal") throw new Error("refusal");
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const result = sanitizeResult(extractJson(text), periods);
      // 時間割でない画像・授業が1つも読めなかった画像は回数に数えない（status が "done" のときだけ already-used）
      const empty = result.sessions.length === 0 && result.unplaced.length === 0;
      await usageRef.set({
        status: result.notTimetable ? "not-timetable" : empty ? "empty" : "done",
        finishedAt: FieldValue.serverTimestamp(),
        model: MODEL,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        sessions: result.sessions.length,
      }, { merge: true });
      return result;
    } catch (e) {
      // 失敗したら枠を返す（もう一度試せるように）。時間割でない画像・空の結果も枠を消費しない（上の not-timetable / empty）
      await usageRef.delete().catch(() => {});
      if (e instanceof HttpsError) throw e;
      logger.warn("readTimetable failed", { uid, reason: String(e?.message ?? e).slice(0, 200) });
      throw new HttpsError("unavailable", "read-failed");
    }
  }
);

// ════════════════════════════════════════════════════════════
// プッシュ通知（RELEASE-PLAN N2 / docs/PUSH-NOTIFICATIONS.md）
// 送るのは 2 種類だけ: ① 自分の投稿へのコメント・自分のコメントへの返信 ② メッセージ。
// お知らせ・広告の通知は送らない（2026-11-14 準熙）。
//
// 端末トークンは pushTokens/{sha256(token)} = { uid, token, platform, lang, comments, messages, updatedAt }。
// firestore.rules に match が無い = アプリからは直接読み書きできない。登録・解除はこのファイルの
// callable（registerPushToken / unregisterPushToken）経由だけ（規則の変更が要らない）。
// ════════════════════════════════════════════════════════════

const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send";
const MAX_TOKENS_PER_USER = 10; // 1 人の端末数の上限（古いものから消す）
const MESSAGE_THROTTLE_MS = 60 * 1000; // 同じ쪽지방の通知は 1 分に 1 回まで（会話中に連打しない）

export const registerPushToken = onCall(
  { region: "asia-northeast1", maxInstances: 10, enforceAppCheck: false },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "login-required");
    const d = request.data ?? {};
    if (!isValidExpoToken(d.token)) throw new HttpsError("invalid-argument", "bad-token");
    const platform = d.platform === "ios" || d.platform === "android" ? d.platform : null;
    if (!platform) throw new HttpsError("invalid-argument", "bad-platform");
    // 同じ端末で別アカウントに入り直したら、前の持ち主の登録は上書きされる（文書 ID がトークン由来）
    await db.doc(`pushTokens/${tokenDocId(d.token)}`).set({
      uid,
      token: d.token,
      platform,
      lang: d.lang === "ko" ? "ko" : "ja",
      comments: d.comments !== false,
      messages: d.messages !== false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const mine = await db.collection("pushTokens").where("uid", "==", uid).get();
    if (mine.size > MAX_TOKENS_PER_USER) {
      const old = mine.docs
        .sort((a, b) => (a.data().updatedAt?.toMillis?.() ?? 0) - (b.data().updatedAt?.toMillis?.() ?? 0))
        .slice(0, mine.size - MAX_TOKENS_PER_USER);
      await Promise.all(old.map((x) => x.ref.delete()));
    }
    return { ok: true };
  }
);

export const unregisterPushToken = onCall(
  { region: "asia-northeast1", maxInstances: 10, enforceAppCheck: false },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "login-required");
    const token = request.data?.token;
    if (!isValidExpoToken(token)) throw new HttpsError("invalid-argument", "bad-token");
    const ref = db.doc(`pushTokens/${tokenDocId(token)}`);
    const snap = await ref.get();
    // 他人の登録は消さない（トークンを知っていても）
    if (snap.exists && snap.data().uid === uid) await ref.delete();
    return { ok: true };
  }
);

// その人の端末のうち、kind（"comments" | "messages"）を受け取る設定のものだけ
async function tokensFor(uid, kind) {
  const snap = await db.collection("pushTokens").where("uid", "==", uid).get();
  return snap.docs.filter((d) => d.data()[kind] !== false).map((d) => ({ ref: d.ref, ...d.data() }));
}

// 受け取る人が送り主をブロックしていたら送らない
async function isBlocked(targetUid, fromUid) {
  if (!fromUid) return false;
  return (await db.doc(`users/${targetUid}/blocks/${fromUid}`).get()).exists;
}

// Expo のプッシュサービスへ送る。「もう存在しない端末」と返ってきたトークンは消す
async function sendExpo(messages, tokenRefs) {
  for (const part of chunk(messages, 100)) {
    let tickets = [];
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(part),
      });
      tickets = (await res.json())?.data ?? [];
      if (!res.ok) logger.warn("expo push http error", { status: res.status });
    } catch (e) {
      logger.warn("expo push failed", { reason: String(e?.message ?? e).slice(0, 200) });
      continue;
    }
    await Promise.all(
      tickets.map((t, i) => {
        if (t?.status === "error" && t?.details?.error === "DeviceNotRegistered") {
          return tokenRefs.get(part[i]?.to)?.delete().catch(() => {});
        }
        if (t?.status === "error") logger.warn("expo push ticket error", { error: t?.details?.error ?? t?.message });
        return null;
      })
    );
  }
}

// コメント 1 件 → 投稿者（自分の投稿にコメント）と返信先（自分のコメントに返信）へ
async function notifyComment({ postRef, comment, url }) {
  const post = (await postRef.get()).data();
  if (!post || post.deleted) return;
  const from = comment.authorUid;
  const targets = new Map(); // uid → "post" | "reply"
  if (post.authorUid && post.authorUid !== from) targets.set(post.authorUid, "post");
  let replyTo = comment.mentionUid ?? null;
  if (!replyTo && comment.parentId) {
    replyTo = (await postRef.collection("comments").doc(comment.parentId).get()).data()?.authorUid ?? null;
  }
  if (replyTo && replyTo !== from && !targets.has(replyTo)) targets.set(replyTo, "reply");

  const messages = [];
  const tokenRefs = new Map();
  for (const [uid, kind] of targets) {
    if (await isBlocked(uid, from)) continue;
    for (const tk of await tokensFor(uid, "comments")) {
      messages.push(buildCommentPush({ to: tk.token, lang: tk.lang, kind, postTitle: post.title, body: comment.body, url }));
      tokenRefs.set(tk.token, tk.ref);
    }
  }
  if (messages.length) await sendExpo(messages, tokenRefs);
}

// 学校の掲示板のコメント。region を書かない = Firestore のデータベースと同じ地域に自動で置かれる
// （firebase-tools が DB の場所を調べて合わせる。Firestore トリガーは DB と同じ地域でないと作れない）
export const pushOnBoardComment = onDocumentCreated(
  "schools/{sd}/boards/{boardId}/posts/{postId}/comments/{commentId}",
  async (event) => {
    const c = event.data?.data();
    if (!c || c.deleted) return;
    const { sd, boardId, postId } = event.params;
    await notifyComment({
      postRef: db.doc(`schools/${sd}/boards/${boardId}/posts/${postId}`),
      comment: c,
      url: `/post/${boardId}/${postId}`,
    });
  }
);

// みんなの森・留学生の森のコメント
export const pushOnLoungeComment = onDocumentCreated(
  "lounges/{loungeId}/posts/{postId}/comments/{commentId}",
  async (event) => {
    const c = event.data?.data();
    if (!c || c.deleted) return;
    const { loungeId, postId } = event.params;
    await notifyComment({
      postRef: db.doc(`lounges/${loungeId}/posts/${postId}`),
      comment: c,
      url: `/lounge/${loungeId}/${postId}`,
    });
  }
);

// メッセージ（쪽지）。本文は通知に入れない（push.js 冒頭）
export const pushOnChatMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const m = event.data?.data();
  if (!m) return;
  const { chatId } = event.params;
  const chat = (await db.doc(`chats/${chatId}`).get()).data();
  const participants = Array.isArray(chat?.participants) ? chat.participants : [];
  const from = m.senderUid;
  if (!participants.includes(from)) return;
  const messages = [];
  const tokenRefs = new Map();
  for (const uid of participants) {
    if (uid === from) continue;
    if (await isBlocked(uid, from)) continue;
    // 会話中に 1 通ごとに鳴らさない（同じ部屋は 1 分に 1 回）
    const throttleRef = db.doc(`pushThrottle/${uid}__${chatId}`);
    const last = (await throttleRef.get()).data()?.at?.toMillis?.() ?? 0;
    if (Date.now() - last < MESSAGE_THROTTLE_MS) continue;
    const tokens = await tokensFor(uid, "messages");
    if (!tokens.length) continue;
    await throttleRef.set({ uid, at: FieldValue.serverTimestamp() });
    for (const tk of tokens) {
      messages.push(buildMessagePush({ to: tk.token, lang: tk.lang, url: `/(tabs)/messages/${chatId}` }));
      tokenRefs.set(tk.token, tk.ref);
    }
  }
  if (messages.length) await sendExpo(messages, tokenRefs);
});

// アカウントが削除されたら、その人の記録をサーバー側でも消す:
//   ocrUsage（時間割読み取りの利用記録）· pushTokens（通知の端末トークン）· pushThrottle
// docs/legal/PRIVACY.md 第6項「アカウント削除まで」の裏付け。
// （どれもアプリからは読み書きできないので、アプリの deleteSelfData では消せない）
// v2 には「ユーザー削除後」のトリガーが無いため、ここだけ v1 を使う。
export const cleanupOnUserDelete = functionsV1
  .region("asia-northeast1")
  .auth.user()
  .onDelete(async (user) => {
    let count = 0;
    for (const col of ["ocrUsage", "pushTokens", "pushThrottle"]) {
      const snap = await db.collection(col).where("uid", "==", user.uid).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
      count += snap.size;
    }
    if (count) logger.info("user data cleaned", { count });
  });
