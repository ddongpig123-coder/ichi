import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import { fetchPosts, fetchBoardSearchCandidates } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import { OFFICIAL_BOARDS, boardLabel, isQaBoard, qaTagLabel, QA_TAGS, type BoardId, type Post } from "../../../src/types/board";
import { useBoards } from "../../../src/hooks/useBoards";

export default function PostListScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const { schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { isBlocked } = useBlock();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const navigation = useNavigation();
  const { allBoards } = useBoards();

  const board = allBoards.find((b) => b.id === boardId);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 質問板のカテゴリ絞り込み（クライアント側）。null=すべて。
  const isQa = isQaBoard(boardId as string);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // 掲示板内検索（ヘッダーの🔍でトグル）。
  // 🔍を開いた時に候補（最近N件）を1回だけ取得し、以降は入力ごとにクライアント側で
  // 即時フィルタ（検索ボタン不要・ゼロ遅延）。
  const [searchMode, setSearchMode] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Post[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return [];
    return candidates.filter(
      (p) => p.title?.toLowerCase().includes(kw) || p.body?.toLowerCase().includes(kw)
    );
  }, [candidates, keyword]);

  async function openSearch() {
    setSearchMode(true);
    if (!schoolDomain || !boardId) return;
    setCandidatesLoading(true);
    const c = await fetchBoardSearchCandidates(schoolDomain, boardId as BoardId).catch(() => []);
    setCandidates(c);
    setCandidatesLoading(false);
  }

  function closeSearch() {
    setSearchMode(false);
    setKeyword("");
    setCandidates([]);
    Keyboard.dismiss();
  }

  // タイトル + ヘッダー右の検索アイコン
  React.useEffect(() => {
    navigation.setOptions({
      title: board ? boardLabel(board, language) : undefined,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => (searchMode ? closeSearch() : openSearch())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingHorizontal: 8 }}
        >
          <Text style={{ fontSize: 18, color: theme.primary }}>{searchMode ? "✕" : "🔍"}</Text>
        </TouchableOpacity>
      ),
    });
  }, [board, language, searchMode, theme]);

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
      {searchMode && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder={t("boards.searchPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => Keyboard.dismiss()}
            returnKeyType="search"
            autoFocus
          />
        </View>
      )}
      {!searchMode && isQa && (
        <View style={styles.filterBar}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: null as string | null }, ...QA_TAGS.map((tg) => ({ id: tg.id as string | null }))]}
            keyExtractor={(it) => it.id ?? "__all"}
            contentContainerStyle={{ gap: 7, paddingHorizontal: 12 }}
            renderItem={({ item }) => {
              const on = tagFilter === item.id;
              const label = item.id ? qaTagLabel(item.id, language) : t("qa.filterAll");
              return (
                <TouchableOpacity
                  style={[styles.filterChip, on && styles.filterChipOn]}
                  onPress={() => setTagFilter(item.id)}
                >
                  <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
      <FlatList
        data={searchMode ? results : (isQa && tagFilter ? posts.filter((p) => p.tag === tagFilter) : posts)}
        keyExtractor={(item) => item.id}
        refreshControl={searchMode ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.center}>
            {searchMode && candidatesLoading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <Text style={styles.empty}>
                {searchMode
                  ? keyword.trim()
                    ? `「${keyword}」${t("boards.noResultsSuffix")}`
                    : t("boards.searchPlaceholder")
                  : t("boards.noPosts")}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) =>
          isBlocked(item.authorUid) ? (
            <View style={styles.row}>
              <Text style={styles.blockedText}>{t("boards.blockedPost")}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/post/${boardId}/${item.id}`)}
            >
              <View style={styles.titleRow}>
                {isQaBoard(boardId as string) ? (
                  <View style={[styles.qaBadge, item.resolved ? styles.qaBadgeResolved : styles.qaBadgeOpen]}>
                    <Text style={[styles.qaBadgeText, item.resolved ? styles.qaBadgeTextResolved : styles.qaBadgeTextOpen]}>
                      {item.resolved ? t("qa.resolved") : t("qa.open")}
                    </Text>
                  </View>
                ) : null}
                {isQaBoard(boardId as string) && qaTagLabel(item.tag, language) ? (
                  <View style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{qaTagLabel(item.tag, language)}</Text>
                  </View>
                ) : null}
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{t("boards.anonymous")}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>{timeAgo(language, item.createdAt)}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>💬 {item.commentCount}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>👁 {item.viewCount ?? 0}</Text>
              </View>
            </TouchableOpacity>
          )
        }
      />
      {!searchMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/post/${boardId}/write`)}
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    sep: { height: 1, backgroundColor: theme.border },
    searchBar: {
      flexDirection: "row",
      padding: 12,
      gap: 8,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInput: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.background,
      paddingHorizontal: 12,
      fontSize: 15,
      color: theme.textPrimary,
    },
    row: { backgroundColor: theme.card, padding: 16 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    title: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    qaBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    qaBadgeOpen: { backgroundColor: "#F3A43722" },
    qaBadgeResolved: { backgroundColor: "#1F9D6B22" },
    qaBadgeText: { fontSize: 10, fontWeight: "800" },
    qaBadgeTextOpen: { color: "#C77A10" },
    qaBadgeTextResolved: { color: "#1F9D6B" },
    tagChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: theme.primary + "14" },
    tagChipText: { fontSize: 10, fontWeight: "700", color: theme.primary },
    filterBar: {
      paddingVertical: 10, backgroundColor: theme.card,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    filterChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    filterChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterChipText: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    filterChipTextOn: { color: "#fff" },
    meta: { flexDirection: "row", gap: 6 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    empty: { color: theme.textSecondary, fontSize: 14 },
    blockedText: { fontSize: 13, color: theme.textSecondary, fontStyle: "italic" },
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
