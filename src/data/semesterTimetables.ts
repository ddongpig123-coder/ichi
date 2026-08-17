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
  // 履修登録は3月に1年分（春・秋まとめて）行うため、当年度は春・秋を常に両方開く。
  // （以前は「現在の学期より先」を塞いでいたが、秋学期を春のうちに準備できないのは不便）
  // 未来の年度だけは塞ぐ（データが存在しないため）。
  void semester; // 当年度は学期を問わず可
  const currentYear = new Date().getFullYear();
  return year <= currentYear;
}
