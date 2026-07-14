import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { fetchPosts } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import { OFFICIAL_BOARDS, type BoardId, type Post } from "../../../src/types/board";
import { useBoards } from "../../../src/hooks/useBoards";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "たった今";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${Math.floor(diff / 86400000)}日前`;
}

export default function PostListScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const { schoolDomain } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const navigation = useNavigation();
  const { allBoards } = useBoards();

  const board = allBoards.find((b) => b.id === boardId);

  React.useEffect(() => {
    if (board) navigation.setOptions({ title: board.label });
  }, [board]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolDomain || !boardId) return;
    const { posts: p } = await fetchPosts(schoolDomain, boardId as BoardId);
    setPosts(p);
  }, [schoolDomain, boardId]);

  // 화면 포커스될 때마다 새로고침 (글 작성 후 돌아올 때 포함)
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>まだ投稿がありません</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/post/${boardId}/${item.id}`)}
          >
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>匿名</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>{timeAgo(item.createdAt)}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>💬 {item.commentCount}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/post/${boardId}/write`)}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    sep: { height: 1, backgroundColor: theme.border },
    row: { backgroundColor: theme.card, padding: 16 },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 },
    meta: { flexDirection: "row", gap: 6 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    empty: { color: theme.textSecondary, fontSize: 14 },
    fab: {
      position: "absolute",
      bottom: 24,
      right: 24,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 5,
    },
    fabText: { color: "#fff", fontSize: 28, lineHeight: 32 },
  });
}
