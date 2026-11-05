import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DefaultAvatar from "../common/DefaultAvatar";
import { useFriends } from "../../contexts/FriendsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

const COLUMNS = 3;

export default function FriendsList() {
  const router = useRouter();
  const { frequent, loading } = useFriends();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // 読み込み中は枠だけ出す（空状態が一瞬チラつかないように）
  const isEmpty = !loading && frequent.length === 0;

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t("home.friendsSection")}</Text>
        {!isEmpty && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push("/friend-settings")}
            hitSlop={8}
            accessibilityLabel={t("friends.settingsTitle")}
          >
            <Text style={styles.editIcon}>✎</Text>
          </TouchableOpacity>
        )}
      </View>

      {isEmpty ? (
        // 空状態: 何をすればいいかを一目で分かるように、追加導線を枠の中に置く
        <TouchableOpacity
          style={[styles.frame, styles.emptyFrame]}
          onPress={() => router.push("/(tabs)/friends?add=1")}
          activeOpacity={0.7}
        >
          <Text style={styles.emptyText}>{t("friends.empty")}</Text>
          <View style={styles.emptyAction}>
            <Ionicons name="person-add-outline" size={14} color={theme.primary} />
            <Text style={styles.emptyActionText}>{t("friends.addTitle")}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.frame}>
          {frequent.map((friend) => (
            <TouchableOpacity
              key={friend.id}
              style={styles.friendItem}
              onPress={() => router.push(`/(tabs)/friends?friend=${friend.id}`)}
              activeOpacity={0.6}
            >
              <DefaultAvatar size={30} />
              <Text style={styles.nickname} numberOfLines={1}>{friend.nickname}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
    emptyFrame: {
      flexDirection: "column",
      flexWrap: "nowrap",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      gap: 8,
    },
    emptyText: { fontSize: 13, color: theme.textSecondary },
    emptyAction: { flexDirection: "row", alignItems: "center", gap: 4 },
    emptyActionText: { fontSize: 13, fontWeight: "700", color: theme.primary },
    friendItem: {
      width: `${100 / COLUMNS}%`,
      alignItems: "center",
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    nickname: { fontSize: 10, color: theme.textSecondary, fontWeight: "600", maxWidth: "100%", marginTop: 3 },
  });
}
