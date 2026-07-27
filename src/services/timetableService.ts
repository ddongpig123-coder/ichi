import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "../config/firebase";
import type { ClassSession } from "../types/timetable";
import type { PublicProfile } from "./userService";

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

// ============================================================
// 先輩時間割の一覧（Phase 2 2週目）
// 同じ学部の「公開/学部公開」時間割を集める。
// 実装方針（規則デプロイ不要）:
//   1) usersPublic を department 単一等価で絞る（複合インデックス不要）
//   2) 各候補の timetables/{学期} を get — 非公開/友達限定は permission-denied で
//      弾かれる（firestore.rules の visibility ゲートをそのまま利用）ため catch でスキップ
//   3) セッションのある（=中身のある）ものだけ返す
// 学年は呼び出し側が admissionYear から派生してフィルタする。
// ============================================================
export interface SeniorTimetable {
  uid: string;
  nickname: string;
  admissionYear: number | null;
  sessions: ClassSession[];
  visibility: TimetableVisibility;
}

export async function listDepartmentTimetables(
  me: { uid: string; department: string | null; schoolDomain: string | null },
  semesterKey: string,
  opts?: { max?: number }
): Promise<SeniorTimetable[]> {
  if (!me.department) return [];
  const q = query(
    collection(db, "usersPublic"),
    where("department", "==", me.department),
    limit(opts?.max ?? 60)
  );
  const snap = await getDocs(q);
  const candidates = snap.docs
    .map((d) => d.data() as PublicProfile)
    .filter((p) => p.uid && p.uid !== me.uid)
    // 学校スコープ: 自分の学校と一致する場合のみ（どちらか未設定なら学部一致で許容）
    .filter((p) => !me.schoolDomain || !p.schoolDomain || p.schoolDomain === me.schoolDomain);

  const loaded = await Promise.all(
    candidates.map(async (p): Promise<SeniorTimetable | null> => {
      try {
        const docData = await getTimetable(p.uid, semesterKey);
        if (!docData || docData.sessions.length === 0) return null; // 空/未作成は除外
        return {
          uid: p.uid,
          nickname: p.nickname || "",
          admissionYear: p.admissionYear ?? null,
          sessions: docData.sessions,
          visibility: docData.visibility,
        };
      } catch {
        return null; // permission-denied（非公開・友達限定）はスキップ
      }
    })
  );
  return loaded.filter((r): r is SeniorTimetable => r !== null);
}

// 入学年度 → 学年の派生（日本の年度は4月始まり）。
// 例: 2024入学 → 2026年度で3年（2026-2024+1）。範囲外は null。
export function gradeFromAdmissionYear(admissionYear: number | null, now: Date = new Date()): number | null {
  if (!admissionYear) return null;
  const nendo = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const grade = nendo - admissionYear + 1;
  return grade >= 1 && grade <= 6 ? grade : null;
}
