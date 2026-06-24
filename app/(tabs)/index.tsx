import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { signOut } from "../../src/services/authService";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>ようこそ！</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>ログアウト</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  welcome: { fontSize: 24, fontWeight: "700" },
  email: { fontSize: 14, color: "#555" },
  signOut: { marginTop: 24, padding: 12, backgroundColor: "#eee", borderRadius: 8 },
  signOutText: { color: "#333" },
});
