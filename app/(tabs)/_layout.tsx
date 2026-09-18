import { useEffect, useState, type ReactElement } from "react";
import type { ColorValue } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { ONBOARDED_KEY } from "../onboarding";
import {
  HomeIcon,
  BoardIcon,
  FriendsIcon,
  MessageIcon,
  ProfileIcon,
} from "../../src/components/common/TabBarIcons";

// アイコン＋ラベル（エブリタイム風）。アイコンは単色SVG（react-native-svg）で
// 描画するためフォント依存なし＝実機で豆腐(□)化しない。色はタブのtintを継承し、
// active/inactiveの「明るさ」だけで選択を表す無彩色運用（ブランド色は使わない）。
type TabIcon = (p: { color: ColorValue }) => ReactElement;
function icon(Cmp: (p: { color: ColorValue; size?: number }) => ReactElement): TabIcon {
  return ({ color }) => <Cmp color={color} size={22} />;
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
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 1 },
        tabBarIconStyle: { marginTop: 2 },
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.border,
          // iPhone のホームインジケータ分(inset)を足しつつ、コンテンツ高は控えめに
          height: 54 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom,
        },
        // 無彩色運用: ブランド色(tabBarActive)は使わず、明るさで選択を表す。
        tabBarActiveTintColor: theme.textPrimary,
        tabBarInactiveTintColor: theme.tabBarInactive,
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), headerShown: false, tabBarIcon: icon(HomeIcon) }} />
      <Tabs.Screen name="boards" options={{ title: t("tabs.boards"), headerShown: false, tabBarIcon: icon(BoardIcon) }} />
      <Tabs.Screen name="friends" options={{ title: t("tabs.friends"), headerShown: false, tabBarIcon: icon(FriendsIcon) }} />
      <Tabs.Screen name="messages" options={{ title: t("tabs.messages"), headerShown: false, tabBarIcon: icon(MessageIcon) }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: icon(ProfileIcon) }} />
    </Tabs>
  );
}
