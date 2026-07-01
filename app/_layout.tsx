import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/contexts/AuthContext";
import { FriendsProvider } from "../src/contexts/FriendsContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FriendsProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </FriendsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
