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
import { fetchMyChats } from "../../../src/services/chatService";
import type { Theme } from "../../../src/theme/themes";
import type { ChatRoom } from "../../../src/types/chat";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "たった今";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${Math.floor(diff / 86400000)}日前`;
}

export default function MessagesInboxScreen() {
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
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
          <Text style={styles.empty}>まだメッセージがありません</Text>
          <Text style={styles.emptySub}>投稿から著者にDMを送れます</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push(`/(tabs)/messages/${item.id}`)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>匿</Text>
          </View>
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.name}>匿名ユーザー</Text>
              <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.postRef} numberOfLines={1}>📌 {item.relatedPostTitle}</Text>
            <Text style={styles.lastMsg} numberOfLines={1}>
              {item.lastMessage || "メッセージを開始しました"}
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
