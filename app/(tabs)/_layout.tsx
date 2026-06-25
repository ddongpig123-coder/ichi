import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "ホーム" }} />
      <Tabs.Screen name="boards/index" options={{ title: "掲示板" }} />
      <Tabs.Screen name="profile" options={{ title: "プロフィール" }} />
    </Tabs>
  );
}
