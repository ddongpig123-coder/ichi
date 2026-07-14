import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import DefaultAvatar from "../common/DefaultAvatar";
import { useFriends } from "../../contexts/FriendsContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { Theme } from "../../theme/themes";

const COLUMNS = 3;

export default function FriendsList() {
  const router = useRouter();
  const { frequent } = useFriends();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
        {frequent.map((friend) => (
          <View key={friend.id} style={styles.friendItem}>
            <DefaultAvatar size={30} />
            <Text style={styles.nickname} numberOfLines={1}>{friend.nickname}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    section: { marginTop: 6, marginBottom: 8 },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
      paddingHorizontal: 12,
    },
    label: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
    editButton: { padding: 2 },
    editIcon: { fontSize: 12, color: theme.textSecondary },
    frame: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    friendItem: {
      width: `${100 / COLUMNS}%`,
      alignItems: "center",
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    nickname: { fontSize: 10, color: theme.textSecondary, fontWeight: "600", maxWidth: "100%", marginTop: 3 },
  });
}
