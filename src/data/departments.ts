// 学部マスターデータ（講義検索・時間割ウィザードの学部選択用）
//
// 🔴 学校ごとに持つ（1.1 S2）。以前は明治10学部のベタ書きだったので、
//    どの学校を選んだ人にも明治の学部が出ていた。
//
// id は「その学校の公式コード」をそのまま使う。Firestore パス
// schools/{schoolDomain}/departments/{deptId} の deptId と1:1で対応する。
//   - 明治 : Oh-o! Meiji シラバス検索の category（scripts/crawl-syllabus.mjs --category）
//   - 早稲田: シラバスの学部コード p_gakubu（例 161973 = 商学部）
// 学校ごとに体系が違うので番号が衝突することはない。学校をまたいで
// 共通のコードを振り直さないこと（クロール結果と突き合わせられなくなる）。
//
// ⚠️ 載せてよいのは **クロール済み＝Firestore に講義が入っている学部だけ**。
//    ここに並べた学部はユーザーが選べてしまい、選んで0件だと故障に見える。
//    データのない学校は空のまま＝学部選択UIごと出さない（hasDepartmentData）。

export interface Department {
  id: string; // 例: "12"（deptId として保存される正規値）
  nameJa: string;
  nameKo: string;
}

// 明治大学（10学部 + 学部間共通）。唯一 Firestore に講義が入っている学校。
const MEIJI: Department[] = [
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
  // 学部間共通（どの学部の学生も履修する区分）。シラバス検索の category 81〜87 と同一コード。
  // 外国語・資格課程(教職)・情報科目は学部コードの検索結果に出ないため別チップで出す（2026-10-25）。
  // ※ これは明治固有の区分。他校に同じ枠があるとは限らないので横展開しないこと。
  { id: "81", nameJa: "共通外国語科目", nameKo: "공통외국어과목" },
  { id: "82", nameJa: "資格課程科目", nameKo: "자격과정(교직)과목" },
  { id: "83", nameJa: "情報関係科目", nameKo: "정보관계과목" },
  { id: "84", nameJa: "留学生・国際連携科目", nameKo: "유학생·국제연계과목" },
  // 87 国際協力人材育成プログラム は 2026年度の開講が0件（クロール結果）のためチップを出さない。
  // 次年度のクロールで科目が出たらここに追加する。
];

// 学校ドメイン → 学部一覧。
// 🔴 学校を足すときは「Firestore への適載が終わってから」ここに足す。
//    早稲田 商学部(161973) は Course JSON までできているが Firestore 未適載なので
//    まだ載せない（docs/data/MASTERS-INDEX.md の状況を見ること）。
export const DEPARTMENTS_BY_SCHOOL: Record<string, Department[]> = {
  "meiji.ac.jp": MEIJI,
};

// その学校の学部一覧。データが無い学校・未選択は空配列。
export function departmentsForSchool(schoolDomain: string | null): Department[] {
  if (!schoolDomain) return [];
  return DEPARTMENTS_BY_SCHOOL[schoolDomain] ?? [];
}

// 学部選択UIを出してよいか。false なら「準備中」の案内に差し替える
// （明治の学部を他校の人に見せないための分岐）。
export function hasDepartmentData(schoolDomain: string | null): boolean {
  return departmentsForSchool(schoolDomain).length > 0;
}

export function departmentName(dept: Department, language: "ja" | "ko"): string {
  return language === "ko" ? dept.nameKo : dept.nameJa;
}

export function departmentById(schoolDomain: string | null, id: string | null): Department | null {
  if (!id) return null;
  return departmentsForSchool(schoolDomain).find((d) => d.id === id) ?? null;
}

// プロフィールの department（自由記述のことがある）を学部に照合する。
// id・日本語名・韓国語名のいずれかで一致を見る。講義検索と時間割ウィザードが
// 同じ処理を各自で持っていたのでここへ寄せた。
export function matchDepartment(
  schoolDomain: string | null,
  raw: string | null
): Department | null {
  if (!raw) return null;
  return (
    departmentsForSchool(schoolDomain).find(
      (d) => d.id === raw || d.nameJa === raw || d.nameKo === raw
    ) ?? null
  );
}

// 本人の学部を先頭に、残りは元の並び（学部コード順）。
export function orderDepartments(
  schoolDomain: string | null,
  mine: Department | null
): Department[] {
  const all = departmentsForSchool(schoolDomain);
  if (!mine) return all;
  return [mine, ...all.filter((d) => d.id !== mine.id)];
}
