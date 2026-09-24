import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTimetable } from "./timetableService";
import type { GradRecord } from "../utils/gradCalc";
import type { CourseId } from "../data/gradAllocationMeijiCommerce";

// ============================================================
// 卒業要件マジシャンの修得記録（端末ローカル保存）
// 成績・修得記録は運営サーバーに平文で置かない方針（docs/CREDIT-TRACKING.md §6-2）。
// 本格版の E2E 金庫（users/{uid}/creditVault）ができるまでは AsyncStorage のみに保存する。
// → 端末を変えると記録は引き継がれない（画面で明示）。
// ============================================================

export interface GradState {
  version: 1;
  records: GradRecord[];
  baseline: Record<string, number>; // 成績表の区分別合計（記録していない過去分）
  courseId: CourseId | null;
}

const EMPTY: GradState = { version: 1, records: [], baseline: {}, courseId: null };

function storageKey(uid: string | null) {
  return `ichi:gradRecords:${uid ?? "guest"}`;
}

export async function loadGradState(uid: string | null): Promise<GradState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<GradState>;
    return {
      version: 1,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      baseline: parsed.baseline ?? {},
      courseId: parsed.courseId ?? null,
    };
  } catch (e) {
    console.warn("gradRecords load failed:", e);
    return EMPTY;
  }
}

export async function saveGradState(uid: string | null, state: GradState): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch (e) {
    console.warn("gradRecords save failed:", e);
  }
}

// ── 時間割からの候補 ────────────────────────────────────
export interface TimetableSubject {
  name: string;
  semesterKey: string; // 例 "2025-春"
  isCurrent: boolean;  // 今学期（= 履修中の既定）
}

// 学年度: 1〜3月は前年度の秋学期扱い
function currentSemesterKey(now = new Date()): { year: number; sem: "春" | "秋" } {
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  if (m <= 3) return { year: y - 1, sem: "秋" };
  return { year: y, sem: m <= 8 ? "春" : "秋" };
}

// 入学年度〜今学期までの時間割を読み、学期ごとに科目名を重複なく返す（未来学期は除外）。
// 1学期の読み込み失敗は無視して続行（候補が一部欠けるだけで画面は壊さない）。
export async function loadTimetableSubjects(uid: string, fromYear: number): Promise<TimetableSubject[]> {
  const cur = currentSemesterKey();
  const keys: { key: string; isCurrent: boolean }[] = [];
  for (let y = fromYear; y <= cur.year; y++) {
    for (const s of ["春", "秋"] as const) {
      if (y === cur.year && s === "秋" && cur.sem === "春") continue;
      keys.push({ key: `${y}-${s}`, isCurrent: y === cur.year && s === cur.sem });
    }
  }
  const docs = await Promise.all(keys.map((k) => getTimetable(uid, k.key).catch(() => null)));
  const out: TimetableSubject[] = [];
  docs.forEach((d, i) => {
    if (!d?.sessions) return;
    const seen = new Set<string>();
    d.sessions.forEach((s) => {
      const name = s.name?.trim();
      if (!name || seen.has(name)) return; // 2コマ連続などの重複を除く
      seen.add(name);
      out.push({ name, semesterKey: keys[i].key, isCurrent: keys[i].isCurrent });
    });
  });
  return out;
}
