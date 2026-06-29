import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

// TODO: プロフィール設定機能は未実装。現在はナビゲーション先のプレースホルダーのみ。
export default function ProfileSettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.text}>プロフィール設定（準備中）</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  backButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    zIndex: 1,
  },
  backIcon: { fontSize: 18, color: "#333" },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 14, color: "#888" },
});
