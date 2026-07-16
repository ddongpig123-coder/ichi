import { Stack } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";

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
      <Stack.Screen name="[chatId]" options={{ title: t("messages.talkTitle") }} />
    </Stack>
  );
}
