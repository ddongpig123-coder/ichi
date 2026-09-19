import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, Text } from "react-native";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";

// 友達タブから直接トーク画面へ push した場合、このスタックには index が無く既定の
// 戻るボタンが出ない。戻り先があれば戻り、無ければメッセージ一覧へ差し替える。
function BackButton() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/messages"))}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingRight: 8 }}
    >
      <Text style={{ fontSize: 28, color: theme.primary, lineHeight: 30 }}>‹</Text>
    </TouchableOpacity>
  );
}

export default function MessagesLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("tabs.messages") }} />
      <Stack.Screen
        name="[chatId]"
        options={{ title: t("messages.talkTitle"), headerBackVisible: false, headerLeft: () => <BackButton /> }}
      />
    </Stack>
  );
}
