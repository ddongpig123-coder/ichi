import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ユーザーID</Text>
      <Text style={styles.uid}>{user?.uid?.slice(0, 12)}...</Text>
      <Text style={styles.note}>現在は匿名ユーザーとして利用中です</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#F5F7FA" },
  label: { fontSize: 12, color: "#aaa" },
  uid: { fontSize: 16, fontWeight: "600", color: "#333" },
  note: { fontSize: 13, color: "#aaa", marginTop: 8 },
});
