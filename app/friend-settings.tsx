import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import DefaultAvatar from "../src/components/common/DefaultAvatar";
import { useFriends } from "../src/contexts/FriendsContext";

type Section = "frequent" | "nonFrequent";

export default function FriendSettingsScreen() {
  const router = useRouter();
  const {
    frequent, nonFrequent, frequentIds,
    promote, demote,
    moveFrequentUp, moveFrequentDown,
    moveNonFrequentUp, moveNonFrequentDown,
  } = useFriends();

  const [reordering, setReordering] = useState<{ id: string; section: Section } | null>(null);

  function handleLongPress(id: string, section: Section) {
    setReordering((prev) => (prev?.id === id ? null : { id, section }));
  }

  function clearReorder() {
    setReordering(null);
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
        {frequent.length === 0 && (
          <Text style={styles.emptyText}>まだ追加されていません</Text>
        )}
        {frequent.map((friend, index) => {
          const isReordering = reordering?.id === friend.id && reordering.section === "frequent";
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.row, isReordering && styles.rowReordering]}
              onLongPress={() => handleLongPress(friend.id, "frequent")}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <DefaultAvatar size={36} />
                <Text style={styles.nickname} numberOfLines={1}>{friend.nickname}</Text>
              </View>

              {isReordering ? (
                <View style={styles.reorderButtons}>
                  <TouchableOpacity
                    style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                    onPress={() => moveFrequentUp(index)}
                    disabled={index === 0}
                  >
                    <Text style={styles.arrowText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.arrowButton, index === frequent.length - 1 && styles.arrowButtonDisabled]}
                    onPress={() => moveFrequentDown(index)}
                    disabled={index === frequent.length - 1}
                  >
                    <Text style={styles.arrowText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.doneButton} onPress={clearReorder}>
                    <Text style={styles.doneButtonText}>完了</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.demoteButton}
                  onPress={() => { clearReorder(); demote(friend.id); }}
                >
                  <Text style={styles.demoteButtonText}>下げる</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {/* その他の友達 */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>その他の友達</Text>
        {nonFrequent.length === 0 && (
          <Text style={styles.emptyText}>全員よく使う友達に追加済みです</Text>
        )}
        {nonFrequent.map((friend, index) => {
          const isReordering = reordering?.id === friend.id && reordering.section === "nonFrequent";
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.row, isReordering && styles.rowReordering]}
              onLongPress={() => handleLongPress(friend.id, "nonFrequent")}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <DefaultAvatar size={36} />
                <Text style={styles.nickname} numberOfLines={1}>{friend.nickname}</Text>
              </View>

              {isReordering ? (
                <View style={styles.reorderButtons}>
                  <TouchableOpacity
                    style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                    onPress={() => moveNonFrequentUp(index)}
                    disabled={index === 0}
                  >
                    <Text style={styles.arrowText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.arrowButton, index === nonFrequent.length - 1 && styles.arrowButtonDisabled]}
                    onPress={() => moveNonFrequentDown(index)}
                    disabled={index === nonFrequent.length - 1}
                  >
                    <Text style={styles.arrowText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.doneButton} onPress={clearReorder}>
                    <Text style={styles.doneButtonText}>完了</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.promoteButton, frequentIds.length >= 6 && styles.promoteButtonDisabled]}
                  onPress={() => { clearReorder(); promote(friend.id); }}
                  disabled={frequentIds.length >= 6}
                >
                  <Text style={styles.promoteButtonText}>
                    {frequentIds.length >= 6 ? "上限に達した" : "上げる"}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
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
  scrollContent: { padding: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    paddingVertical: 12,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  rowReordering: {
    borderColor: "#2F6AD9",
    backgroundColor: "#EEF4FF",
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
  nickname: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  reorderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#2F6AD9",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowButtonDisabled: { backgroundColor: "#C0C8D8" },
  arrowText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  doneButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#E0E4EA",
    marginLeft: 4,
  },
  doneButtonText: { fontSize: 12, fontWeight: "700", color: "#555" },
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
