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

export function isSemesterAvailable(year: number, _semester: Semester): boolean {
  // 3月に1年分（春・秋）まとめて履修登録するため、当年度・過去年度は
  // 春・秋の両方を開放する。未来年度のみ選択不可。
  const currentYear = new Date().getFullYear();
  return year <= currentYear;
}
