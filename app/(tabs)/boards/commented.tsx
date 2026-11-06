import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import PostListRow from "../../../src/components/boards/PostListRow";
import { loadCommentedPosts, type CommentedPost } from "../../../src/services/commentedPostsStore";
import type { Theme } from "../../../src/theme/themes";

// コメントした投稿（この端末で記録した分。commentedPostsStore 参照）
export default function CommentedPostsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [items, setItems] = useState<CommentedPost[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadCommentedPosts().then((list) => { if (alive) setItems(list); });
      return () => { alive = false; };
    }, [])
  );

  function openPost(item: CommentedPost) {
    if (item.kind === "lounge") router.push(`/lounge/${item.boardId}/${item.postId}`);
    else router.push(`/post/${item.boardId}/${item.postId}`);
  }

  if (items === null) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
      data={items}
      keyExtractor={(item) => item.key}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListHeaderComponent={items.length > 0 ? <Text style={styles.hint}>{t("boards.commentedHint")}</Text> : null}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("boards.commentedEmpty")}</Text>
          <Text style={styles.emptySub}>{t("boards.commentedHint")}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <PostListRow
          boardLabel={item.boardLabel}
          boardLabelKo={item.boardLabelKo}
          title={item.title}
          createdAt={item.at}
          onPress={() => openPost(item)}
        />
      )}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    hint: { fontSize: 12, color: theme.textSecondary, paddingHorizontal: 16, paddingVertical: 10 },
    emptyWrap: { flexGrow: 1, justifyContent: "center" },
    empty: { alignItems: "center", paddingHorizontal: 32 },
    emptyText: { fontSize: 15, color: theme.textPrimary, marginBottom: 6 },
    emptySub: { fontSize: 13, color: theme.textSecondary, textAlign: "center" },
    sep: { height: 1, backgroundColor: theme.border },
  });
}
