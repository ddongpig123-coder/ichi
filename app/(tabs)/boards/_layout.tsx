import { Stack } from "expo-router";
import { TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";

function SearchButton() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push("/(tabs)/boards/search")} style={{ marginRight: 12 }}>
      <Text style={{ fontSize: 20 }}>🔍</Text>
    </TouchableOpacity>
  );
}

export default function BoardsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "掲示板", headerRight: () => <SearchButton /> }} />
      <Stack.Screen name="[boardId]" options={{ title: "" }} />
      <Stack.Screen name="search" options={{ title: "検索" }} />
    </Stack>
  );
}
