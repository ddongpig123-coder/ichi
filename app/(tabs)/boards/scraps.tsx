import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import PostListRow from "../../../src/components/boards/PostListRow";
import LoadError from "../../../src/components/common/LoadError";
import { fetchScraps, removeScrap } from "../../../src/services/scrapService";
import { confirmDialog, notify } from "../../../src/utils/dialog";
import type { ScrapItem } from "../../../src/types/scrap";
import type { Theme } from "../../../src/theme/themes";

// スクラップ一覧（users/{uid}/scraps）。タップで投稿へ、長押しで解除。
export default function ScrapsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [items, setItems] = useState<ScrapItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setItems(await fetchScraps(user.uid));
      setError(false);
    } catch (e) {
      console.warn("scraps load failed:", e);
      setError(true);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openPost(item: ScrapItem) {
    if (item.kind === "lounge") router.push(`/lounge/${item.boardId}/${item.postId}`);
    else router.push(`/post/${item.boardId}/${item.postId}`);
  }

  function askRemove(item: ScrapItem) {
    if (!user) return;
    confirmDialog(
      t("boards.scrapRemoveTitle"),
      t("boards.scrapRemoveMessage"),
      async () => {
        try {
          await removeScrap(user.uid, item.key);
          setItems((prev) => (prev ? prev.filter((s) => s.key !== item.key) : prev));
        } catch (e) {
          console.warn("scrap remove failed:", e);
          notify(t("common.error"));
        }
      },
      { cancel: t("common.cancel"), ok: t("common.delete") }
    );
  }

  if (error && (items === null || items.length === 0)) {
    return <LoadError onRetry={load} />;
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={items.length > 0 ? <Text style={styles.hint}>{t("boards.scrapsLongPressHint")}</Text> : null}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("boards.scrapsEmpty")}</Text>
          <Text style={styles.emptySub}>{t("boards.scrapsHint")}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <PostListRow
          boardLabel={item.boardLabel}
          boardLabelKo={item.boardLabelKo}
          title={item.title}
          createdAt={item.createdAt}
          onPress={() => openPost(item)}
          onLongPress={() => askRemove(item)}
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
