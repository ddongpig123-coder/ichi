import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import { fetchMyChats } from "../../../src/services/chatService";
import SchoolPrompt from "../../../src/components/common/SchoolPrompt";
import type { Theme } from "../../../src/theme/themes";
import type { ChatRoom } from "../../../src/types/chat";

export default function MessagesInboxScreen() {
  const { user, schoolDomain, schoolReady } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user || !schoolDomain) return;
    const rooms = await fetchMyChats(schoolDomain, user.uid);
    setChats(rooms);
  }, [user, schoolDomain]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!schoolReady || loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  // メッセージ(チャット)は学校スコープ。学校未選択なら「学校を選択」導線を出す。
  if (!schoolDomain) {
    return <View style={styles.container}><SchoolPrompt /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      data={chats}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.empty}>{t("messages.empty")}</Text>
          <Text style={styles.emptySub}>{t("messages.emptyHint")}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push(`/(tabs)/messages/${item.id}`)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{t("messages.anonChar")}</Text>
          </View>
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.name}>{t("messages.anonUser")}</Text>
              <Text style={styles.time}>{timeAgo(language, item.lastMessageAt)}</Text>
            </View>
            {!!item.relatedPostTitle && (
              <Text style={styles.postRef} numberOfLines={1}>📌 {item.relatedPostTitle}</Text>
            )}
            <Text style={styles.lastMsg} numberOfLines={1}>
              {item.lastMessage || t("messages.started")}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    sep: { height: 1, backgroundColor: theme.border },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    empty: { fontSize: 15, color: theme.textSecondary, fontWeight: "600" },
    emptySub: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
    row: { flexDirection: "row", backgroundColor: theme.card, padding: 16, alignItems: "center", gap: 12 },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.primary + "1A",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 18, color: theme.primary, fontWeight: "700" },
    content: { flex: 1 },
    topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    name: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    time: { fontSize: 11, color: theme.textSecondary },
    postRef: { fontSize: 11, color: theme.primary, marginBottom: 3 },
    lastMsg: { fontSize: 13, color: theme.textSecondary },
  });
}
