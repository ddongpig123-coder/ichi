import { Stack } from "expo-router";
import { AuthProvider } from "../src/contexts/AuthContext";
import { FriendsProvider } from "../src/contexts/FriendsContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <FriendsProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </FriendsProvider>
    </AuthProvider>
  );
}
