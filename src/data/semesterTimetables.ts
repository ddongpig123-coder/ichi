// 学期の型と選択ロジック（時間割データ本体は Firestore: users/{uid}/timetables/{semesterKey}）

export type Semester = "春" | "秋";
export type SemesterKey = `${number}-${"春" | "秋"}`;

// 入学年度が不明なときの既定値（卒業要件の時間割読み込み範囲などに使う）。
export const ENROLLMENT_YEAR = 2024;

// 年度選択に出す過去年度の数（4年 + 留年・休学の余裕1年）
const PAST_YEARS_SHOWN = 5;

// 日本の学年度は4月始まり。1〜3月は「前年度の秋学期」にあたる。
// （カレンダー年をそのまま使うと、1月1日に未来の「翌年度秋」が既定になり
//   時間割が空に見える）
export function getCurrentAcademicYear(now = new Date()): number {
  const month = now.getMonth() + 1;
  return month <= 3 ? now.getFullYear() - 1 : now.getFullYear();
}

export function getCurrentSemester(now = new Date()): Semester {
  const month = now.getMonth() + 1;
  return month >= 4 && month <= 8 ? "春" : "秋";
}

// 学年（1〜4）。学年度基準なので1〜3月に1学年ずれない。
export function gradeFromAdmissionYear(admissionYear: number, now = new Date()): number {
  return Math.min(4, Math.max(1, getCurrentAcademicYear(now) - admissionYear + 1));
}

export function getAvailableYears(now = new Date()): number[] {
  // 終端はカレンダー年: 3月に翌年度分の履修登録をするため、1〜3月も翌年度を選べるようにする
  const last = now.getFullYear();
  const first = Math.min(ENROLLMENT_YEAR, getCurrentAcademicYear(now) - PAST_YEARS_SHOWN);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function isSemesterAvailable(year: number, _semester: Semester, now = new Date()): boolean {
  // 3月に1年分（春・秋）まとめて履修登録するため、当年度・過去年度は
  // 春・秋の両方を開放する。未来年度のみ選択不可。
  return year <= now.getFullYear();
}
