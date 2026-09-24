// 卒業要件マジシャン用「科目→区分」配当表 — 明治大学 商学部・2022年度以前入学者カリキュラム。
// 出典: 2026年度 商学部シラバス1（履修の手引）
//   印刷p57「卒業要件（2022年度以前入学者）」/ p58〜72「授業科目及び担当者一覧表」/ p74「科目名対照表」。
// 2021年度入学者は科目名が一部異なる → aliases に旧名を持たせ、どちらの名前でも引けるようにする。
// 旧4単位科目（2020年度以前入学者）は別エントリ（legacy）で保持。
// 用途: 成績表/時間割の科目名から「どの区分に何単位入るか」を判定する（クライアント計算のみ）。
// ※ 参考用。開講・名称・単位は年度で変わりうる。最終確認は便覧・Oh-o! Meijiで。

import type { GradZone } from "./graduationMaster";

export type ZoneId = GradZone["id"]; // kiso / gaikokugo / sogo / hoken / kihon / kikan / freezone

// 総合教育科目の3分野（各4単位以上）
export type SogoSub = "bunka" | "chiiki" | "ningen" | "ryugakusei" | "gakusai";

export type CourseId =
  | "applied-economics"
  | "marketing"
  | "finance-insurance"
  | "global-business"
  | "management"
  | "accounting"
  | "creative-business";

export interface AllocEntry {
  name: string;          // 2022年度以降入学者の科目名（p58〜72の表記）
  aliases?: string[];    // 2021年度以前入学者の旧名（科目名対照表）
  units: number;
  zone: ZoneId | null;   // null = 卒業要件に含まれない（大学院科目など）
  sub?: SogoSub;         // 総合教育の分野
  years: string;         // 配当年次（例 "1-2", "3-4", "1-4"）
  courses?: CourseId[];  // 基幹科目: どのコースの科目か（自コース判定に使う）
  repeatable?: boolean;  // 同名で複数回修得できる（総合学際演習・商学専門演習・外国専門書講読・日本語）
  offered?: false;       // 2026年度「開講せず」（過去の修得判定には影響しない）
  capGroup?: "shikaku";  // 資格課程科目: 8単位まで卒業要件に算入
  legacy?: true;         // 2020年度以前入学者の旧4単位科目
  noteJa?: string;
}

// ── 記述用ヘルパー（名前は "|" 区切り、末尾 "×" = 開講せず） ─────────────
function E(zone: ZoneId | null, years: string, units: number, names: string, extra: Partial<AllocEntry> = {}): AllocEntry[] {
  return names.split("|").map((raw) => {
    const off = raw.endsWith("×");
    const name = off ? raw.slice(0, -1) : raw;
    return { name, units, zone, years, ...(off ? { offered: false as const } : {}), ...extra };
  });
}
// 「〜A|〜B」の対を展開
function AB(base: string, off = false): string {
  return `${base}A${off ? "×" : ""}|${base}B${off ? "×" : ""}`;
}
function ABs(...bases: string[]): string {
  return bases.map((b) => AB(b)).join("|");
}

// ── 基礎教育科目（全必修 8） ─────────────────────────────
const KISO = E("kiso", "1", 2, "基礎演習|文章表現|経済学A|経済学B");

// ── 総合教育科目 + 総合学際演習（合計24、3分野各4以上） ─────────
const SOGO: AllocEntry[] = [
  ...E("sogo", "1-2", 2, [ABs("日本文化史", "西洋文化史", "日本語表現論", "日本近代文学", "日本古典文学"), AB("宗教学", true)].join("|"), { sub: "bunka" }),
  ...E("sogo", "3-4", 2, [AB("外国文学（西洋）", true), AB("外国文学（東洋）", true), ABs("芸術（音楽）", "芸術（美術）")].join("|"), { sub: "bunka" }),
  ...E("sogo", "1-2", 2, ABs("法学", "アジア史", "地理学", "社会学", "社会思想史"), { sub: "chiiki" }),
  ...E("sogo", "3-4", 2, [AB("日本思想史", true), ABs("政治学", "人類学")].join("|"), { sub: "chiiki" }),
  ...E("sogo", "1-2", 2, ABs("哲学", "自然科学概論", "生命科学", "線型数学", "解析数学", "化学", "言語学", "論理学", "心理学"), { sub: "ningen" }),
  ...E("sogo", "3-4", 2, ABs("物理学", "環境科学"), { sub: "ningen" }),
  // 外国人留学生のための科目: 8単位まで総合教育に算入可（留学生のみ）
  ...E("sogo", "1-2", 2, "日本事情A|日本事情B×|日本事情C×|日本事情D×|日本事情E|日本事情F×", {
    sub: "ryugakusei",
    noteJa: "留学生のみ。8単位まで総合教育に算入",
  }),
  ...E("sogo", "2-4", 2, "総合学際演習", { sub: "gakusai", repeatable: true }),
];

// ── 外国語科目（必修: 既習8＋初習8） ───────────────────────────
const LANGS = ["ドイツ語", "フランス語", "中国語", "韓国語", "スペイン語", "ロシア語"];
const roman = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ"];
const GAIKOKUGO: AllocEntry[] = [
  ...E("gaikokugo", "1-2", 1, "口語英語Ⅰ|口語英語Ⅱ|英語講読Ⅰ|英語講読Ⅱ|基礎英語Ⅰ|基礎英語Ⅱ|上級英語Ⅰ|上級英語Ⅱ", { noteJa: "既習外国語（英語）必修" }),
  ...LANGS.flatMap((l) => [
    ...E("gaikokugo", "1", 1, roman.map((r) => `初級${l}${r}`).join("|"), { noteJa: "初習外国語 必修" }),
    ...E("gaikokugo", "2", 1, roman.map((r) => `中級${l}${r}`).join("|"), { noteJa: "初習外国語 必修" }),
  ]),
  ...["ドイツ語", "フランス語"].flatMap((l) =>
    E("gaikokugo", "1-2", 1, roman.map((r) => `特別${l}${r}`).join("|"), { noteJa: "初習外国語 必修" }),
  ),
  ...E("gaikokugo", "1-2", 1, "日本語", { repeatable: true, noteJa: "留学生のみ。初習外国語8単位の代替" }),
];

// 選択外国語 → 要件単位を超える扱いでフリーゾーン
const GAIKOKUGO_ELECTIVE: AllocEntry[] = [
  ...E("freezone", "3-4", 1, "発展英語"),
  ...["ドイツ語", "フランス語", "中国語", "韓国語"].flatMap((l) => [
    ...E("freezone", "1", 1, `初級${l}プラスワン`),
    ...E("freezone", "2", 1, `中級${l}プラスワン`),
    ...E("freezone", "3-4", 1, `上級${l}|発展${l}`),
  ]),
  ...E("freezone", "2", 1, "初級スペイン語プラスワン×|中級スペイン語プラスワン×"),
  ...E("freezone", "3-4", 1, "上級スペイン語|発展スペイン語×"),
];

// ── 保健体育科目（必修2、選択はフリーゾーン） ──────────────────
const HOKEN: AllocEntry[] = [
  ...E("hoken", "1", 1, "体育・スポーツ実習A|体育・スポーツ実習B"),
  ...E("freezone", "2", 1, "選択スポーツ実習"),
  ...E("freezone", "2-4", 1, "選択集中スポーツ実習"),
  ...E("freezone", "1-2", 2, "スポーツとグローバリゼーション|スポーツと健康"),
];

// ── 基本科目（16） ──────────────────────────────────────
const KIHON: AllocEntry[] = [
  ...E("kihon", "1-2", 2, "ミクロ経済学|マクロ経済学|" + ABs("理論経済学")),
  { name: "経済史A", aliases: ["欧米経済史"], units: 2, zone: "kihon", years: "1-2" },
  { name: "経済史B", aliases: ["アジア経済史"], units: 2, zone: "kihon", years: "1-2" },
  ...E("kihon", "1-2", 2, ABs("商業総論", "経営学総論", "簿記学", "会計学総論", "統計学", "金融総論", "貿易総論")),
];

// ── 基幹科目（自コース28＋他コース・演習で48） ─────────────────
// コース別一覧（p64〜70）。複数コースに出てくる科目は courses に全コースを持たせる。
const COURSE_LISTS: Record<CourseId, string> = {
  "applied-economics":
    ABs("経済政策論") + "|公共経済学|財政学|" +
    ABs("中小企業論", "産業組織論", "国際経済学") + "|" + AB("日本経済論", true) + "|" +
    ABs("環境経済学", "計量経済学", "金融論", "国際金融論", "貿易論", "世界経済論", "労使関係論") +
    "|企業論|日本経営史|" + ABs("公益事業論", "経営情報システム論") +
    "|企業と環境問題|中国政治経済論|東南アジア政治経済論|産業立地論|" + ABs("経済予測入門") +
    "|地域経済論A|地域経済論B",
  marketing:
    ABs("商業経営論", "マーケティング管理論", "市場調査論", "広告論", "インダストリアルマーケティング論",
      "商品学", "流通史", "消費者行動論", "マーケティング企画", "交通論", "物的流通論", "国際交通論",
      "都市・地域交通論", "公益事業論", "観光事業論", "産業組織論", "情報管理論", "国際マーケティング論",
      "流通システム論", "クリエイティブ・マーケティング論"),
  "finance-insurance":
    ABs("金融論") + "|" + AB("コーポレート・ファイナンス", true) + "|" +
    ABs("金融機関論", "国際金融論", "金融取引論", "証券市場論", "機関投資家論", "保険学", "損害保険論") +
    "|生命保険論|" + ABs("社会保障論", "保険リスクマネジメント論", "会計情報論", "ベンチャー・ファイナンス"),
  "global-business":
    ABs("貿易論", "国際マーケティング論", "貿易商務論", "貿易政策論", "ビジネス英語", "バーバル・ビジネス英語",
      "国際ビジネス交渉論") +
    "|北米地域市場論|欧州地域市場論|中南米地域市場論|アジア・太平洋地域市場論|" +
    ABs("世界経済論", "国際経済学", "国際金融論", "国際交通論", "物的流通論", "国際経営論"),
  management:
    ABs("経営戦略論", "生産管理論", "情報管理論", "経営情報システム論") +
    "|経営組織論|経営労務論|" + ABs("労使関係論") +
    "|経営管理論|産業心理学|経営哲学|経営倫理|企業論|日本経営史|" +
    ABs("国際経営論", "保険リスクマネジメント論", "企業評価論", "企業と倫理") +
    "|ベンチャービジネス論|" + ABs("クリエイティブ・マーケティング論", "ファッション・ビジネス論"),
  accounting:
    ABs("財務会計論", "原価計算論", "意思決定会計論", "業績管理会計論", "監査論", "経営分析論", "税務会計論",
      "国際会計論", "会計情報論", "企業評価論", "企業法", "租税法") +
    "|" + AB("コーポレート・ファイナンス", true) + "|" + ABs("金融取引論", "実践会計論"),
  "creative-business":
    "異文化間コミュニケーション論|バイオテクノロジーとバイオビジネス|" + ABs("企業と倫理") +
    "|企業と環境問題|メディアとリテラシー|中国政治経済論|東南アジア政治経済論|スポーツビジネス論|" +
    "レジャービジネス論|産業立地論|" +
    ABs("経済予測入門", "流通システム論", "ベンチャー・ファイナンス", "eービジネス", "ビジネス法務") +
    "|ベンチャービジネス論|" +
    ABs("実践会計論", "クリエイティブ・マーケティング論", "ファッション・ビジネス論", "消費者行動論",
      "ビジネス英語", "経営戦略論", "企業評価論"),
};

// 科目名対照表（p74）: 2022年度以降名 → 2021年度入学者名
const ALIASES_2021: Record<string, string[]> = {
  経営管理論: ["産業心理学A"],
  産業心理学: ["産業心理学B"],
  企業論: ["日本経営史A"],
  日本経営史: ["日本経営史B"],
};

const COURSE_NOTES: Record<string, string> = {
  地域経済論A: "2021年度便覧のみ掲載（2026年度一覧には無し）",
  地域経済論B: "2021年度便覧のみ掲載（2026年度一覧には無し）",
};

function buildKikan(): AllocEntry[] {
  const map = new Map<string, AllocEntry>();
  (Object.keys(COURSE_LISTS) as CourseId[]).forEach((cid) => {
    COURSE_LISTS[cid].split("|").forEach((raw) => {
      const off = raw.endsWith("×");
      const name = off ? raw.slice(0, -1) : raw;
      const cur = map.get(name);
      if (cur) {
        cur.courses!.push(cid);
        return;
      }
      map.set(name, {
        name,
        units: 2,
        zone: "kikan",
        years: "3-4",
        courses: [cid],
        ...(off ? { offered: false as const } : {}),
        ...(ALIASES_2021[name] ? { aliases: ALIASES_2021[name] } : {}),
        ...(COURSE_NOTES[name] ? { noteJa: COURSE_NOTES[name] } : {}),
      });
    });
  });
  return [...map.values()];
}

const ALL_COURSES: CourseId[] = Object.keys(COURSE_LISTS) as CourseId[];

const KIKAN: AllocEntry[] = [
  ...buildKikan(),
  // 各コース共通。自コースの外国専門書講読（春・秋 各2）4単位は必修。
  { name: "外国専門書講読", units: 2, zone: "kikan", years: "3", courses: ALL_COURSES, repeatable: true, noteJa: "自コース分4単位（春・秋）必修" },
  // 商学専門演習: 自コース/他コースは担当教員の所属で決まる（ここでは区別しない）
  { name: "商学専門演習", units: 2, zone: "kikan", years: "2-4", repeatable: true, noteJa: "自/他コースは担当教員の所属による" },
];

// 2020年度以前入学者の旧4単位科目（対照表 *3〜*10, *17〜*20）と旧名（*11, *12）
const LEGACY: AllocEntry[] = [
  { name: "広告論", units: 4, zone: "kikan", years: "3-4", courses: ["marketing"], legacy: true },
  { name: "インダストリアルマーケティング論", units: 4, zone: "kikan", years: "3-4", courses: ["marketing"], legacy: true },
  { name: "流通史", units: 4, zone: "kikan", years: "3-4", courses: ["marketing"], legacy: true },
  { name: "消費者行動論", units: 4, zone: "kikan", years: "3-4", courses: ["marketing", "creative-business"], legacy: true },
  { name: "経済予測入門", units: 4, zone: "kikan", years: "3-4", courses: ["applied-economics", "creative-business"], legacy: true },
  { name: "ベンチャー・ファイナンス", units: 4, zone: "kikan", years: "3-4", courses: ["finance-insurance", "creative-business"], legacy: true },
  { name: "経営労務論A", units: 2, zone: "kikan", years: "3-4", courses: ["management"], legacy: true, noteJa: "現・経営組織論" },
  { name: "経営労務論B", units: 2, zone: "kikan", years: "3-4", courses: ["management"], legacy: true, noteJa: "現・経営労務論" },
];

// ── 応用展開科目・その他・資格課程（すべてフリーゾーンへ） ─────────
const OYO: AllocEntry[] = [
  ...E("freezone", "1", 2, "総合講座（商学入門）|総合講座A（フューチャースキル講座）"),
  ...E("freezone", "1-2", 2, "総合講座（商学研究入門）|会計特殊講義A|会計特殊講義B"),
  ...E("freezone", "1-4", 2, "総合講座A|総合講座B|総合講座C|総合講座D|Essentials of Commerce A|Essentials of Commerce B"),
  ...E("freezone", "3-4", 2, "Applied Commerce A|Applied Commerce B", { noteJa: "事前申請で基幹英語として認定される場合あり" }),
  ...E("freezone", "1-4", 2, "特別テーマ実践科目A|特別テーマ実践科目B|特別テーマ実践科目C|特別テーマ実践科目D"),
  ...E("freezone", "1-4", 2, "特別テーマ研究科目A|特別テーマ研究科目B|特別テーマ研究科目C|特別テーマ研究科目D|特別テーマ研究科目E×|特別テーマ研究科目F×"),
  ...E("freezone", "1-4", 2, "特別テーマ海外研修科目A×|特別テーマ海外研修科目B|特別テーマ海外研修科目C|特別テーマ海外研修科目D×"),
  ...E("freezone", "1-4", 2, ABs("地域活性化システム論")),
  ...E("freezone", "3-4", 2, AB("外国文化・言語特殊講義", true)),
  ...E("freezone", "3", 2, "ジョブ・インターンシップ×"),
];

const SONOTA: AllocEntry[] = [
  ...E("freezone", "1-2", 2, ABs("憲法")),
  ...E("freezone", "3-4", 2, ABs("民法", "商法", "労働法")),
  ...E("freezone", "1-4", 2,
    "ICTエレメンタリー|ICTベーシックⅠ|ICTベーシックⅡ|ICT統計解析Ⅰ|ICT統計解析Ⅱ|ICTデータベースⅠ|ICTデータベースⅡ|" +
    "ICTメディア編集Ⅰ|ICTメディア編集Ⅱ|ICTアプリ開発Ⅰ|ICTアプリ開発Ⅱ|ICTコンテンツデザインⅠ|ICTコンテンツデザインⅡ|" +
    "ICT総合実践Ⅰ|ICT総合実践Ⅱ"),
];

const SHIKAKU: AllocEntry[] = E("freezone", "1-4", 2,
  "日本史概論|東洋史概論|西洋史概論|人文地理学概論|自然地理学概論|地誌学概論|法律学概論|政治学概論|哲学概論|倫理学概論|職業指導",
  { capGroup: "shikaku", noteJa: "資格課程対象者のみ。8単位まで卒業要件に算入" },
);

export const MEIJI_COMMERCE_PRE2023_ALLOCATION: AllocEntry[] = [
  ...KISO, ...SOGO, ...GAIKOKUGO, ...GAIKOKUGO_ELECTIVE, ...HOKEN, ...KIHON,
  ...KIKAN, ...LEGACY, ...OYO, ...SONOTA, ...SHIKAKU,
];

// 一覧に個別科目が載っていない区分（利用者が手動で区分を選ぶ）
// 他学部履修科目・学部間共通外国語・グローバル人材育成プログラム等 → フリーゾーン
// 大学院科目 → 卒業要件に含まれない

// ── 検索 ─────────────────────────────────────────────
// 表記ゆれ吸収: 全角/半角(NFKC)・空白・各種ダッシュ・メディア授業の〔M〕・注記(*N)。
export function normalizeSubjectName(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[〔\[]M[〕\]]\s*$/i, "")
    .replace(/\(\*\d+\)/g, "")
    .replace(/[‐‑‒–—―−ｰ-]/g, "ー")
    .replace(/\s+/g, "");
}

const INDEX: Map<string, AllocEntry> = (() => {
  const m = new Map<string, AllocEntry>();
  const put = (k: string, e: AllocEntry) => {
    const key = normalizeSubjectName(k);
    if (!m.has(key)) m.set(key, e);
  };
  MEIJI_COMMERCE_PRE2023_ALLOCATION.forEach((e) => {
    put(e.name, e);
    e.aliases?.forEach((a) => put(a, e));
  });
  return m;
})();

export interface SubjectClassification {
  entry: AllocEntry;
  zone: ZoneId | null;
  units: number;
  ownCourse: boolean | null; // 基幹科目のみ: 自コース科目か（コース未選択・演習は null）
}

// 科目名 → 区分・単位。見つからなければ null（利用者に区分を選んでもらう）。
// 完全一致がなければ末尾の（…）を外して再検索（時間割のクラス表記「簿記学A（1組）」等）。
export function classifySubject(name: string, ownCourseId: CourseId | null): SubjectClassification | null {
  const key = normalizeSubjectName(name);
  const entry = INDEX.get(key) ?? INDEX.get(key.replace(/\([^()]*\)$/, ""));
  if (!entry) return null;
  let ownCourse: boolean | null = null;
  if (entry.zone === "kikan" && entry.courses && ownCourseId) {
    ownCourse = entry.courses.includes(ownCourseId);
  }
  return { entry, zone: entry.zone, units: entry.units, ownCourse };
}
