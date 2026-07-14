import { Stack } from "expo-router";
import { TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";

function SearchButton() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push("/(tabs)/boards/search")} style={{ marginRight: 12 }}>
      <Text style={{ fontSize: 20 }}>🔍</Text>
    </TouchableOpacity>
  );
}

export default function BoardsLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "掲示板", headerRight: () => <SearchButton /> }} />
      <Stack.Screen name="[boardId]" options={{ title: "" }} />
      <Stack.Screen name="search" options={{ title: "検索" }} />
      <Stack.Screen name="best" options={{ title: "ベスト投稿" }} />
      <Stack.Screen name="create" options={{ title: "掲示板を作成" }} />
    </Stack>
  );
}
