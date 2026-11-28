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
// 🆕 2026-11-28: 便覧（卒業要件データ）がなくても学校を一気に増やす（準熙）。
//    domain は schools/{domain} のパス鍵 = 掲示板の単位。規則に学校の許可リストは無い（64文字以下なら可）ので
//    ここに足すだけで OTA で出る。卒業要件・講義データは無い学校がほとんど → 卒業要件画面で「便覧を送ってください」。
//    domain は各大学の公式サイトのドメイン（.ac.jp）。後から変えると既存ユーザーの掲示板が分かれるので変えないこと
const FIRST_SCHOOLS: School[] = [
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

// 2026-11-28 追加分（地域ごと）
const MORE_SCHOOLS: School[] = [
  // 首都圏・私立
  { domain: "rikkyo.ac.jp", nameJa: "立教大学", nameKo: "릿쿄대학" },
  { domain: "aoyama.ac.jp", nameJa: "青山学院大学", nameKo: "아오야마가쿠인대학" },
  { domain: "tus.ac.jp", nameJa: "東京理科大学", nameKo: "도쿄이과대학" },
  { domain: "icu.ac.jp", nameJa: "国際基督教大学（ICU）", nameKo: "국제기독교대학(ICU)" },
  { domain: "gakushuin.ac.jp", nameJa: "学習院大学", nameKo: "가쿠슈인대학" },
  { domain: "toyo.ac.jp", nameJa: "東洋大学", nameKo: "도요대학" },
  { domain: "komazawa-u.ac.jp", nameJa: "駒澤大学", nameKo: "고마자와대학" },
  { domain: "senshu-u.ac.jp", nameJa: "専修大学", nameKo: "센슈대학" },
  { domain: "meijigakuin.ac.jp", nameJa: "明治学院大学", nameKo: "메이지가쿠인대학" },
  { domain: "kokugakuin.ac.jp", nameJa: "國學院大學", nameKo: "고쿠가쿠인대학" },
  { domain: "seikei.ac.jp", nameJa: "成蹊大学", nameKo: "세이케이대학" },
  { domain: "seijo.ac.jp", nameJa: "成城大学", nameKo: "세이조대학" },
  { domain: "musashi.ac.jp", nameJa: "武蔵大学", nameKo: "무사시대학" },
  { domain: "u-tokai.ac.jp", nameJa: "東海大学", nameKo: "도카이대학" },
  { domain: "teikyo-u.ac.jp", nameJa: "帝京大学", nameKo: "데이쿄대학" },
  { domain: "kokushikan.ac.jp", nameJa: "国士舘大学", nameKo: "고쿠시칸대학" },
  { domain: "takushoku-u.ac.jp", nameJa: "拓殖大学", nameKo: "다쿠쇼쿠대학" },
  { domain: "daito.ac.jp", nameJa: "大東文化大学", nameKo: "다이토분카대학" },
  { domain: "asia-u.ac.jp", nameJa: "亜細亜大学", nameKo: "아시아대학" },
  { domain: "tku.ac.jp", nameJa: "東京経済大学", nameKo: "도쿄경제대학" },
  { domain: "soka.ac.jp", nameJa: "創価大学", nameKo: "소카대학" },
  { domain: "obirin.ac.jp", nameJa: "桜美林大学", nameKo: "오비린대학" },
  { domain: "kandagaigo.ac.jp", nameJa: "神田外語大学", nameKo: "간다외어대학" },
  { domain: "jiu.ac.jp", nameJa: "城西国際大学", nameKo: "조사이국제대학" },
  { domain: "u-bunkyo.ac.jp", nameJa: "文京学院大学", nameKo: "분쿄가쿠인대학" },
  { domain: "shibaura-it.ac.jp", nameJa: "芝浦工業大学", nameKo: "시바우라공업대학" },
  { domain: "tcu.ac.jp", nameJa: "東京都市大学", nameKo: "도쿄도시대학" },
  { domain: "jwu.ac.jp", nameJa: "日本女子大学", nameKo: "니혼여자대학" },
  { domain: "twcu.ac.jp", nameJa: "東京女子大学", nameKo: "도쿄여자대학" },
  { domain: "tsuda.ac.jp", nameJa: "津田塾大学", nameKo: "쓰다주쿠대학" },
  // 首都圏・国公立
  { domain: "u-tokyo.ac.jp", nameJa: "東京大学", nameKo: "도쿄대학" },
  { domain: "hit-u.ac.jp", nameJa: "一橋大学", nameKo: "히토쓰바시대학" },
  { domain: "isct.ac.jp", nameJa: "東京科学大学", nameKo: "도쿄과학대학" },
  { domain: "tufs.ac.jp", nameJa: "東京外国語大学", nameKo: "도쿄외국어대학" },
  { domain: "u-gakugei.ac.jp", nameJa: "東京学芸大学", nameKo: "도쿄가쿠게이대학" },
  { domain: "ocha.ac.jp", nameJa: "お茶の水女子大学", nameKo: "오차노미즈여자대학" },
  { domain: "tmu.ac.jp", nameJa: "東京都立大学", nameKo: "도쿄도립대학" },
  { domain: "ynu.ac.jp", nameJa: "横浜国立大学", nameKo: "요코하마국립대학" },
  { domain: "chiba-u.ac.jp", nameJa: "千葉大学", nameKo: "지바대학" },
  { domain: "saitama-u.ac.jp", nameJa: "埼玉大学", nameKo: "사이타마대학" },
  // 関西
  { domain: "kyoto-u.ac.jp", nameJa: "京都大学", nameKo: "교토대학" },
  { domain: "osaka-u.ac.jp", nameJa: "大阪大学", nameKo: "오사카대학" },
  { domain: "kobe-u.ac.jp", nameJa: "神戸大学", nameKo: "고베대학" },
  { domain: "omu.ac.jp", nameJa: "大阪公立大学", nameKo: "오사카공립대학" },
  { domain: "doshisha.ac.jp", nameJa: "同志社大学", nameKo: "도시샤대학" },
  { domain: "kansai-u.ac.jp", nameJa: "関西大学", nameKo: "간사이대학" },
  { domain: "kwansei.ac.jp", nameJa: "関西学院大学", nameKo: "간세이가쿠인대학" },
  { domain: "kindai.ac.jp", nameJa: "近畿大学", nameKo: "긴키대학" },
  { domain: "ryukoku.ac.jp", nameJa: "龍谷大学", nameKo: "류코쿠대학" },
  { domain: "kyoto-su.ac.jp", nameJa: "京都産業大学", nameKo: "교토산업대학" },
  { domain: "kansaigaidai.ac.jp", nameJa: "関西外国語大学", nameKo: "간사이외국어대학" },
  // その他の地域
  { domain: "hokudai.ac.jp", nameJa: "北海道大学", nameKo: "홋카이도대학" },
  { domain: "tohoku.ac.jp", nameJa: "東北大学", nameKo: "도호쿠대학" },
  { domain: "nagoya-u.ac.jp", nameJa: "名古屋大学", nameKo: "나고야대학" },
  { domain: "nanzan-u.ac.jp", nameJa: "南山大学", nameKo: "난잔대학" },
  { domain: "hiroshima-u.ac.jp", nameJa: "広島大学", nameKo: "히로시마대학" },
  { domain: "kyushu-u.ac.jp", nameJa: "九州大学", nameKo: "규슈대학" },
  { domain: "seinan-gu.ac.jp", nameJa: "西南学院大学", nameKo: "세이난가쿠인대학" },
  { domain: "fukuoka-u.ac.jp", nameJa: "福岡大学", nameKo: "후쿠오카대학" },
];

export const SCHOOLS: School[] = [...FIRST_SCHOOLS, ...MORE_SCHOOLS];

// 学校選択の検索: 日本語名・韓国語名・ドメイン（ローマ字: "meiji" 等）のどれかに含まれるか
export function matchSchool(school: School, query: string): boolean {
  const q = query.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const hay = [school.nameJa, school.nameKo, school.domain].map((x) => x.normalize("NFKC").toLowerCase().replace(/\s+/g, ""));
  return hay.some((h) => h.includes(q));
}

export function schoolNameByDomain(domain: string | null, language: "ja" | "ko"): string | null {
  if (!domain) return null;
  const school = SCHOOLS.find((s) => s.domain === domain);
  if (!school) return domain; // 마스터에 없는 도메인은 도메인 그대로 표시
  return language === "ko" ? school.nameKo : school.nameJa;
}
