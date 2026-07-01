import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const COLUMNS = 3;
const MAX_VISIBLE_FRIENDS = COLUMNS * 2;

const MOCK_FRIENDS = [
  { id: "1", nickname: "りく", photoURL: null },
  { id: "2", nickname: "さくらもち", photoURL: null },
  { id: "3", nickname: "ゆうたろう", photoURL: null },
  { id: "4", nickname: "ちょこばななだいすき", photoURL: null },
  { id: "5", nickname: "あお", photoURL: null },
];

export default function FriendsList() {
  const router = useRouter();
  const [friends] = useState(MOCK_FRIENDS.slice(0, MAX_VISIBLE_FRIENDS));

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>友達</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push("/friend-settings")}
        >
          <Text style={styles.editIcon}>✎</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.frame}>
        {friends.map((friend) => (
          <View key={friend.id} style={styles.friendItem}>
            <View style={styles.avatarPlaceholder} />
            <Text style={styles.nickname} numberOfLines={1}>{friend.nickname}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  label: { fontSize: 14, fontWeight: "700", color: "#1A1A2E" },
  editButton: { padding: 2 },
  editIcon: { fontSize: 12, color: "#aaa" },
  frame: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  friendItem: {
    width: `${100 / COLUMNS}%`,
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0E4EA",
    marginBottom: 6,
  },
  nickname: { fontSize: 11, color: "#444", fontWeight: "600", maxWidth: "100%" },
});
