import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, Text } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext";

// 기본 헤더 백버튼은 부모 그룹 (tabs)의 초기 화면(홈)으로 이동해버리므로
// 실제 이전 화면(보던 게시판)으로 돌아가도록 router.back()을 사용한다
function BackButton() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/boards"))}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingRight: 8 }}
    >
      <Text style={{ fontSize: 28, color: theme.primary, lineHeight: 30 }}>‹</Text>
    </TouchableOpacity>
  );
}

export default function PostLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <BackButton />,
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="[boardId]/[postId]" options={{ title: "投稿" }} />
      <Stack.Screen name="[boardId]/write" options={{ title: "新規投稿" }} />
    </Stack>
  );
}
