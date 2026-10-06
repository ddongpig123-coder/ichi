// 法学部 必修科目（◎）一覧。便覧「授業科目配当年次表」(2026)より。
// 配当年次の○印は便覧上ラスターで自動抽出できないため、該当ページを目視確認して転記。
// 科目名・単位・科目群(zone)はテキスト抽出 + 目視検証。横断的必修(universal) と コース別必修(courseTag) を区別。
// zone id は src/data/facultyMasters.ts の法学部 zone と一致。

export interface RequiredCourse {
  name: string;
  units: number;
  zone: string;          // kiso | hoken | horitsu | enshu | course
  years: number[];       // 配当年次（履修できる学年）
  courseTag?: string;    // コース別必修のとき（法曹 / 公共法務 など）。未指定=全員必修
}

// 全員必修 + コース別必修（courseTag付き）。検証: horitsu 12科目×2 = 24単位 = 便覧 法律必修24。
export const LAW_REQUIRED: RequiredCourse[] = [
  // 基礎科目群（全員必修）
  { name: "法律リテラシー", units: 2, zone: "kiso", years: [1] },
  { name: "法学部生のための日本語Ⅰ（リテラシー）", units: 2, zone: "kiso", years: [1] }, // 留学生対象
  { name: "法学部生のための日本語Ⅱ（精読）", units: 2, zone: "kiso", years: [1] },     // 留学生対象
  // 保健体育科目群（全員必修）
  { name: "基礎運動実習Ⅰ", units: 1, zone: "hoken", years: [1] },
  { name: "基礎運動実習Ⅱ", units: 1, zone: "hoken", years: [1] },
  // 法律必修科目群（全員必修・計24単位）
  { name: "憲法（人権）Ⅰ", units: 2, zone: "horitsu", years: [1] },
  { name: "憲法（人権）Ⅱ", units: 2, zone: "horitsu", years: [1] },
  { name: "憲法（統治）Ⅰ", units: 2, zone: "horitsu", years: [2] },
  { name: "憲法（統治）Ⅱ", units: 2, zone: "horitsu", years: [2] },
  { name: "民法（総則）Ⅰ", units: 2, zone: "horitsu", years: [1] },
  { name: "民法（総則）Ⅱ", units: 2, zone: "horitsu", years: [1] },
  { name: "民法（債権総論）Ⅰ", units: 2, zone: "horitsu", years: [2] },
  { name: "民法（債権総論）Ⅱ", units: 2, zone: "horitsu", years: [2] },
  { name: "刑法（総論）Ⅰ", units: 2, zone: "horitsu", years: [1] },
  { name: "刑法（総論）Ⅱ", units: 2, zone: "horitsu", years: [1] },
  { name: "刑法（各論）Ⅰ", units: 2, zone: "horitsu", years: [2] },
  { name: "刑法（各論）Ⅱ", units: 2, zone: "horitsu", years: [2] },
  // 演習科目群（全員必修）
  { name: "専門演習ＡⅠ", units: 2, zone: "enshu", years: [3] },
  { name: "専門演習ＡⅡ", units: 2, zone: "enshu", years: [3] },
  { name: "専門演習ＢⅠ", units: 2, zone: "enshu", years: [4] },
  { name: "専門演習ＢⅡ", units: 2, zone: "enshu", years: [4] },
  // 法曹コース科目群（法曹コース登録者の必修）
  { name: "民法（物権）", units: 2, zone: "course", years: [2, 3, 4], courseTag: "法曹コース" },
  { name: "民法（担保物権）", units: 2, zone: "course", years: [2, 3, 4], courseTag: "法曹コース" },
  { name: "民法（契約）Ⅰ", units: 2, zone: "course", years: [3, 4], courseTag: "法曹コース" },
  { name: "民法（契約）Ⅱ", units: 2, zone: "course", years: [3, 4], courseTag: "法曹コース" },
  { name: "民法（損害賠償）", units: 2, zone: "course", years: [3, 4], courseTag: "法曹コース" },
  { name: "会社法Ⅰ", units: 2, zone: "course", years: [3, 4], courseTag: "法曹コース" },
  { name: "会社法Ⅱ", units: 2, zone: "course", years: [3, 4], courseTag: "法曹コース" },
  // 公共法務コース科目群（公共法務コース登録者の必修）
  { name: "行政法ＡⅠ", units: 2, zone: "course", years: [2, 3, 4], courseTag: "公共法務コース" },
  { name: "行政法ＡⅡ", units: 2, zone: "course", years: [2, 3, 4], courseTag: "公共法務コース" },
  { name: "行政法ＢⅠ", units: 2, zone: "course", years: [3, 4], courseTag: "公共法務コース" },
  { name: "行政法ＢⅡ", units: 2, zone: "course", years: [3, 4], courseTag: "公共法務コース" },
];
