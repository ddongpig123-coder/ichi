import { Stack } from "expo-router";

export default function PostLayout() {
  return (
    <Stack>
      <Stack.Screen name="[boardId]/[postId]" options={{ title: "投稿" }} />
      <Stack.Screen name="[boardId]/write" options={{ title: "新規投稿" }} />
    </Stack>
  );
}
