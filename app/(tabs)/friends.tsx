import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TimeTable from "../../src/components/timetable/TimeTable";
import DefaultAvatar from "../../src/components/common/DefaultAvatar";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import AddFriendModal from "../../src/components/friends/AddFriendModal";
import { useFriends } from "../../src/contexts/FriendsContext";
import { MOCK_FRIEND_TIMETABLES } from "../../src/data/mockFriendTimetables";
import {
  type Semester,
  type SemesterKey,
  getCurrentSemester,
  isSemesterAvailable,
} from "../../src/data/semesterTimetables";

const CELL_HEIGHT = 42;

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { allFriends, frequent, nonFrequent } = useFriends();
  const orderedAll = [...frequent, ...nonFrequent];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = selectedId ?? orderedAll[0]?.id ?? null;
  const [addModalVisible, setAddModalVisible] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState<Semester>(getCurrentSemester());

  const semesterKey: SemesterKey = `${selectedYear}-${selectedSemester}`;
  const friendKey = effectiveId ? `${effectiveId}-${semesterKey}` : null;
  const sessions = friendKey ? (MOCK_FRIEND_TIMETABLES[friendKey] ?? []) : [];
  const selectedFriend = allFriends.find((f) => f.id === effectiveId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>友達</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Text style={styles.addButtonText}>+ 追加</Text>
        </TouchableOpacity>
      </View>

      <AddFriendModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />

      {selectedFriend && (
        <View style={styles.timetableSection}>
          <SemesterSelector
            selectedYear={selectedYear}
            selectedSemester={selectedSemester}
            onChangeYear={(year) => {
              setSelectedYear(year);
              if (!isSemesterAvailable(year, selectedSemester)) setSelectedSemester("春");
            }}
            onChangeSemester={setSelectedSemester}
          />
          <TimeTable sessions={sessions} cellHeight={CELL_HEIGHT} />
        </View>
      )}

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

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  titleText: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  addButton: {
    backgroundColor: "#2F6AD9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  timetableSection: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
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
