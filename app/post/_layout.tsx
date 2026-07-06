import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, Text } from "react-native";

// 기본 헤더 백버튼은 부모 그룹 (tabs)의 초기 화면(홈)으로 이동해버리므로
// 실제 이전 화면(보던 게시판)으로 돌아가도록 router.back()을 사용한다
function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/boards"))}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingRight: 8 }}
    >
      <Text style={{ fontSize: 28, color: "#2F6AD9", lineHeight: 30 }}>‹</Text>
    </TouchableOpacity>
  );
}

export default function PostLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <BackButton />,
      }}
    >
      <Stack.Screen name="[boardId]/[postId]" options={{ title: "投稿" }} />
      <Stack.Screen name="[boardId]/write" options={{ title: "新規投稿" }} />
    </Stack>
  );
}
