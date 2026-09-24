import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import { useNotifications } from "../../../src/contexts/NotificationsContext";
import { myPostKey, type MyPostItem } from "../../../src/services/myPostsService";
import type { Theme } from "../../../src/theme/themes";

// 自分が書いた投稿の一覧（学校掲示板＋留学生ラウンジ横断）。
// コメントが増えた投稿には赤丸を出し、開くと既読になる（NotificationsContext）。
export default function MyPostsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { myPosts, newCommentKeys, refreshMyPosts } = useNotifications();

  const [loading, setLoading] = useState(myPosts.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  // 画面に入るたび最新化（他端末からのコメントも拾う）
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshMyPosts().finally(() => {
        if (alive) setLoading(false);
      });
      return () => {
        alive = false;
      };
    }, [refreshMyPosts])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refreshMyPosts();
    setRefreshing(false);
  }

  function openPost(item: MyPostItem) {
    // 既読化は投稿画面側で行う（実際に中身を見たときだけ消す）
    if (item.kind === "lounge") router.push(`/lounge/${item.boardId}/${item.id}`);
    else router.push(`/post/${item.boardId}/${item.id}`);
  }

  function renderItem({ item }: { item: MyPostItem }) {
    const isNew = newCommentKeys.has(myPostKey(item.kind, item.boardId, item.id));
    return (
      <TouchableOpacity style={styles.row} onPress={() => openPost(item)}>
        <View style={styles.rowTop}>
          <Text style={styles.boardTag}>
            {language === "ko" ? item.boardLabelKo : item.boardLabel}
          </Text>
          {isNew && <View style={styles.dot} />}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.meta}>
          {timeAgo(language, item.createdAt)} · 💬 {item.commentCount ?? 0} · ❤️ {item.likeCount ?? 0}
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={myPosts.length === 0 ? styles.emptyWrap : undefined}
      data={myPosts}
      keyExtractor={(item) => myPostKey(item.kind, item.boardId, item.id)}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("myPosts.empty")}</Text>
          <Text style={styles.emptySub}>{t("myPosts.emptyHint")}</Text>
        </View>
      }
      renderItem={renderItem}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    emptyWrap: { flexGrow: 1, justifyContent: "center" },
    empty: { alignItems: "center", paddingHorizontal: 32 },
    emptyText: { fontSize: 15, color: theme.textPrimary, marginBottom: 6 },
    emptySub: { fontSize: 13, color: theme.textSecondary, textAlign: "center" },
    row: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.card },
    rowTop: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    boardTag: { fontSize: 11, color: theme.primary, fontWeight: "600" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E2574C", marginLeft: 6 },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 4 },
    meta: { fontSize: 12, color: theme.textSecondary },
    sep: { height: 1, backgroundColor: theme.border },
  });
}
