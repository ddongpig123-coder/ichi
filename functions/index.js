// Cloud Functions（2026-11-14〜）。デプロイは準熙のみ（AGENTS.md 정지선）: `npm run deploy:functions`
// 前提: Firebase を Blaze（従量制）にしてあること・ANTHROPIC_API_KEY を Secret に登録してあること
//   npx firebase-tools functions:secrets:set ANTHROPIC_API_KEY
// 詳しくは docs/TIMETABLE-OCR.md §5（運用）・docs/RELEASE-PLAN-2026-12.md N1。

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_PERIODS, buildPrompt, extractJson, sanitizePeriods, sanitizeResult } from "./timetablePrompt.js";

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
      await usageRef.set({
        status: result.notTimetable ? "not-timetable" : "done",
        finishedAt: FieldValue.serverTimestamp(),
        model: MODEL,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        sessions: result.sessions.length,
      }, { merge: true });
      return result;
    } catch (e) {
      // 失敗したら枠を返す（もう一度試せるように）。時間割でない画像も枠を消費しない（上の not-timetable）
      await usageRef.delete().catch(() => {});
      if (e instanceof HttpsError) throw e;
      logger.warn("readTimetable failed", { uid, reason: String(e?.message ?? e).slice(0, 200) });
      throw new HttpsError("unavailable", "read-failed");
    }
  }
);
