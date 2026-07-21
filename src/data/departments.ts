// 学部マスターデータ（講義検索の学部選択用）
// コードは Oh-o! Meiji シラバス検索の category と同一 — scripts/crawl-syllabus.mjs の
// --category、および Firestore パス schools/{schoolDomain}/departments/{deptId} の deptId と1:1対応。
// 学部を増やすときはここに1行追加する（クロール済みの学部のみ載せること）。

export interface Department {
  id: string; // 例: "12"（deptId として保存される正規値）
  nameJa: string;
  nameKo: string;
}

export const DEPARTMENTS: Department[] = [
  { id: "11", nameJa: "法学部", nameKo: "법학부" },
  { id: "12", nameJa: "商学部", nameKo: "상학부" },
  { id: "13", nameJa: "政治経済学部", nameKo: "정치경제학부" },
  { id: "14", nameJa: "文学部", nameKo: "문학부" },
  { id: "15", nameJa: "理工学部", nameKo: "이공학부" },
  { id: "16", nameJa: "農学部", nameKo: "농학부" },
  { id: "17", nameJa: "経営学部", nameKo: "경영학부" },
  { id: "18", nameJa: "情報コミュニケーション学部", nameKo: "정보커뮤니케이션학부" },
  { id: "19", nameJa: "国際日本学部", nameKo: "국제일본학부" },
  { id: "26", nameJa: "総合数理学部", nameKo: "종합수리학부" },
];

export function departmentName(dept: Department, language: "ja" | "ko"): string {
  return language === "ko" ? dept.nameKo : dept.nameJa;
}

export function departmentById(id: string | null): Department | null {
  if (!id) return null;
  return DEPARTMENTS.find((d) => d.id === id) ?? null;
}
