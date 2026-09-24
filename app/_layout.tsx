import { Stack, ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/contexts/AuthContext";
import { BlockProvider } from "../src/contexts/BlockContext";
import { FriendsProvider } from "../src/contexts/FriendsContext";
import { NotificationsProvider } from "../src/contexts/NotificationsContext";
import { I18nProvider } from "../src/contexts/I18nContext";
import { ThemeProvider, useTheme } from "../src/contexts/ThemeContext";

// 앱 테마를 React Navigation 테마에 연결 — 네비게이터 컨테이너 기본 배경(#F2F2F2)을
// 우리 테마 배경으로 덮어써서 다크 모드에서 밝은 테두리가 비치지 않게 한다
// ※ 온보딩 리다이렉트는 (tabs)/_layout에서 처리 (루트는 항상 네비게이터를 렌더해야 함)
function ThemedStack() {
  const { theme } = useTheme();
  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background,
      card: theme.card,
      text: theme.textPrimary,
      border: theme.border,
      primary: theme.primary,
    },
  };
  return (
    <NavThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <BlockProvider>
              <FriendsProvider>
                <NotificationsProvider>
                  <ThemedStack />
                </NotificationsProvider>
              </FriendsProvider>
            </BlockProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
