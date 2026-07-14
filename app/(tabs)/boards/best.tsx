import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { fetchBestPosts } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import type { Post } from "../../../src/types/board";

type BestPost = Post & { boardLabel: string };

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "たった今";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${Math.floor(diff / 86400000)}日前`;
}

export default function BestPostsScreen() {
  const { schoolDomain } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [posts, setPosts] = useState<BestPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!schoolDomain) return;
    const res = await fetchBestPosts(schoolDomain);
    setPosts(res);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [schoolDomain]);

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
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>❤️ ベスト投稿</Text>
          <Text style={styles.headerSub}>いいね数トップ20</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>まだベスト投稿がありません{"\n"}投稿にいいねをしてみよう！</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push(`/post/${item.boardId}/${item.id}`)}
        >
          <View style={styles.rankBadge}>
            <Text style={[styles.rank, index < 3 && styles.rankTop]}>{index + 1}</Text>
          </View>
          <View style={styles.content}>
            <View style={styles.tagRow}>
              <View style={styles.boardTag}>
                <Text style={styles.boardTagText}>{item.boardLabel}</Text>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>❤️ {item.likeCount}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>💬 {item.commentCount}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>{timeAgo(item.createdAt)}</Text>
            </View>
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
    header: { padding: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: theme.textPrimary },
    headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    sep: { height: 1, backgroundColor: theme.border },
    row: {
      flexDirection: "row",
      backgroundColor: theme.card,
      padding: 16,
      alignItems: "center",
      gap: 12,
    },
    rankBadge: { width: 32, alignItems: "center" },
    rank: { fontSize: 16, fontWeight: "700", color: theme.textSecondary },
    rankTop: { color: theme.accent },
    content: { flex: 1 },
    tagRow: { flexDirection: "row", marginBottom: 4 },
    boardTag: {
      backgroundColor: theme.primary + "1A",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    boardTagText: { fontSize: 11, color: theme.primary, fontWeight: "600" },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 },
    meta: { flexDirection: "row", gap: 6 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    empty: { color: theme.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 },
  });
}
