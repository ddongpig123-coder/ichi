import { useEffect, useState } from "react";
import { Tabs, Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { ONBOARDED_KEY } from "../onboarding";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();

  // 初回起動判定: 未オンボーディングならオンボーディング画面へ
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setOnboarded(v === "1"))
      .catch(() => setOnboarded(true)); // 判定不能時はブロックしない
  }, []);

  if (onboarded === null) return null; // フラグ読込中（一瞬）
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: theme.tabBarBackground, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), headerShown: false }} />
      <Tabs.Screen name="boards" options={{ title: t("tabs.boards"), headerShown: false }} />
      <Tabs.Screen name="friends" options={{ title: t("tabs.friends"), headerShown: false }} />
      <Tabs.Screen name="messages" options={{ title: t("tabs.messages"), headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
    </Tabs>
  );
}
