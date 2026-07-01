import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import DraggableFlatList, {
  ScaleDecorator,
  ShadowDecorator,
  OpacityDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import DefaultAvatar from "../src/components/common/DefaultAvatar";
import { useFriends, type Friend } from "../src/contexts/FriendsContext";

export default function FriendSettingsScreen() {
  const router = useRouter();
  const { frequent, nonFrequent, frequentIds, promote, demote, reorderFrequent, reorderNonFrequent } = useFriends();

  function renderFrequentItem({ item, drag, isActive, getIndex }: RenderItemParams<Friend>) {
    const index = getIndex() ?? 0;
    return (
      <ShadowDecorator>
        <ScaleDecorator>
          <OpacityDecorator activeOpacity={0.5}>
            <TouchableOpacity
              style={[styles.row, isActive && styles.rowActive]}
              onLongPress={drag}
              activeOpacity={1}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rankBadge, isActive && styles.rankBadgeActive]}>
                  {index + 1}
                </Text>
                <DefaultAvatar size={36} />
                <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
              </View>
              <TouchableOpacity
                style={styles.demoteButton}
                onPress={() => demote(item.id)}
              >
                <Text style={styles.demoteButtonText}>下げる</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </OpacityDecorator>
        </ScaleDecorator>
      </ShadowDecorator>
    );
  }

  function renderNonFrequentItem({ item, drag, isActive, getIndex }: RenderItemParams<Friend>) {
    const index = getIndex() ?? 0;
    return (
      <ShadowDecorator>
        <ScaleDecorator>
          <OpacityDecorator activeOpacity={0.5}>
            <TouchableOpacity
              style={[styles.row, isActive && styles.rowActive]}
              onLongPress={drag}
              activeOpacity={1}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rankBadge, isActive && styles.rankBadgeActive]}>
                  {index + 1}
                </Text>
                <DefaultAvatar size={36} />
                <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
              </View>
              <TouchableOpacity
                style={[styles.promoteButton, frequentIds.length >= 6 && styles.promoteButtonDisabled]}
                onPress={() => promote(item.id)}
                disabled={frequentIds.length >= 6}
              >
                <Text style={styles.promoteButtonText}>
                  {frequentIds.length >= 6 ? "上限に達した" : "上げる"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </OpacityDecorator>
        </ScaleDecorator>
      </ShadowDecorator>
    );
  }

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>よく使う友達の編集</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled>
        {/* よく使う友達 */}
        <Text style={styles.sectionLabel}>よく使う友達 ({frequent.length}/6)</Text>
        <Text style={styles.hint}>長押しでドラッグして順番を変更できます</Text>

        {frequent.length === 0 ? (
          <Text style={styles.emptyText}>まだ追加されていません</Text>
        ) : (
          <DraggableFlatList
            data={frequent}
            keyExtractor={(item) => item.id}
            renderItem={renderFrequentItem}
            onDragEnd={({ data }) => reorderFrequent(data.map((f) => f.id))}
            scrollEnabled={false}
            containerStyle={styles.listContainer}
          />
        )}

        {/* その他の友達 */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>その他の友達</Text>
        <Text style={styles.hint}>長押しでドラッグして順番を変更できます</Text>

        {nonFrequent.length === 0 ? (
          <Text style={styles.emptyText}>全員よく使う友達に追加済みです</Text>
        ) : (
          <DraggableFlatList
            data={nonFrequent}
            keyExtractor={(item) => item.id}
            renderItem={renderNonFrequentItem}
            onDragEnd={({ data }) => reorderNonFrequent(data.map((f) => f.id))}
            scrollEnabled={false}
            containerStyle={styles.listContainer}
          />
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
  hint: {
    fontSize: 11,
    color: "#bbb",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    paddingVertical: 12,
    textAlign: "center",
  },
  listContainer: {
    borderRadius: 10,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 10,
  },
  rowActive: {
    backgroundColor: "#EEF4FF",
    borderRadius: 10,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankBadge: {
    width: 20,
    fontSize: 12,
    fontWeight: "700",
    color: "#2F6AD9",
    textAlign: "center",
  },
  rankBadgeActive: { color: "#1A4FA0" },
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
