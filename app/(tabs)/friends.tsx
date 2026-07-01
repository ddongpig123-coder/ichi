import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import TimeTable from "../../src/components/timetable/TimeTable";
import { MOCK_FRIEND_TIMETABLES } from "../../src/data/mockFriendTimetables";

const INITIAL_FRIENDS = [
  { id: "1", nickname: "りく" },
  { id: "2", nickname: "さくらもち" },
  { id: "3", nickname: "ゆうたろう" },
  { id: "4", nickname: "ちょこばななだいすき" },
  { id: "5", nickname: "あお" },
];

const CELL_HEIGHT = 42;

export default function FriendsScreen() {
  const [friends, setFriends] = useState(INITIAL_FRIENDS);
  const [selectedId, setSelectedId] = useState(INITIAL_FRIENDS[0].id);

  const sessions = MOCK_FRIEND_TIMETABLES[selectedId] ?? [];
  const selectedFriend = friends.find((f) => f.id === selectedId) ?? friends[0];

  function handleDelete(id: string) {
    const remaining = friends.filter((f) => f.id !== id);
    setFriends(remaining);
    if (selectedId === id && remaining.length > 0) {
      setSelectedId(remaining[0].id);
    }
  }

  return (
    <View style={styles.container}>
      {/* 시간표 영역 */}
      <View style={styles.timetableSection}>
        <Text style={styles.timetableLabel}>{selectedFriend?.nickname}さんの時間割</Text>
        <TimeTable sessions={sessions} cellHeight={CELL_HEIGHT} />
      </View>

      {/* 친구 목록 */}
      <ScrollView style={styles.listSection} contentContainerStyle={styles.listContent}>
        {friends.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendRow, friend.id === selectedId && styles.friendRowSelected]}
            onPress={() => setSelectedId(friend.id)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarPlaceholder} />
            <Text
              style={[styles.nickname, friend.id === selectedId && styles.nicknameSelected]}
              numberOfLines={1}
            >
              {friend.nickname}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.messageButton} onPress={() => {}}>
                <Text style={styles.messageButtonText}>メッセージ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(friend.id)}
              >
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
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E0E4EA",
  },
  nickname: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  nicknameSelected: {
    color: "#2F6AD9",
  },
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
  messageButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#E2574C",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
