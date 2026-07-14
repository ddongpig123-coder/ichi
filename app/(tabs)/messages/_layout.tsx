import { Stack } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function MessagesLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "メッセージ" }} />
      <Stack.Screen name="[chatId]" options={{ title: "トーク" }} />
    </Stack>
  );
}
