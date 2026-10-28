import { Stack } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";

function SearchButton() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={() => router.push("/(tabs)/boards/search")} style={{ marginRight: 12 }}>
      <Ionicons name="search" size={22} color={theme.primary} />
    </TouchableOpacity>
  );
}

export default function BoardsLayout() {
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
      <Stack.Screen name="index" options={{ title: t("tabs.boards"), headerRight: () => <SearchButton /> }} />
      <Stack.Screen name="[boardId]" options={{ title: "" }} />
      <Stack.Screen name="search" options={{ title: t("boards.searchTitle") }} />
      <Stack.Screen name="best" options={{ title: t("boards.bestScreenTitle") }} />
      <Stack.Screen name="my-posts" options={{ title: t("myPosts.title") }} />
      <Stack.Screen name="create" options={{ title: t("boards.createScreenTitle") }} />
    </Stack>
  );
}
