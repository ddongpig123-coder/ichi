// 学部別 卒業要件マスター（明治大学 全10学部・区分別最低単位のみ）。
// 便覧(公開情報)の「区分×最低単位」だけを持つ軽量版。個人成績は含まない。
// 商学部は配当表まで整備済み(engine="commerce" = 既存エンジン src/data/graduationMaster.ts)。
// 他9学部は区分(領域)単位の診断のみ(engine="zones")。科目配当表→自動分類/CANはPhase後続。
// データ元: docs/data/meiji-*.json（MASTERS-INDEX.md が source of truth）。
// 留学生で要件が変わる学部(国際日本=トラック別 / 総合数理=総合教育のみ可変)は byResidency / minUnitsRyugakusei で保持。

export interface FZone {
  id: string;
  nameJa: string;
  minUnits: number;
  minUnitsRyugakusei?: number; // 留学生で最低単位が異なる区分（総合数理の総合教育 等）
  hintJa?: string;
}

export interface FDept {
  id: string;
  nameJa: string;
  zones: FZone[];
}

export interface FBand {
  key: string;
  labelJa: string;
  admissionYearMax: number | null; // この年度以前に適用（null=下限なし/最新）
  totalRequired: number;
  zones?: FZone[];
  byDepartment?: FDept[];
  byResidency?: { ryugakusei: FZone[]; domestic: FZone[] };
}

export interface Faculty {
  id: string;
  nameJa: string;
  schoolDomain: string;
  engine: "commerce" | "zones";
  deptLabel?: string;          // "学科" / "専攻"
  residencyVariable?: boolean; // 留学生トグルを表示
  match: RegExp;               // プロフィールの学部(自由記述)から自動判定
  bands: FBand[];
  // zoneはbyDepartmentでないが、CAN(配当表)の学科別フィルタ用に学科を持つ場合（経営=学科専門の所属学科）
  canDepartments?: { id: string; nameJa: string }[];
}

export const MEIJI = "meiji.ac.jp";

// freezone(自由選択)の判定: 超過分の受け皿になる区分
export function isFreeZone(id: string): boolean {
  return /freezone|jiyu/i.test(id);
}

// ---- 理工学部: 共通区分 + 学科別(理系基礎/専門/自由) を合成 ----
const RIKO_COMMON: FZone[] = [
  { id: "sogo-bunka", nameJa: "総合文化科目", minUnits: 8 },
  { id: "kenko-sports", nameJa: "健康・スポーツ学科目", minUnits: 2 },
  { id: "gaikokugo", nameJa: "外国語科目", minUnits: 14, hintJa: "第1外国語8(留学生は日本語8) + 第2外国語6" },
];
function rikoDept(id: string, nameJa: string, riskeiKiso: number, senmon: number, free: number): FDept {
  return {
    id, nameJa,
    zones: [
      ...RIKO_COMMON,
      { id: "riskei-kiso", nameJa: "理系基礎科目", minUnits: riskeiKiso },
      { id: "senmon", nameJa: "専門教育科目", minUnits: senmon },
      { id: "freezone", nameJa: "自由選択ほか", minUnits: free, hintJa: "各区分の超過分・他学科/他学部科目など" },
    ],
  };
}

// ---- 商学部(配当表まで整備済み=既存エンジン)。選択UI用のラベルのみ。実計算は graduationMaster.ts ----
const commerce: Faculty = {
  id: "commerce", nameJa: "商学部", schoolDomain: MEIJI, engine: "commerce",
  match: /商学|商學|commerce/i,
  bands: [
    { key: "pre2023", labelJa: "〜2022年度入学", admissionYearMax: 2022, totalRequired: 134 },
    { key: "from2023", labelJa: "2023年度〜入学", admissionYearMax: null, totalRequired: 126 },
  ],
};

const law: Faculty = {
  id: "law", nameJa: "法学部", schoolDomain: MEIJI, engine: "zones",
  match: /法学|法學|law/i,
  bands: [{
    key: "2026", labelJa: "2026年度〜入学", admissionYearMax: null, totalRequired: 128,
    zones: [
      { id: "kiso", nameJa: "基礎科目群", minUnits: 6 },
      { id: "kyoyo", nameJa: "教養科目群", minUnits: 12 },
      { id: "gaikokugo", nameJa: "外国語科目群", minUnits: 16 },
      { id: "hoken", nameJa: "保健体育科目群", minUnits: 2 },
      { id: "horitsu", nameJa: "法律必修科目群", minUnits: 24 },
      { id: "enshu", nameJa: "演習科目群", minUnits: 8 },
      { id: "course", nameJa: "コース科目群（5コース）", minUnits: 44 },
      { id: "freezone", nameJa: "自由選択科目群", minUnits: 16 },
    ],
  }],
};

const politicaleconomics: Faculty = {
  id: "politicaleconomics", nameJa: "政治経済学部", schoolDomain: MEIJI, engine: "zones",
  deptLabel: "学科", match: /政治経済|政経|政治|経済学部/i,
  bands: [{
    key: "2026", labelJa: "2026年度〜入学", admissionYearMax: null, totalRequired: 124,
    zones: [
      { id: "kiso", nameJa: "基礎科目", minUnits: 28 },
      { id: "gaikokugo", nameJa: "外国語科目", minUnits: 16 },
      { id: "kenko", nameJa: "健康・運動科学科目", minUnits: 4 },
      { id: "kihonouyou", nameJa: "基本・応用科目（所属学科関係）", minUnits: 42 },
      { id: "freezone", nameJa: "専門研究・自由選択ほか", minUnits: 34 },
    ],
  }],
};

const literature: Faculty = {
  id: "literature", nameJa: "文学部", schoolDomain: MEIJI, engine: "zones",
  deptLabel: "学科", match: /文学部|文學部/,
  bands: [{
    key: "2026", labelJa: "2026年度便覧", admissionYearMax: null, totalRequired: 124,
    byDepartment: [
      { id: "bungaku", nameJa: "文学科", zones: [
        { id: "senko-hisshu", nameJa: "専攻必修科目", minUnits: 38 },
        { id: "gaikokugo", nameJa: "外国語科目", minUnits: 16 },
        { id: "wellness", nameJa: "ウェルネス科目", minUnits: 4 },
        { id: "sentaku", nameJa: "選択科目", minUnits: 66 },
      ]},
      { id: "shigaku-chiri", nameJa: "史学地理学科", zones: [
        { id: "senko-hisshu", nameJa: "専攻必修科目", minUnits: 32 },
        { id: "gaikokugo", nameJa: "外国語科目", minUnits: 12 },
        { id: "wellness", nameJa: "ウェルネス科目", minUnits: 4 },
        { id: "sentaku", nameJa: "選択科目", minUnits: 76 },
      ]},
    ],
  }],
};

const scienceEngineering: Faculty = {
  id: "science-engineering", nameJa: "理工学部", schoolDomain: MEIJI, engine: "zones",
  deptLabel: "学科・専攻", match: /理工/,
  bands: [{
    key: "2025", labelJa: "2025年度〜入学", admissionYearMax: null, totalRequired: 136,
    byDepartment: [
      rikoDept("ee-ee", "電気電子生命学科 電気電子工学専攻", 32, 72, 8),
      rikoDept("ee-life", "電気電子生命学科 生命理工学専攻", 36, 67, 9),
      rikoDept("mech", "機械工学科", 28, 76, 8),
      rikoDept("mech-info", "機械情報工学科", 30, 78, 4),
      rikoDept("arch", "建築学科", 20, 82, 10),
      rikoDept("applied-chem", "応用化学科", 28, 80, 4),
      rikoDept("info-sci", "情報科学科", 24, 76, 12),
      rikoDept("math", "数学科", 20, 72, 20),
      rikoDept("physics", "物理学科", 24, 80, 8),
    ],
  }],
};

const agriculture: Faculty = {
  id: "agriculture", nameJa: "農学部", schoolDomain: MEIJI, engine: "zones",
  deptLabel: "学科", match: /農学|農芸|農業/,
  bands: [{
    key: "2026", labelJa: "2026年度便覧", admissionYearMax: null, totalRequired: 124,
    byDepartment: [
      { id: "nogaku", nameJa: "農学科", zones: [
        { id: "kiso", nameJa: "基礎科目群", minUnits: 24 },
        { id: "senko", nameJa: "専攻科目群", minUnits: 50 },
        { id: "kyoyo", nameJa: "教養科目群", minUnits: 6 },
        { id: "kyotsu-senmon", nameJa: "共通専門科目群", minUnits: 3 },
        { id: "gaikokugo", nameJa: "外国語科目群", minUnits: 12 },
        { id: "hoken", nameJa: "保健・体育科目群", minUnits: 3 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 26 },
      ]},
      { id: "nogei-kagaku", nameJa: "農芸化学科", zones: [
        { id: "kiso", nameJa: "基礎科目群", minUnits: 32 },
        { id: "senko", nameJa: "専攻科目群", minUnits: 50 },
        { id: "kyoyo", nameJa: "教養科目群", minUnits: 6 },
        { id: "kyotsu-senmon", nameJa: "共通専門科目群", minUnits: 3 },
        { id: "gaikokugo", nameJa: "外国語科目群", minUnits: 12 },
        { id: "hoken", nameJa: "保健・体育科目群", minUnits: 3 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 18 },
      ]},
      { id: "seimei-kagaku", nameJa: "生命科学科", zones: [
        { id: "kiso", nameJa: "基礎科目群", minUnits: 24 },
        { id: "senko", nameJa: "専攻科目群", minUnits: 50 },
        { id: "kyoyo", nameJa: "教養科目群", minUnits: 6 },
        { id: "kyotsu-senmon", nameJa: "共通専門科目群", minUnits: 3 },
        { id: "gaikokugo", nameJa: "外国語科目群", minUnits: 12 },
        { id: "hoken", nameJa: "保健・体育科目群", minUnits: 3 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 26 },
      ]},
      { id: "shokuryo-kankyo", nameJa: "食料環境政策学科", zones: [
        { id: "kiso", nameJa: "基礎科目群", minUnits: 24 },
        { id: "senko1", nameJa: "専攻科目Ⅰ", minUnits: 18 },
        { id: "senko2", nameJa: "専攻科目Ⅱ", minUnits: 20 },
        { id: "kyoyo", nameJa: "教養科目群", minUnits: 6 },
        { id: "kyotsu-senmon", nameJa: "共通専門科目群", minUnits: 3 },
        { id: "gaikokugo", nameJa: "外国語科目群", minUnits: 12 },
        { id: "hoken", nameJa: "保健・体育科目群", minUnits: 3 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 38 },
      ]},
    ],
  }],
};

const management: Faculty = {
  id: "management", nameJa: "経営学部", schoolDomain: MEIJI, engine: "zones",
  deptLabel: "学科", match: /経営/,
  canDepartments: [
    { id: "経営学科", nameJa: "経営学科" },
    { id: "会計学科", nameJa: "会計学科" },
    { id: "公共経営学科", nameJa: "公共経営学科" },
  ],
  bands: [{
    key: "2017", labelJa: "2017〜2020年度入学", admissionYearMax: 2020, totalRequired: 134,
    zones: [
      { id: "gakubu-hisshu", nameJa: "学部必修科目", minUnits: 12 },
      { id: "kyoyo", nameJa: "教養科目", minUnits: 24 },
      { id: "gaikokugo", nameJa: "外国語科目", minUnits: 16 },
      { id: "taiiku", nameJa: "体育実技科目", minUnits: 2 },
      { id: "gaikokugo-senmon", nameJa: "外国語専門科目", minUnits: 4 },
      { id: "kiso-senmon", nameJa: "基礎専門科目", minUnits: 14 },
      { id: "gakka-hisshu", nameJa: "学科必修科目", minUnits: 8 },
      { id: "gakka-senmon", nameJa: "学科専門科目", minUnits: 24 },
      { id: "freezone", nameJa: "自由履修科目", minUnits: 30 },
    ],
  }],
};

const infoCommunication: Faculty = {
  id: "info-communication", nameJa: "情報コミュニケーション学部", schoolDomain: MEIJI, engine: "zones",
  match: /情報コミュ|情コミ|情報コミュニケーション/,
  bands: [{
    key: "2017", labelJa: "2017年度〜入学", admissionYearMax: null, totalRequired: 124,
    zones: [
      { id: "gakusai", nameJa: "学際科目群", minUnits: 4 },
      { id: "senmon", nameJa: "専門科目群", minUnits: 64, hintJa: "社会科学4・人文科学4・自然科学2を含め64以上" },
      { id: "gaikokugo", nameJa: "外国語科目群", minUnits: 10 },
      { id: "kenkyu-hyogen", nameJa: "研究方法・表現実践科目群", minUnits: 10 },
      { id: "jiyu", nameJa: "自由に選択できる科目", minUnits: 36 },
    ],
  }],
};

const globalJapanese: Faculty = {
  id: "global-japanese", nameJa: "国際日本学部", schoolDomain: MEIJI, engine: "zones",
  residencyVariable: true, match: /国際日本|グローバル.*日本/,
  bands: [{
    key: "2026", labelJa: "2026年度便覧", admissionYearMax: null, totalRequired: 124,
    byResidency: {
      ryugakusei: [
        { id: "eigo", nameJa: "英語（選択必修）", minUnits: 14 },
        { id: "gakujutsu-nihongo", nameJa: "学術日本語Ⅰ〜Ⅲ（必修）", minUnits: 6 },
        { id: "senmon", nameJa: "国際日本学専門科目", minUnits: 50 },
        { id: "sogo-kyoiku-hisshu", nameJa: "総合教育科目（必修）", minUnits: 5 },
        { id: "sogo-kyoiku-sentaku", nameJa: "総合教育科目（選択必修）", minUnits: 8 },
        { id: "jiyu", nameJa: "自由選択科目", minUnits: 41 },
      ],
      domestic: [
        { id: "eigo", nameJa: "英語（必修）", minUnits: 22 },
        { id: "senmon", nameJa: "国際日本学専門科目", minUnits: 50 },
        { id: "sogo-kyoiku-hisshu", nameJa: "総合教育科目（必修）", minUnits: 5 },
        { id: "sogo-kyoiku-sentaku", nameJa: "総合教育科目（選択必修）", minUnits: 8 },
        { id: "jiyu", nameJa: "自由選択科目", minUnits: 39 },
      ],
    },
  }],
};

const interdisciplinaryMath: Faculty = {
  id: "interdisciplinary-math", nameJa: "総合数理学部", schoolDomain: MEIJI, engine: "zones",
  deptLabel: "学科", residencyVariable: true, match: /総合数理|現象数理|先端メディア|ネットワークデザイン/,
  bands: [{
    key: "2026", labelJa: "2026年度便覧", admissionYearMax: null, totalRequired: 124,
    byDepartment: [
      { id: "genshosuri-tokei", nameJa: "現象数理統計学科", zones: [
        { id: "sogo-kyoiku", nameJa: "総合教育科目", minUnits: 18, minUnitsRyugakusei: 20 },
        { id: "kiso-kyoiku", nameJa: "基礎教育科目", minUnits: 32 },
        { id: "senmon-kyoiku", nameJa: "専門教育科目", minUnits: 66 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 8, minUnitsRyugakusei: 6 },
      ]},
      { id: "sentan-media", nameJa: "先端メディアサイエンス学科", zones: [
        { id: "sogo-kyoiku", nameJa: "総合教育科目", minUnits: 18, minUnitsRyugakusei: 20 },
        { id: "kiso-kyoiku", nameJa: "基礎教育科目", minUnits: 28 },
        { id: "senmon-kyoiku", nameJa: "専門教育科目", minUnits: 72 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 6, minUnitsRyugakusei: 4 },
      ]},
      { id: "network-design", nameJa: "ネットワークデザイン学科", zones: [
        { id: "sogo-kyoiku", nameJa: "総合教育科目", minUnits: 18, minUnitsRyugakusei: 20 },
        { id: "kiso-kyoiku", nameJa: "基礎教育科目", minUnits: 30 },
        { id: "senmon-kyoiku", nameJa: "専門教育科目", minUnits: 61 },
        { id: "freezone", nameJa: "自由選択ほか", minUnits: 15, minUnitsRyugakusei: 13 },
      ]},
    ],
  }],
};

export const FACULTIES: Faculty[] = [
  commerce, law, politicaleconomics, literature, scienceEngineering,
  agriculture, management, infoCommunication, globalJapanese, interdisciplinaryMath,
];

export function facultyById(id: string): Faculty | null {
  return FACULTIES.find((f) => f.id === id) ?? null;
}

// プロフィールの学部(自由記述)から学部を推定。未設定/不一致は null。
export function facultyFromDept(dept: string | null): Faculty | null {
  if (!dept || !dept.trim()) return null;
  return FACULTIES.find((f) => f.match.test(dept)) ?? null;
}

// 入学年度からバンドを選ぶ（admissionYearMax 昇順で最初に収まるもの。null=最新）。
export function bandForAdmissionYear(f: Faculty, year: number | null): FBand {
  if (year != null) {
    const sorted = [...f.bands].sort((a, b) => {
      const av = a.admissionYearMax ?? Infinity;
      const bv = b.admissionYearMax ?? Infinity;
      return av - bv;
    });
    for (const b of sorted) {
      if (b.admissionYearMax == null || year <= b.admissionYearMax) return b;
    }
  }
  return f.bands[f.bands.length - 1];
}

export interface ResolvedMaster {
  totalRequired: number;
  zones: { id: string; nameJa: string; minUnits: number; hintJa?: string }[];
}

// (学部・学科・留学生) から診断用のフラットな区分リストを得る（engine="zones"用）。
export function resolveZones(
  band: FBand, deptId: string | null, isRyugakusei: boolean,
): ResolvedMaster {
  let zs: FZone[];
  if (band.byResidency) {
    zs = isRyugakusei ? band.byResidency.ryugakusei : band.byResidency.domestic;
  } else if (band.byDepartment && band.byDepartment.length > 0) {
    const d = band.byDepartment.find((x) => x.id === deptId) ?? band.byDepartment[0];
    zs = d.zones;
  } else {
    zs = band.zones ?? [];
  }
  return {
    totalRequired: band.totalRequired,
    zones: zs.map((z) => ({
      id: z.id, nameJa: z.nameJa, hintJa: z.hintJa,
      minUnits: isRyugakusei && z.minUnitsRyugakusei != null ? z.minUnitsRyugakusei : z.minUnits,
    })),
  };
}
