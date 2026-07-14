import { Tabs } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function TabsLayout() {
  const { theme } = useTheme();

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
      <Tabs.Screen name="index" options={{ title: "ホーム", headerShown: false }} />
      <Tabs.Screen name="boards" options={{ title: "掲示板", headerShown: false }} />
      <Tabs.Screen name="friends" options={{ title: "友達", headerShown: false }} />
      <Tabs.Screen name="messages" options={{ title: "メッセージ", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "プロフィール" }} />
    </Tabs>
  );
}
