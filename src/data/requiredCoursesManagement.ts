// 経営学部 必修科目。便覧 授業科目一覧(2021年度以降)の「学部必修科目群」より。
// 一覧に必修マークが無いため、全員必修として確定できるのは学部必修科目群のみ(12単位)。
// 学科必修(8単位)は一覧上で選択科目と区別できないため未収録(履修要項で要確認)。
import type { RequiredCourse } from "./requiredCoursesLaw";

// 検証: 6科目×2 = 12単位 = 便覧 学部必修12。全員1年次配当。
export const MANAGEMENT_REQUIRED: RequiredCourse[] = [
  { name: "経営総論", units: 2, zone: "gakubu-hisshu", years: [1] },
  { name: "経営学", units: 2, zone: "gakubu-hisshu", years: [1] },
  { name: "会計学", units: 2, zone: "gakubu-hisshu", years: [1] },
  { name: "公共経営学", units: 2, zone: "gakubu-hisshu", years: [1] },
  { name: "近代経済学Ａ", units: 2, zone: "gakubu-hisshu", years: [1] },
  { name: "近代経済学Ｂ", units: 2, zone: "gakubu-hisshu", years: [1] },
];
