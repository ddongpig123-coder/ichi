// 学期の型と選択ロジック（時間割データ本体は Firestore: users/{uid}/timetables/{semesterKey}）

export type Semester = "春" | "秋";
export type SemesterKey = `${number}-${"春" | "秋"}`;

// TODO(onboarding): 入学年度はユーザーごとに users ドキュメントへ保存する（9月 온보딩 작업）。
// それまでは全ユーザー共通の仮値。
export const ENROLLMENT_YEAR = 2024;

export function getCurrentSemester(): Semester {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 8 ? "春" : "秋";
}

export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from(
    { length: currentYear - ENROLLMENT_YEAR + 1 },
    (_, i) => ENROLLMENT_YEAR + i
  );
}

export function isSemesterAvailable(year: number, semester: Semester): boolean {
  const currentYear = new Date().getFullYear();
  const currentSemester = getCurrentSemester();
  if (year < currentYear) return true;
  if (year === currentYear) return semester === "春" || currentSemester === "秋";
  return false;
}
