// 学校マスターデータ（オンボーディングの学校選択・学校名表示用）
// 大学判定そのものは .ac.jp 接尾辞規則（authService.isUniversityEmail）で行い、
// この一覧は表示名のマッピングと選択UIのためだけに使う。
// 対応校を増やすときはここに1行追加するだけでよい。

export interface School {
  domain: string;   // 例: "meiji.ac.jp"（schoolDomainとして保存される正規値）
  nameJa: string;
  nameKo: string;
}

export const SCHOOLS: School[] = [
  { domain: "meiji.ac.jp", nameJa: "明治大学", nameKo: "메이지대학" },
];

export function schoolNameByDomain(domain: string | null, language: "ja" | "ko"): string | null {
  if (!domain) return null;
  const school = SCHOOLS.find((s) => s.domain === domain);
  if (!school) return domain; // 마스터에 없는 도메인은 도메인 그대로 표시
  return language === "ko" ? school.nameKo : school.nameJa;
}
