import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { ClassSession } from "../types/timetable";

// ============================================================
// 時間割の実データ層
// Firestore パス: users/{uid}/timetables/{semesterKey}   (例: "2026-春")
// firestore.rules の users/{uid}/timetables ルールと1:1対応:
//   - 読み取りは visibility ("private"|"friends"|"department"|"public") に依存
//   - 書き込みは本人のみ
// セッション配列はドキュメント1件にまとめて保存する（1学期あたり高々数十件で
// 1MB制限に遠く及ばず、read 1回で学期全体をロードできるため）。
// ============================================================

export type TimetableVisibility = "private" | "friends" | "department" | "public";

export interface TimetableDoc {
  sessions: ClassSession[];
  visibility: TimetableVisibility;
  updatedAt: number;
}

function timetableRef(uid: string, semesterKey: string) {
  return doc(db, "users", uid, "timetables", semesterKey);
}

export async function getTimetable(
  uid: string,
  semesterKey: string
): Promise<TimetableDoc | null> {
  const snap = await getDoc(timetableRef(uid, semesterKey));
  return snap.exists() ? (snap.data() as TimetableDoc) : null;
}

// セッション配列を丸ごと保存する。
// initVisibility: ドキュメント新規作成時のみ true にして visibility を初期化する
// （既存ドキュメントでは本人が設定した visibility を上書きしないため merge のみ）。
// 既定は "friends" — 友達の時間割閲覧・重なり表示がアプリの中核価値のため、
// 友達までは既定で公開する（Phase 2 の公開範囲設定UIで本人が変更可能）。
export async function saveTimetableSessions(
  uid: string,
  semesterKey: string,
  sessions: ClassSession[],
  opts?: { initVisibility?: boolean }
): Promise<void> {
  const data: Partial<TimetableDoc> = { sessions, updatedAt: Date.now() };
  if (opts?.initVisibility) data.visibility = "friends";
  await setDoc(timetableRef(uid, semesterKey), data, { merge: true });
}

// 公開範囲の変更（Phase 2 先輩時間割で使用）
export async function setTimetableVisibility(
  uid: string,
  semesterKey: string,
  visibility: TimetableVisibility
): Promise<void> {
  await setDoc(timetableRef(uid, semesterKey), { visibility, updatedAt: Date.now() }, { merge: true });
}
