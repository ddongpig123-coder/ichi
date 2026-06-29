import { View, Text, TouchableOpacity, StyleSheet, SectionList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { usePinnedBoards } from "../../../src/hooks/usePinnedBoards";
import { useBoards } from "../../../src/hooks/useBoards";
import type { BoardMeta } from "../../../src/types/board";

const CATEGORY_LABELS: Record<string, string> = {
  official: "公式掲示板",
  department: "学部別掲示板",
  custom: "みんなの掲示板",
};

export default function BoardsScreen() {
  const router = useRouter();
  const { pinned, isPinned, toggle, ready: pinReady } = usePinnedBoards();
  const { officialBoards, departmentBoards, userBoards, loading } = useBoards();

  const pinnedBoards = [...officialBoards, ...departmentBoards, ...userBoards].filter((b) =>
    isPinned(b.id)
  );

  const sections = [
    ...(pinnedBoards.length > 0 ? [{ title: "よく使う掲示板", data: pinnedBoards }] : []),
    { title: CATEGORY_LABELS.official, data: officialBoards.filter((b) => !isPinned(b.id)) },
    ...(departmentBoards.length > 0
      ? [{ title: CATEGORY_LABELS.department, data: departmentBoards.filter((b) => !isPinned(b.id)) }]
      : []),
    ...(userBoards.length > 0
      ? [{ title: CATEGORY_LABELS.custom, data: userBoards.filter((b) => !isPinned(b.id)) }]
      : []),
  ];

  function renderBoard({ item }: { item: BoardMeta }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/(tabs)/boards/${item.id}`)}
      >
        <View style={styles.rowContent}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.desc}>{item.description}</Text>
        </View>
        <TouchableOpacity
          style={styles.pinBtn}
          onPress={() => toggle(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.pinIcon}>{isPinned(item.id) ? "⭐" : "☆"}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (!pinReady || loading) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color="#2F6AD9" /></View>;
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
        ListHeaderComponent={
          <>
            <TouchableOpacity style={styles.bestBanner} onPress={() => router.push("/(tabs)/boards/best")}>
              <View>
                <Text style={styles.bestTitle}>❤️ ベスト投稿</Text>
                <Text style={styles.bestSub}>いいね数トップ20をチェック</Text>
              </View>
              <Text style={styles.bestArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.sectionSep} />
          </>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(tabs)/boards/create")}>
            <Text style={styles.createBtnText}>＋ 掲示板を作成する</Text>
          </TouchableOpacity>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={renderBoard}
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
  sectionHeader: { backgroundColor: "#F5F7FA", paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#999", letterSpacing: 0.5 },
  sectionSep: { height: 8, backgroundColor: "#F5F7FA" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 12,
  },
  rowContent: { flex: 1 },
  sep: { height: 1, backgroundColor: "#E8E8E8" },
  label: { fontSize: 16, fontWeight: "700", color: "#1A1A2E", marginBottom: 4 },
  desc: { fontSize: 13, color: "#888" },
  pinBtn: { padding: 8 },
  pinIcon: { fontSize: 18 },
  createBtn: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2F6AD9",
    borderStyle: "dashed",
    alignItems: "center",
  },
  createBtnText: { color: "#2F6AD9", fontWeight: "700", fontSize: 15 },
});
