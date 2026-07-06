// key: "Day-Period" (e.g. "木-1"), value: friend IDs who share that class
export const MOCK_FRIEND_OVERLAPS: Record<string, string[]> = {
  "木-1": ["1", "5"],        // 商品学A: りく, あお
  "水-3": ["2", "6", "7"],   // レジャービジネス論: さくらもち, かいと, なな
  "木-4": ["3"],             // 商学専門演習: ゆうたろう
  "木-5": ["5", "8"],        // 流通システム論B: あお, まなと
};

export const FRIEND_BADGE_COLORS: Record<string, string> = {
  "1": "#FF6B6B",
  "2": "#FF9F43",
  "3": "#10AC84",
  "4": "#5F27CD",
  "5": "#2E86DE",
  "6": "#54A0FF",
  "7": "#FF6B81",
  "8": "#1DD1A1",
};
