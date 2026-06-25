import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>大学生コミュニティ</Text>
      <Text style={styles.subtitle}>掲示板で情報交換しよう</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#F5F7FA" },
  title: { fontSize: 26, fontWeight: "700", color: "#1A1A2E" },
  subtitle: { fontSize: 14, color: "#888" },
});
