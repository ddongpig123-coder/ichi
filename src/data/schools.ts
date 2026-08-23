// 学校マスターデータ（オンボーディングの学校選択・学校名表示用）
// 大学判定そのものは .ac.jp 接尾辞規則（authService.isUniversityEmail）で行い、
// この一覧は表示名のマッピングと選択UIのためだけに使う。
// 対応校を増やすときはここに1行追加するだけでよい。

export interface School {
  domain: string;   // 例: "meiji.ac.jp"（schoolDomainとして保存される正規値）
  nameJa: string;
  nameKo: string;
}

// 韓国人留学生が多い順（概算・要調整）。ローンチ校の明治を先頭に据える。
// ⚠️ ドメイン注記: 認証バッジ判定 isUniversityEmail は原則 ".ac.jp" 接尾辞。
//    早稲田(waseda.jp)・慶應(keio.jp)は .ac.jp を使わないため authService の
//    exactDomains 例外に登録済み。学校を足すときはドメインの正確性を必ず確認すること。
export const SCHOOLS: School[] = [
  { domain: "meiji.ac.jp", nameJa: "明治大学", nameKo: "메이지대학" },
  { domain: "waseda.jp", nameJa: "早稲田大学", nameKo: "와세다대학" },
  { domain: "ritsumei.ac.jp", nameJa: "立命館大学", nameKo: "리쓰메이칸대학" },
  { domain: "hosei.ac.jp", nameJa: "法政大学", nameKo: "호세이대학" },
  { domain: "chuo-u.ac.jp", nameJa: "中央大学", nameKo: "주오대학" },
  { domain: "nihon-u.ac.jp", nameJa: "日本大学", nameKo: "니혼대학" },
  { domain: "keio.jp", nameJa: "慶應義塾大学", nameKo: "게이오기주쿠대학" },
  { domain: "apu.ac.jp", nameJa: "立命館アジア太平洋大学", nameKo: "리쓰메이칸아시아태평양대학(APU)" },
  { domain: "sophia.ac.jp", nameJa: "上智大学", nameKo: "조치대학" },
  { domain: "tsukuba.ac.jp", nameJa: "筑波大学", nameKo: "쓰쿠바대학" },
];

export function schoolNameByDomain(domain: string | null, language: "ja" | "ko"): string | null {
  if (!domain) return null;
  const school = SCHOOLS.find((s) => s.domain === domain);
  if (!school) return domain; // 마스터에 없는 도메인은 도메인 그대로 표시
  return language === "ko" ? school.nameKo : school.nameJa;
}
