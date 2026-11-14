import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { mergeFirstPage } from "../../../src/utils/listMerge";
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import { useHidden } from "../../../src/contexts/HiddenContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import { fetchLoungePostsPage, fetchLoungeSearchCandidates } from "../../../src/services/loungeService";
import type { Theme } from "../../../src/theme/themes";
import { LOUNGES, isQaLounge, loungeLabel, type LoungeId, type LoungePost } from "../../../src/types/lounge";
import { qaTagLabel, QA_TAGS } from "../../../src/types/board";
import LoadError from "../../../src/components/common/LoadError";

export default function LoungePostListScreen() {
  const { loungeId } = useLocalSearchParams<{ loungeId: string }>();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { isBlocked } = useBlock();
  const { isHidden } = useHidden();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const lounge = LOUNGES.find((l) => l.id === loungeId);

  const [posts, setPosts] = useState<LoungePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // 質問掲示板（qa の板）のカテゴリ絞り込み（クライアント側）。null=すべて。学校の質問掲示板と同じ
  const isQa = isQaLounge(loungeId);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // ページング（学校の板一覧と同じ）。絞り込み中は表示が FILTER_MIN 件に達するまで次ページを読む
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const FILTER_MIN = 10;

  // ラウンジ内検索（ヘッダーの🔍でトグル）。
  // 🔍を開いた時に候補（最近N件）を1回だけ取得し、以降は入力ごとにクライアント側で
  // 即時フィルタ（検索ボタン不要・ゼロ遅延）。
  const [searchMode, setSearchMode] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<LoungePost[]>([]);
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
    if (!loungeId) return;
    setCandidatesLoading(true);
    const c = await fetchLoungeSearchCandidates(loungeId as LoungeId).catch(() => []);
    setCandidates(c);
    setCandidatesLoading(false);
  }

  function closeSearch() {
    setSearchMode(false);
    setKeyword("");
    setCandidates([]);
    Keyboard.dismiss();
  }

  React.useEffect(() => {
    navigation.setOptions({
      title: lounge ? loungeLabel(lounge, language) : undefined,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => (searchMode ? closeSearch() : openSearch())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingHorizontal: 8 }}
        >
          <Ionicons name={searchMode ? "close" : "search"} size={20} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [lounge, language, searchMode, theme]);

  // merge: 焦点復帰時は一覧を置き換えずマージ（スクロール位置を保つ。掲示板一覧と同じ）
  const load = useCallback(async (opts?: { merge?: boolean }) => {
    if (!loungeId) return;
    try {
      const { posts: p, lastDoc, hasMore: more } = await fetchLoungePostsPage(loungeId as LoungeId);
      // マージ更新（焦点復帰）では読み進めた位置を保つため lastDoc を戻さない
      if (!(opts?.merge && lastDocRef.current)) {
        lastDocRef.current = lastDoc;
        setHasMore(more);
      }
      setPosts((prev) => (opts?.merge && prev.length > 0 ? mergeFirstPage(prev, p) : p));
      setLoadError(false);
    } catch (e) {
      // 失敗を「まだ投稿がありません」に見せない
      console.warn("lounge posts load failed:", e);
      setLoadError(true);
    }
  }, [loungeId]);

  // 次ページを追記。重複 id は弾く（焦点復帰と追記が重なった場合の保険）
  const loadMore = useCallback(async () => {
    if (!loungeId || !hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const { posts: p, lastDoc, hasMore: more } = await fetchLoungePostsPage(loungeId as LoungeId, 20, lastDocRef.current);
      lastDocRef.current = lastDoc;
      setHasMore(more);
      setPosts((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...p.filter((x) => !seen.has(x.id))];
      });
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loungeId, hasMore, loadingMore]);

  // 初回だけスピナー、2回目以降の焦点復帰は静かにマージ更新
  const focusedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnceRef.current) {
        focusedOnceRef.current = true;
        setLoading(true);
        load().finally(() => setLoading(false));
      } else {
        load({ merge: true });
      }
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    lastDocRef.current = null;
    await load();
    setRefreshing(false);
  }

  // 表示対象（検索中は検索結果、質問板で絞り込み中はカテゴリ一致のみ）。非表示にした投稿は除く
  const visiblePosts = useMemo(() => {
    const base = searchMode ? results : isQa && tagFilter ? posts.filter((p) => p.tag === tagFilter) : posts;
    return base.filter((p) => !isHidden(p.id));
  }, [searchMode, results, isQa, tagFilter, posts, isHidden]);

  // 絞り込み中に表示が足りなければ次ページを読む（最後まで読んだら止まる）
  useEffect(() => {
    if (searchMode || !isQa || !tagFilter) return;
    if (!hasMore || loadingMore || loading) return;
    if (visiblePosts.length >= FILTER_MIN) return;
    loadMore();
  }, [searchMode, isQa, tagFilter, hasMore, loadingMore, loading, visiblePosts.length, loadMore]);

  const fillingFilter = !searchMode && isQa && !!tagFilter && (loadingMore || hasMore);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // 1件も無い状態で失敗した時だけ全面エラー。前回分が残っていればそれを見せ続ける。
  if (loadError && posts.length === 0) {
    return (
      <LoadError
        onRetry={() => {
          setLoading(true);
          load().finally(() => setLoading(false));
        }}
      />
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
                <TouchableOpacity style={[styles.filterChip, on && styles.filterChipOn]} onPress={() => setTagFilter(item.id)}>
                  <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
      <FlatList
        data={visiblePosts}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={searchMode ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        onEndReached={searchMode ? undefined : () => loadMore()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            {(searchMode && candidatesLoading) || fillingFilter ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <Text style={styles.empty}>
                {searchMode
                  ? keyword.trim()
                    ? `「${keyword}」${t("boards.noResultsSuffix")}`
                    : t("boards.searchHint")
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
              onPress={() => router.push(`/lounge/${loungeId}/${item.id}`)}
            >
              <View style={styles.titleRow}>
                {isQa ? (
                  <View style={[styles.qaBadge, item.resolved ? styles.qaBadgeResolved : styles.qaBadgeOpen]}>
                    <Text style={[styles.qaBadgeText, item.resolved ? styles.qaBadgeTextResolved : styles.qaBadgeTextOpen]}>
                      {item.resolved ? t("qa.resolved") : t("qa.open")}
                    </Text>
                  </View>
                ) : null}
                {isQa && qaTagLabel(item.tag, language) ? (
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
                <Text style={styles.metaText}><Ionicons name="heart-outline" size={12} color={theme.textSecondary} /> {item.likeCount}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}><Ionicons name="chatbubble-outline" size={12} color={theme.textSecondary} /> {item.commentCount}</Text>
              </View>
            </TouchableOpacity>
          )
        }
      />
      {!searchMode && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => router.push(`/lounge/${loungeId}/write`)}
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
    // 質問掲示板の表示（学校の板一覧と同じ見た目）
    qaBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    qaBadgeOpen: { backgroundColor: theme.warning + "22" },
    qaBadgeResolved: { backgroundColor: theme.success + "22" },
    qaBadgeText: { fontSize: 10, fontWeight: "800" },
    qaBadgeTextOpen: { color: theme.warning },
    qaBadgeTextResolved: { color: theme.success },
    tagChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: theme.primary + "14" },
    tagChipText: { fontSize: 10, fontWeight: "700", color: theme.primary },
    filterBar: { paddingVertical: 10, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
    filterChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    filterChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterChipText: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    filterChipTextOn: { color: "#fff" },
    footer: { paddingVertical: 16, alignItems: "center" },
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
