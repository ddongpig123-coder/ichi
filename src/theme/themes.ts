// 앱 전체 테마 토큰 정의 (Claude Design 시안 기반, 2026-07-12)
// 테마 추가 시 이 파일에 토큰 세트만 추가하면 됨 — 화면 코드는 useTheme() 경유로 자동 반영

export type ThemeId = "sky" | "washi" | "soda" | "akane" | "midnight" | "sumire";

export interface Theme {
  id: ThemeId;
  label: string;   // 앱에 표시되는 일본어 이름
  dark: boolean;
  primary: string;
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;        // 좋아요·알림 강조색
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  timetableCells: string[]; // 과목 자동 배정용 8색
}

export const THEMES: Record<ThemeId, Theme> = {
  // 기존 파랑 디자인 그대로 — 기본값
  sky: {
    id: "sky",
    label: "スカイ",
    dark: false,
    primary: "#2F6AD9",
    background: "#F5F7FA",
    card: "#FFFFFF",
    textPrimary: "#1A1A2E",
    textSecondary: "#888888",
    border: "#E8E8E8",
    accent: "#E8334A",
    tabBarBackground: "#FFFFFF",
    tabBarActive: "#2F6AD9",
    tabBarInactive: "#8E8E93",
    timetableCells: ["#D6E4FF", "#FFE1E1", "#D9F3DC", "#FFF3C4", "#EDE3FF", "#FFE0F0", "#D9F0F5", "#FFECD1"],
  },
  washi: {
    id: "washi",
    label: "ワシ",
    dark: false,
    primary: "#7A6A50",
    background: "#F5F2EC",
    card: "#FFFFFF",
    textPrimary: "#26231E",
    textSecondary: "#8B857A",
    border: "#E7E2D8",
    accent: "#C45B4D",
    tabBarBackground: "#FBFAF6",
    tabBarActive: "#26231E",
    tabBarInactive: "#A39C8E",
    timetableCells: ["#E7E0D2", "#DCE3D8", "#E3DDE7", "#DBE2E8", "#EDE0D4", "#E6E6DA", "#E8DCD8", "#D9E4E0"],
  },
  soda: {
    id: "soda",
    label: "ソーダ",
    dark: false,
    primary: "#0FAF95",
    background: "#F2FAF7",
    card: "#FFFFFF",
    textPrimary: "#16342E",
    textSecondary: "#7FA097",
    border: "#EAF4EF",
    accent: "#FF6B6B",
    tabBarBackground: "#FFFFFF",
    tabBarActive: "#0FAF95",
    tabBarInactive: "#9DB8AF",
    timetableCells: ["#FFE1E1", "#FFECD1", "#FFF6C4", "#D9F3DC", "#D6EDFF", "#EDE3FF", "#FFE0F0", "#D9F0F5"],
  },
  akane: {
    id: "akane",
    label: "アカネ",
    dark: false,
    primary: "#D9432F",
    background: "#FAF6F0",
    card: "#FFFFFF",
    textPrimary: "#1C1A17",
    textSecondary: "#93897B",
    border: "#EAE3D9",
    accent: "#D9432F",
    tabBarBackground: "#FFFFFF",
    tabBarActive: "#D9432F",
    tabBarInactive: "#ABA294",
    timetableCells: ["#F7DEE3", "#E0EBD1", "#D8E7F3", "#E5DFF2", "#F7E9C7", "#F5DDD1", "#DBEAE0", "#E9E4CF"],
  },
  midnight: {
    id: "midnight",
    label: "ミッドナイト",
    dark: true,
    primary: "#E3A857",
    background: "#131417",
    card: "#1E2024",
    textPrimary: "#ECEAE4",
    textSecondary: "#8E9094",
    border: "#2C2F34",
    accent: "#E36B5C",
    tabBarBackground: "#1A1C20",
    tabBarActive: "#E3A857",
    tabBarInactive: "#6B6E74",
    timetableCells: ["#503A44", "#4A3E2E", "#2F4A3A", "#2E3F55", "#463455", "#4A2F2F", "#2F4649", "#45452E"],
  },
  sumire: {
    id: "sumire",
    label: "スミレ",
    dark: false,
    primary: "#7C6BC9",
    background: "#F6F4FA",
    card: "#FFFFFF",
    textPrimary: "#262336",
    textSecondary: "#8B87A0",
    border: "#E9E5F2",
    accent: "#E0567A",
    tabBarBackground: "#FFFFFF",
    tabBarActive: "#7C6BC9",
    tabBarInactive: "#A8A4BC",
    timetableCells: ["#EFE2F6", "#E2E8FA", "#FBE2EE", "#DFF1E8", "#FAEEDA", "#E6E2FA", "#FDEBE0", "#E3F2F5"],
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME_ID: ThemeId = "sky";
