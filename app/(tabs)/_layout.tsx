import { Tabs } from "expo-router";
import ProfileCard from "../../src/components/profile/ProfileCard";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "ホーム", headerRight: () => <ProfileCard /> }} />
      <Tabs.Screen name="boards" options={{ title: "掲示板", headerShown: false }} />
      <Tabs.Screen name="friends" options={{ title: "友達" }} />
      <Tabs.Screen name="profile" options={{ title: "プロフィール" }} />
    </Tabs>
  );
}
