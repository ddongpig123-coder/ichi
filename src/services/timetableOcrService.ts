import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";
import { DAYS, PERIOD_TIMES, PERIODS, type Day, type Period } from "../types/timetable";

// ============================================================
// 時間割スクリーンショット読み取り（2026-11 / RELEASE-PLAN N1）
// 画像 → Cloud Function `readTimetable`（functions/index.js）→ Anthropic の AI が読む → 授業の一覧。
// 画像も読み取り結果もサーバーには残らない（使用回数の記録だけ）。1 人・1 学期 1 回。
// 詳しくは docs/TIMETABLE-OCR.md §4。
//
// 🔴 旧バイナリ（ストア版 1.0.0）を落とさないこと。
//   写真の選択は新しいネイティブ部品（expo-image-picker）で、1.0.0 のアプリには入っていない。
//   OTA で届いた新しい JS が、部品の無いアプリで `import "expo-image-picker"` を実行すると
//   起動直後に落ちる。だからトップレベルで import せず、
//   ① 部品があるか `requireOptionalNativeModule` で確かめ（無ければ null が返るだけ）、
//   ② あるときだけ関数の中で require する。部品が無いアプリでは入口ボタン自体を出さない。
//   （OTA-2026-11 §0「内蔵バイナリとの互換」）
// ============================================================

type ImagePickerModule = typeof import("expo-image-picker");

/** この端末で「スクショから読み込む」が使えるか（旧バイナリでは false → 入口を隠す） */
export const canReadTimetableImage: boolean =
  Platform.OS === "web" || requireOptionalNativeModule("ExponentImagePicker") != null;

function loadPicker(): ImagePickerModule | null {
  if (!canReadTimetableImage) return null;
  try {
    return require("expo-image-picker") as ImagePickerModule;
  } catch {
    return null;
  }
}

export type OcrMediaType = "image/png" | "image/jpeg" | "image/webp";

export interface PickedImage {
  base64: string;
  mediaType: OcrMediaType;
  uri: string;
  width: number;
  height: number;
}

// サーバー（Anthropic）の画像上限は 5MB。base64 の長さで見て、超えるものは送る前に止める
// （送っても向こうで断られるだけ。回数は戻るが、待たせるだけ損）
export const MAX_IMAGE_BASE64_LENGTH = 5 * 1024 * 1024;

// 実際の中身で形式を判定する（iOS は元が PNG でも base64 を JPEG で返すので mimeType は当てにならない）
export function detectMediaType(base64: string): OcrMediaType | null {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return null;
}

export type PickResult =
  | { ok: true; image: PickedImage }
  | { ok: false; reason: "canceled" | "unavailable" | "unsupported" | "too-large" | "failed" };

/** 写真を 1 枚選ぶ。ネイティブでは JPEG(品質 0.8)の base64 になる */
export async function pickTimetableImage(): Promise<PickResult> {
  const ImagePicker = loadPicker();
  if (!ImagePicker) return { ok: false, reason: "unavailable" };
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: false,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
      exif: false,
    });
    if (res.canceled || !res.assets?.[0]) return { ok: false, reason: "canceled" };
    const a = res.assets[0];
    const base64 = a.base64 ?? "";
    if (!base64) return { ok: false, reason: "failed" };
    const mediaType = detectMediaType(base64);
    if (!mediaType) return { ok: false, reason: "unsupported" }; // HEIC など（主に Web）
    if (base64.length > MAX_IMAGE_BASE64_LENGTH) return { ok: false, reason: "too-large" };
    return { ok: true, image: { base64, mediaType, uri: a.uri, width: a.width, height: a.height } };
  } catch (e) {
    console.warn("pickTimetableImage failed:", e);
    return { ok: false, reason: "failed" };
  }
}

// ── 読み取り（Cloud Function 呼び出し）

export interface OcrSession {
  day: Day;
  period: Period;
  name: string;
  teacher: string | null;
  room: string | null;
  confidence: "high" | "low";
}

export interface OcrUnplaced {
  name: string;
  reason: string | null;
}

export interface OcrResult {
  sessions: OcrSession[];
  unplaced: OcrUnplaced[];
  notTimetable: boolean;
}

export type OcrErrorCode =
  | "login-required"
  | "already-used"
  | "in-progress"
  | "daily-cap"
  | "bad-image"
  | "failed";

export class OcrError extends Error {
  constructor(public code: OcrErrorCode) {
    super(code);
  }
}

// サーバーが返す message（functions/index.js の HttpsError 第2引数）→ 画面用のコード
function toOcrError(e: unknown): OcrError {
  const msg = typeof (e as { message?: unknown })?.message === "string" ? (e as { message: string }).message : "";
  switch (msg) {
    case "login-required":
      return new OcrError("login-required");
    case "already-used":
      return new OcrError("already-used");
    case "in-progress":
      return new OcrError("in-progress");
    case "daily-cap":
      return new OcrError("daily-cap");
    case "bad-media-type":
    case "bad-image-size":
      return new OcrError("bad-image");
    default:
      return new OcrError("failed"); // 通信エラー・read-failed など（回数は戻っている）
  }
}

// 学校の時限表（今は全校 PERIOD_TIMES。学校別の時限表ができたらここで差し替える — TIMETABLE-OCR §3-2）
function periodTable() {
  return PERIODS.map((p) => ({ period: p, start: PERIOD_TIMES[p].start, end: PERIOD_TIMES[p].end }));
}

const isDay = (v: unknown): v is Day => typeof v === "string" && (DAYS as readonly string[]).includes(v);
const isPeriod = (v: unknown): v is Period => typeof v === "number" && (PERIODS as readonly number[]).includes(v);
const strOrNull = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// サーバーの結果をアプリの時間割に入る形に絞る。
// アプリの時間割は 月〜土・1〜7限。日曜などはここで「時間割に入らない授業」へ回す
export function normalizeOcrResult(raw: unknown): OcrResult {
  const r = (raw ?? {}) as { sessions?: unknown; unplaced?: unknown; notTimetable?: unknown };
  const sessions: OcrSession[] = [];
  const unplaced: OcrUnplaced[] = [];
  for (const s of Array.isArray(r.sessions) ? r.sessions : []) {
    const name = strOrNull(s?.name, 100);
    if (!name) continue;
    if (!isDay(s?.day) || !isPeriod(s?.period)) {
      // 例: 日曜の授業（アプリの時間割は月〜土）
      unplaced.push({
        name,
        reason: typeof s?.day === "string" ? `${s.day}曜${Number.isInteger(s?.period) ? ` ${s.period}限` : ""}` : null,
      });
      continue;
    }
    sessions.push({
      day: s.day,
      period: s.period,
      name,
      teacher: strOrNull(s?.teacher, 100),
      room: strOrNull(s?.room, 100),
      confidence: s?.confidence === "low" ? "low" : "high",
    });
  }
  for (const u of Array.isArray(r.unplaced) ? r.unplaced : []) {
    const name = strOrNull(u?.name, 100);
    if (name) unplaced.push({ name, reason: strOrNull(u?.reason, 200) });
  }
  return { sessions, unplaced, notTimetable: r.notTimetable === true && sessions.length === 0 };
}

/** 画像を読み取る。失敗は OcrError（code で画面の文言を分ける） */
export async function readTimetableImage(image: PickedImage, semesterKey: string): Promise<OcrResult> {
  const call = httpsCallable(getFunctions(app, "asia-northeast1"), "readTimetable", { timeout: 90_000 });
  try {
    const res = await call({
      imageBase64: image.base64,
      mediaType: image.mediaType,
      semesterKey,
      periods: periodTable(),
    });
    return normalizeOcrResult(res.data);
  } catch (e) {
    console.warn("readTimetable failed:", e);
    throw toOcrError(e);
  }
}

// ── 読み取り結果の一時保存（端末内のみ）
// 1 学期 1 回しか読めないので、確認画面で保存せずに閉じても結果が消えないようにしておく。
// 時間割に保存したら消す。サーバーには何も残らない（端末の AsyncStorage だけ）。

const draftKey = (uid: string, semesterKey: string) => `ichi:ocrDraft:${uid}:${semesterKey}`;

export async function loadOcrDraft(uid: string, semesterKey: string): Promise<OcrResult | null> {
  try {
    const v = await AsyncStorage.getItem(draftKey(uid, semesterKey));
    return v ? normalizeOcrResult(JSON.parse(v)) : null;
  } catch {
    return null;
  }
}

export function saveOcrDraft(uid: string, semesterKey: string, result: OcrResult): void {
  AsyncStorage.setItem(draftKey(uid, semesterKey), JSON.stringify(result)).catch(() => {});
}

export function clearOcrDraft(uid: string, semesterKey: string): void {
  AsyncStorage.removeItem(draftKey(uid, semesterKey)).catch(() => {});
}
