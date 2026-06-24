import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";

export default function ProfileScreen() {
  const { user } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.displayName ?? "ユーザー"}</Text>
      <Text style={styles.email}>{user?.email}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  name: { fontSize: 20, fontWeight: "600" },
  email: { fontSize: 14, color: "#666" },
});
