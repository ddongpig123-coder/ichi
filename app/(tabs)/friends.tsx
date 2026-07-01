import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import TimeTable from "../../src/components/timetable/TimeTable";
import DefaultAvatar from "../../src/components/common/DefaultAvatar";
import { useFriends } from "../../src/contexts/FriendsContext";
import { MOCK_FRIEND_TIMETABLES } from "../../src/data/mockFriendTimetables";

const CELL_HEIGHT = 42;

export default function FriendsScreen() {
  const { allFriends, frequent, nonFrequent } = useFriends();
  const orderedAll = [...frequent, ...nonFrequent];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = selectedId ?? orderedAll[0]?.id ?? null;

  const sessions = effectiveId ? (MOCK_FRIEND_TIMETABLES[effectiveId] ?? []) : [];
  const selectedFriend = allFriends.find((f) => f.id === effectiveId);

  return (
    <View style={styles.container}>
      {/* 시간표 영역 */}
      {selectedFriend && (
        <View style={styles.timetableSection}>
          <Text style={styles.timetableLabel}>{selectedFriend.nickname}さんの時間割</Text>
          <TimeTable sessions={sessions} cellHeight={CELL_HEIGHT} />
        </View>
      )}

      {/* 친구 목록 */}
      <ScrollView style={styles.listSection} contentContainerStyle={styles.listContent}>
        {orderedAll.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendRow, friend.id === effectiveId && styles.friendRowSelected]}
            onPress={() => setSelectedId(friend.id)}
            activeOpacity={0.7}
          >
            <DefaultAvatar size={36} />
            <Text
              style={[styles.nickname, friend.id === effectiveId && styles.nicknameSelected]}
              numberOfLines={1}
            >
              {friend.nickname}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.messageButton} onPress={() => {}}>
                <Text style={styles.messageButtonText}>メッセージ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => {}}>
                <Text style={styles.deleteButtonText}>削除</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },

  timetableSection: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 8,
  },
  timetableLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A1A2E",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },

  listSection: { flex: 1 },
  listContent: { paddingVertical: 4 },

  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 10,
  },
  friendRowSelected: {
    backgroundColor: "#EEF4FF",
    borderLeftWidth: 3,
    borderLeftColor: "#2F6AD9",
  },
  nickname: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  nicknameSelected: { color: "#2F6AD9" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  messageButton: {
    backgroundColor: "#2F6AD9",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  messageButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  deleteButton: {
    backgroundColor: "#E2574C",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
