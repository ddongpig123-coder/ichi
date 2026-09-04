// 卒業要件マスター（お試し版・明治商学部）。
// 便覧の区分別最低単位のみを持つ軽量版。個人成績は含まない（便覧=公開情報）。
// 本格版(入学年度×学部の完全マスター・過去履歴・E2E金庫)はPhase 3。詳細は docs/CREDIT-TRACKING.md。
// データ元: docs/data/meiji-commerce-2021.json / meiji-commerce-2026.json

export interface GradZone {
  id: string;
  nameJa: string;
  minUnits: number;
}

export interface GradMaster {
  key: string;
  labelJa: string;
  admissionYearMax: number | null; // この年度以前に適用（nullは下限なし）
  totalRequired: number;
  zones: GradZone[];
}

// 2022年度以前入学者（例: 2021入学）= 合計134
const PRE_2023: GradMaster = {
  key: "pre2023",
  labelJa: "〜2022年度入学",
  admissionYearMax: 2022,
  totalRequired: 134,
  zones: [
    { id: "kiso", nameJa: "①基礎教育科目", minUnits: 8 },
    { id: "gaikokugo", nameJa: "②外国語(必修)", minUnits: 16 },
    { id: "sogo", nameJa: "③④総合教育+総合学際", minUnits: 24 },
    { id: "hoken", nameJa: "⑤保健体育(必修)", minUnits: 2 },
    { id: "kihon", nameJa: "⑥基本科目", minUnits: 16 },
    { id: "kikan", nameJa: "⑦⑧基幹+商学専門演習", minUnits: 48 },
    { id: "freezone", nameJa: "⑨フリーゾーン", minUnits: 20 },
  ],
};

// 2023年度以降入学者 = 合計126（フリーゾーンが12）
const FROM_2023: GradMaster = {
  key: "from2023",
  labelJa: "2023年度〜入学",
  admissionYearMax: null,
  totalRequired: 126,
  zones: [
    { id: "kiso", nameJa: "①基礎教育科目", minUnits: 8 },
    { id: "gaikokugo", nameJa: "②外国語(必修)", minUnits: 16 },
    { id: "sogo", nameJa: "③④総合教育+総合学際", minUnits: 24 },
    { id: "hoken", nameJa: "⑤保健体育(必修)", minUnits: 2 },
    { id: "kihon", nameJa: "⑥基本科目", minUnits: 16 },
    { id: "kikan", nameJa: "⑦⑧基幹+商学専門演習", minUnits: 48 },
    { id: "freezone", nameJa: "⑨フリーゾーン", minUnits: 12 },
  ],
};

export const GRAD_MASTERS: GradMaster[] = [PRE_2023, FROM_2023];

// 入学年度からマスターを選ぶ（2022以前→134 / 2023以降→126）。
export function masterForAdmissionYear(year: number | null): GradMaster {
  if (year != null && year <= 2022) return PRE_2023;
  return FROM_2023;
}
