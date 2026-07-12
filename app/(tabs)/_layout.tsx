import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "ホーム", headerShown: false }} />
      <Tabs.Screen name="boards" options={{ title: "掲示板", headerShown: false }} />
      <Tabs.Screen name="friends" options={{ title: "友達", headerShown: false }} />
      <Tabs.Screen name="messages" options={{ title: "メッセージ", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "プロフィール" }} />
    </Tabs>
  );
}
