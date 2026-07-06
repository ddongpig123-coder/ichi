import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import ReorderableList, {
  useReorderableDrag,
  reorderItems,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import DefaultAvatar from "../src/components/common/DefaultAvatar";
import { useFriends, type Friend } from "../src/contexts/FriendsContext";

// ── 자주 찾는 친구 행 ──────────────────────────────────────
function FrequentItem({
  item,
  index,
  total,
  onDemote,
}: {
  item: Friend;
  index: number;
  total: number;
  onDemote: (id: string) => void;
}) {
  const drag = useReorderableDrag();
  return (
    <Pressable style={styles.row} onLongPress={drag}>
      <View style={styles.dragHandle}>
        <Text style={styles.dragIcon}>≡</Text>
      </View>
      <Text style={styles.rankBadge}>{index + 1}</Text>
      <DefaultAvatar size={36} />
      <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
      <TouchableOpacity style={styles.demoteButton} onPress={() => onDemote(item.id)}>
        <Text style={styles.demoteButtonText}>下げる</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

// ── 일반 친구 행 ────────────────────────────────────────────
function NonFrequentItem({
  item,
  index,
  isFull,
  onPromote,
}: {
  item: Friend;
  index: number;
  isFull: boolean;
  onPromote: (id: string) => void;
}) {
  const drag = useReorderableDrag();
  return (
    <Pressable style={styles.row} onLongPress={drag}>
      <View style={styles.dragHandle}>
        <Text style={styles.dragIcon}>≡</Text>
      </View>
      <Text style={styles.rankBadge}>{index + 1}</Text>
      <DefaultAvatar size={36} />
      <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
      <TouchableOpacity
        style={[styles.promoteButton, isFull && styles.promoteButtonDisabled]}
        onPress={() => onPromote(item.id)}
        disabled={isFull}
      >
        <Text style={styles.promoteButtonText}>{isFull ? "上限" : "上げる"}</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

// ── 메인 화면 ───────────────────────────────────────────────
export default function FriendSettingsScreen() {
  const router = useRouter();
  const { frequent, nonFrequent, frequentIds, promote, demote, reorderFrequent, reorderNonFrequent } = useFriends();

  function handleFrequentReorder({ from, to }: ReorderableListReorderEvent) {
    reorderFrequent(reorderItems(frequentIds, from, to));
  }

  function handleNonFrequentReorder({ from, to }: ReorderableListReorderEvent) {
    reorderNonFrequent(reorderItems(nonFrequent.map((f) => f.id), from, to));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>よく使う友達の編集</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* よく使う友達 */}
        <Text style={styles.sectionLabel}>よく使う友達 ({frequent.length}/6)</Text>
        <Text style={styles.hint}>≡ を長押しでドラッグ並び替え</Text>

        {frequent.length === 0 ? (
          <Text style={styles.emptyText}>まだ追加されていません</Text>
        ) : (
          <View style={styles.listWrapper}>
            <ReorderableList
              data={frequent}
              keyExtractor={(item) => item.id}
              onReorder={handleFrequentReorder}
              renderItem={({ item, index }) => (
                <FrequentItem
                  item={item}
                  index={index}
                  total={frequent.length}
                  onDemote={demote}
                />
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* その他の友達 */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>その他の友達</Text>
        <Text style={styles.hint}>≡ を長押しでドラッグ並び替え</Text>

        {nonFrequent.length === 0 ? (
          <Text style={styles.emptyText}>全員よく使う友達に追加済みです</Text>
        ) : (
          <View style={styles.listWrapper}>
            <ReorderableList
              data={nonFrequent}
              keyExtractor={(item) => item.id}
              onReorder={handleNonFrequentReorder}
              renderItem={({ item, index }) => (
                <NonFrequentItem
                  item={item}
                  index={index}
                  isFull={frequentIds.length >= 6}
                  onPromote={promote}
                />
              )}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  backIcon: { fontSize: 18, color: "#333" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A2E" },

  scrollContent: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  hint: { fontSize: 11, color: "#bbb", marginBottom: 10 },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    paddingVertical: 12,
    textAlign: "center",
  },
  listWrapper: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 8,
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  dragIcon: { fontSize: 16, color: "#C0C8D8" },
  rankBadge: {
    width: 20,
    fontSize: 12,
    fontWeight: "700",
    color: "#2F6AD9",
    textAlign: "center",
  },
  nickname: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
  },

  demoteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
  },
  demoteButtonText: { fontSize: 12, fontWeight: "700", color: "#E2574C" },

  promoteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2F6AD9",
  },
  promoteButtonDisabled: { backgroundColor: "#C0C8D8" },
  promoteButtonText: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
