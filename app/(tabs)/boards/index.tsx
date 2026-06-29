import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { BOARDS } from "../../../src/types/board";

export default function BoardsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.bestBanner} onPress={() => router.push("/(tabs)/boards/best")}>
        <View>
          <Text style={styles.bestTitle}>❤️ ベスト投稿</Text>
          <Text style={styles.bestSub}>いいね数トップ20をチェック</Text>
        </View>
        <Text style={styles.bestArrow}>›</Text>
      </TouchableOpacity>
      <View style={styles.sep} />
      <FlatList
        data={BOARDS}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/(tabs)/boards/${item.id}`)}
          >
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.desc}>{item.description}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  bestBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 20,
  },
  bestTitle: { fontSize: 16, fontWeight: "700", color: "#E8334A", marginBottom: 2 },
  bestSub: { fontSize: 13, color: "#888" },
  bestArrow: { fontSize: 22, color: "#ccc" },
  row: { backgroundColor: "#fff", padding: 20 },
  sep: { height: 1, backgroundColor: "#E8E8E8" },
  label: { fontSize: 16, fontWeight: "700", color: "#1A1A2E", marginBottom: 4 },
  desc: { fontSize: 13, color: "#888" },
});
