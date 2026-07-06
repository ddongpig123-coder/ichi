import { Tabs } from "expo-router";
import ProfileCard from "../../src/components/profile/ProfileCard";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="boards" options={{ title: "掲示板", headerShown: false }} />
      <Tabs.Screen name="friends" options={{ headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "プロフィール" }} />
    </Tabs>
  );
}
