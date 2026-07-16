import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useBlock } from "../src/contexts/BlockContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";

// ブロックしたユーザーの一覧・解除。プロフィールから遷移。
// 匿名性維持のためニックネームは持たず、uid の一部のみ表示する。
export default function BlockedUsersScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { blockedUsers, unblock, ready } = useBlock();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("blocked.title")}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!ready ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.blockedUid}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("blocked.empty")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{t("messages.anonChar")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{t("messages.anonUser")}</Text>
                <Text style={styles.uid}>{item.blockedUid.slice(0, 8)}…</Text>
              </View>
              <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(item.blockedUid)}>
                <Text style={styles.unblockText}>{t("blocked.unblock")}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 30, color: theme.primary, lineHeight: 32, width: 28 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    sep: { height: 1, backgroundColor: theme.border },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.card,
      padding: 16,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + "1A",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 15, color: theme.primary, fontWeight: "700" },
    name: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    uid: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    unblockBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    unblockText: { fontSize: 13, color: theme.textPrimary, fontWeight: "600" },
    empty: { alignItems: "center", paddingTop: 80 },
    emptyText: { color: theme.textSecondary, fontSize: 14 },
  });
}
