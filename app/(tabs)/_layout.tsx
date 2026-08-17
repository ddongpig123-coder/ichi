import { useEffect, useState } from "react";
import { Text, type ColorValue } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { ONBOARDED_KEY } from "../onboarding";

// アイコンは使わず文字ラベルのみ。ラベルを tabBarIcon としてアイコンスロット
// （上下・左右中央）に描画し、既定ラベルは非表示にする。
// → 端末でのアイコン豆腐(□)化を回避しつつ、文字が常に中央に来る。
function labelIcon(label: string) {
  return ({ color }: { color: ColorValue }) => (
    <Text numberOfLines={1} style={{ color, fontSize: 11, fontWeight: "600", textAlign: "center" }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

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
        tabBarShowLabel: false, // 既定ラベルは使わず、ラベルは tabBarIcon 側で中央描画
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.border,
          // iPhone のホームインジケータ分(inset)を足しつつ、コンテンツ高は控えめに
          height: 46 + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), headerShown: false, tabBarIcon: labelIcon(t("tabs.home")) }} />
      <Tabs.Screen name="boards" options={{ title: t("tabs.boards"), headerShown: false, tabBarIcon: labelIcon(t("tabs.boards")) }} />
      <Tabs.Screen name="friends" options={{ title: t("tabs.friends"), headerShown: false, tabBarIcon: labelIcon(t("tabs.friends")) }} />
      <Tabs.Screen name="messages" options={{ title: t("tabs.messages"), headerShown: false, tabBarIcon: labelIcon(t("tabs.messages")) }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: labelIcon(t("tabs.profile")) }} />
    </Tabs>
  );
}
