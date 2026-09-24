// 卒業要件マジシャンの集計ロジック（純関数・クライアント計算のみ）。
// 入力: 便覧マスター(区分別最低単位) × 修得記録(科目ごとの取得/不可/履修中) × 手動入力(成績表の区分別合計)。
// 便覧 p57 のルールを反映:
//  - 基礎教育・必修外国語を除く区分で最低単位を超えた分はフリーゾーンへ算入
//  - 日本事情(留学生)は総合教育に8単位まで / 資格課程科目は8単位まで
//  - 基幹科目は自コース28以上（外国専門書講読4を含む）

import type { GradMaster } from "../data/graduationMaster";
import { classifySubject, type CourseId, type SogoSub, type ZoneId } from "../data/gradAllocationMeijiCommerce";

export type RecordStatus = "passed" | "failed" | "inProgress";

export interface GradRecord {
  id: string;
  name: string;
  units: number;
  zone: ZoneId;              // 登録時に配当表で判定 or 利用者が選択
  status: RecordStatus;
  source: "timetable" | "manual";
  semesterKey?: string;      // 時間割由来のとき（例 "2025-春"）
  ownCourseManual?: boolean; // 配当表に無い基幹科目を利用者が「自コース」と指定した場合
  createdAt: number;
}

// 超過分がフリーゾーンへ流れる区分（便覧 p57 注意事項(3)）
const OVERFLOW_ZONES: ZoneId[] = ["sogo", "hoken", "kihon", "kikan"];
const RYUGAKUSEI_CAP = 8;
const SHIKAKU_CAP = 8;
const OWN_COURSE_MIN = 28;
const GAISEN_MIN = 4; // 外国専門書講読
export const GRAD_SUB_MINS = { ownCourse: OWN_COURSE_MIN, gaisen: GAISEN_MIN, sogoSub: 4 };

export interface ZoneCalc {
  raw: number;       // 区分に入った単位（手動入力＋記録）
  counted: number;   // 区分として算入（最低単位で頭打ち。フリーゾーンは超過分込み）
  overflow: number;  // フリーゾーンへ流れた分
  min: number;
  met: boolean;          // 最低単位 かつ 判定できる内訳要件を満たす
  subShort: boolean;     // 内訳要件（総合教育3分野各4 / 自コース28・外国専門書講読4）が不足
  subUnverified: boolean; // 内訳を判定できない（手動入力の合計が混ざる・コース未選択）
}

export interface GradCalc {
  zones: Record<string, ZoneCalc>;
  total: number;
  ownCourse: number | null;     // 自コース基幹単位（コース未選択なら null）
  gaisen: number;               // 外国専門書講読
  sogoSubs: Record<"bunka" | "chiiki" | "ningen", number>;
}

function subOf(r: GradRecord): SogoSub | undefined {
  return classifySubject(r.name, null)?.entry.sub;
}

export function isOwnCourse(r: GradRecord, courseId: CourseId | null): boolean {
  if (r.zone !== "kikan" || !courseId) return false;
  const c = classifySubject(r.name, courseId);
  if (c && c.zone === "kikan") return c.ownCourse === true;
  return r.ownCourseManual === true;
}

// includeInProgress: true で「履修中が全部取れたら」の見込みを出す
export function calcGrad(
  master: GradMaster,
  baseline: Record<string, number>,
  records: GradRecord[],
  courseId: CourseId | null,
  includeInProgress: boolean,
): GradCalc {
  const raw: Record<string, number> = {};
  master.zones.forEach((z) => { raw[z.id] = baseline[z.id] ?? 0; });

  let ryugakusei = 0;
  let shikaku = 0;
  let ownCourse = 0;
  let gaisen = 0;
  const sogoSubs = { bunka: 0, chiiki: 0, ningen: 0 };

  records.forEach((r) => {
    if (r.status === "failed") return;
    if (r.status === "inProgress" && !includeInProgress) return;
    let u = r.units;
    const c = classifySubject(r.name, courseId);
    if (c?.entry.sub === "ryugakusei") {
      u = Math.max(0, Math.min(u, RYUGAKUSEI_CAP - ryugakusei));
      ryugakusei += u;
    }
    if (c?.entry.capGroup === "shikaku") {
      u = Math.max(0, Math.min(u, SHIKAKU_CAP - shikaku));
      shikaku += u;
    }
    raw[r.zone] = (raw[r.zone] ?? 0) + u;
    if (isOwnCourse(r, courseId)) ownCourse += u;
    if (c?.entry.name === "外国専門書講読" && courseId) gaisen += u;
    const sub = subOf(r);
    if (sub === "bunka" || sub === "chiiki" || sub === "ningen") sogoSubs[sub] += u;
  });

  const zones: Record<string, ZoneCalc> = {};
  let overflowSum = 0;
  master.zones.forEach((z) => {
    if (z.id === "freezone") return;
    const r = raw[z.id] ?? 0;
    const counted = Math.min(r, z.minUnits);
    const overflow = OVERFLOW_ZONES.includes(z.id as ZoneId) ? Math.max(0, r - z.minUnits) : 0;
    overflowSum += overflow;
    zones[z.id] = { raw: r, counted, overflow, min: z.minUnits, met: r >= z.minUnits, subShort: false, subUnverified: false };
  });

  // 内訳要件。手動入力(baseline)の合計は内訳が分からないため、混ざる区分は「要確認」に留める。
  const sogoZ = zones.sogo;
  if (sogoZ) {
    const short = (["bunka", "chiiki", "ningen"] as const).some((k) => sogoSubs[k] < GRAD_SUB_MINS.sogoSub);
    if (short) {
      if ((baseline.sogo ?? 0) > 0) sogoZ.subUnverified = true;
      else sogoZ.subShort = true;
    }
  }
  const kikanZ = zones.kikan;
  if (kikanZ) {
    if (!courseId) kikanZ.subUnverified = true;
    else if (ownCourse < GRAD_SUB_MINS.ownCourse || gaisen < GRAD_SUB_MINS.gaisen) {
      if ((baseline.kikan ?? 0) > 0) kikanZ.subUnverified = true;
      else kikanZ.subShort = true;
    }
  }
  Object.values(zones).forEach((z) => { if (z.subShort) z.met = false; });
  const fz = master.zones.find((z) => z.id === "freezone");
  if (fz) {
    const r = (raw.freezone ?? 0) + overflowSum;
    zones.freezone = { raw: r, counted: r, overflow: 0, min: fz.minUnits, met: r >= fz.minUnits, subShort: false, subUnverified: false };
  }
  const total = Object.values(zones).reduce((s, z) => s + z.counted, 0);
  return { zones, total, ownCourse: courseId ? ownCourse : null, gaisen, sogoSubs };
}


// 記録を1件変えたときの「どこに何単位入ったか」メッセージ用の差分
export interface ZoneDelta { zoneId: string; before: number; after: number; min: number }
export function diffZones(a: GradCalc, b: GradCalc): ZoneDelta[] {
  return Object.keys(b.zones)
    .filter((id) => (a.zones[id]?.counted ?? 0) !== b.zones[id].counted)
    .map((id) => ({ zoneId: id, before: a.zones[id]?.counted ?? 0, after: b.zones[id].counted, min: b.zones[id].min }));
}
