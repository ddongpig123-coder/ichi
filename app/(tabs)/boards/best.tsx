import React, { useEffect, useState } from "react";
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
import { fetchBestPosts } from "../../../src/services/boardService";
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
    return <View style={styles.center}><ActivityIndicator size="large" color="#2F6AD9" /></View>;
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A2E" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 4 },
  sep: { height: 1, backgroundColor: "#E8E8E8" },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  rankBadge: { width: 32, alignItems: "center" },
  rank: { fontSize: 16, fontWeight: "700", color: "#aaa" },
  rankTop: { color: "#E8334A" },
  content: { flex: 1 },
  tagRow: { flexDirection: "row", marginBottom: 4 },
  boardTag: {
    backgroundColor: "#EEF3FF",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  boardTagText: { fontSize: 11, color: "#2F6AD9", fontWeight: "600" },
  title: { fontSize: 15, fontWeight: "600", color: "#1A1A2E", marginBottom: 6 },
  meta: { flexDirection: "row", gap: 6 },
  metaText: { fontSize: 12, color: "#999" },
  empty: { color: "#aaa", fontSize: 14, textAlign: "center", lineHeight: 22 },
});
