import { Stack } from "expo-router";

export default function BoardsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "掲示板" }} />
      <Stack.Screen name="[boardId]" options={{ title: "" }} />
    </Stack>
  );
}
