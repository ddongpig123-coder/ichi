import { useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useBoards } from "../../../src/hooks/useBoards";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import { useHidden } from "../../../src/contexts/HiddenContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { MY_POSTS_REFRESH_INTERVAL_MS, useNotifications } from "../../../src/contexts/NotificationsContext";
import SchoolPrompt from "../../../src/components/common/SchoolPrompt";
import PostListRow from "../../../src/components/boards/PostListRow";
import type { Theme } from "../../../src/theme/themes";
import { OFFICIAL_BOARDS } from "../../../src/types/board";
import { FORESTS, forestLabel, forestDescription, type ForestId } from "../../../src/types/lounge";
import { fetchForestFeed, fetchSchoolFeed, type FeedItem } from "../../../src/services/forestFeedService";

// 掲示板タブのホーム（2026-11-06 準熙決定, BOARD-ACCESS §4-3）。
// エブリタイムのホームに倣い、森ごとのブロックを縦に 3 つ並べ、それぞれの下に新着投稿を数件出す:
//   みんなの森 → 留学生の森 → 学校の森
// ブロックの見出しを押すとその森の板一覧へ、投稿を押すと投稿へ。
// 以前の上部セグメント（学校 / みんなの森 / 留学生の森）は廃止。一覧にアイコン・絵文字は出さない。
type BlockId = ForestId | "school";
const ORDER: BlockId[] = ["minna", "ryugakusei", "school"];

export default function BoardsHomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { schoolDomain, schoolReady } = useAuth();
  const { isBlocked } = useBlock();
  const { isHidden } = useHidden();
  const { refreshMyPosts } = useNotifications();
  const { customBoards, loading: boardsLoading } = useBoards();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [feeds, setFeeds] = useState<Partial<Record<BlockId, FeedItem[]>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 森 2 つは全国スコープなので学校未選択でも読む。学校の森は学校が決まってから。
  // ※ useBoards の allBoards は描画ごとに新しい配列なので依存に入れない（customBoards は state で安定）
  const load = useCallback(
    async (force = false) => {
      const tasks: Promise<void>[] = FORESTS.map((f) =>
        fetchForestFeed(f.id, { force })
          .then((items) => setFeeds((prev) => ({ ...prev, [f.id]: items })))
          .catch((e) => console.warn("forest feed failed:", f.id, e))
      );
      if (schoolDomain && !boardsLoading) {
        tasks.push(
          fetchSchoolFeed(schoolDomain, [...OFFICIAL_BOARDS, ...customBoards], { force })
            .then((items) => setFeeds((prev) => ({ ...prev, school: items })))
            .catch((e) => console.warn("school feed failed:", e))
        );
      }
      await Promise.all(tasks);
    },
    [schoolDomain, customBoards, boardsLoading]
  );

  // タブを開くたびに静かに最新化（60 秒以内はキャッシュ）。初回だけスピナー
  useFocusEffect(
    useCallback(() => {
      refreshMyPosts({ minIntervalMs: MY_POSTS_REFRESH_INTERVAL_MS });
      load().finally(() => setLoading(false));
    }, [load, refreshMyPosts])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  function openPost(item: FeedItem) {
    if (item.kind === "lounge") router.push(`/lounge/${item.boardId}/${item.id}`);
    else router.push(`/post/${item.boardId}/${item.id}`);
  }

  function openAll(id: BlockId) {
    if (id === "school") router.push("/(tabs)/boards/school");
    else router.push({ pathname: "/lounge", params: { forest: id } });
  }

  const noSchool = schoolReady && !schoolDomain;

  function renderBlock(id: BlockId) {
    const forest = FORESTS.find((f) => f.id === id);
    const title = forest ? forestLabel(forest, language) : t("boards.schoolForest");
    const sub = forest ? forestDescription(forest, language) : t("boards.schoolForestSub");
    const items = (feeds[id] ?? []).filter((p) => !isBlocked(p.authorUid) && !isHidden(p.id));
    const schoolMissing = id === "school" && noSchool;
    // 見出しはカードの外（大きく）、投稿はカードの中 — エブリタイムの「즐겨찾는 게시판」と同じ分け方。
    // 見出しと投稿の行が同じ箱に入っていると区別しにくかった（準熙 11/06 プレビュー）。
    return (
      <View key={id} style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => openAll(id)}
          disabled={schoolMissing}
          accessibilityRole="button"
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          {!schoolMissing && (
            <View style={styles.seeAll}>
              <Text style={styles.seeAllText}>{t("boards.seeAll")}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.sectionSub}>{sub}</Text>
        <View style={styles.card}>
          {schoolMissing ? (
            <SchoolPrompt />
          ) : feeds[id] === undefined ? (
            <ActivityIndicator style={styles.blockSpinner} color={theme.primary} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t("boards.feedEmpty")}</Text>
          ) : (
            items.map((p, i) => (
              <View key={p.key}>
                {i > 0 && <View style={styles.sep} />}
                <PostListRow
                  boardLabel={p.boardLabel}
                  boardLabelKo={p.boardLabelKo}
                  title={p.title}
                  createdAt={p.createdAt}
                  likeCount={p.likeCount}
                  commentCount={p.commentCount}
                  onPress={() => openPost(p)}
                />
              </View>
            ))
          )}
        </View>
      </View>
    );
  }

  if (loading && !schoolReady) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {ORDER.map(renderBlock)}
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // 下地は background より濃い groupedBackground — 白いカードを浮かせる
    container: { flex: 1, backgroundColor: theme.groupedBackground },
    content: { paddingTop: 18, paddingBottom: 32 },
    section: { marginHorizontal: 16, marginBottom: 26 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { fontSize: 21, fontWeight: "800", color: theme.textPrimary, letterSpacing: -0.3 },
    sectionSub: { fontSize: 12, color: theme.textSecondary, marginTop: 3, marginBottom: 10 },
    card: {
      borderRadius: 14,
      backgroundColor: theme.card,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    seeAll: { flexDirection: "row", alignItems: "center", paddingLeft: 8, paddingVertical: 4 },
    seeAllText: { fontSize: 13, color: theme.textSecondary },
    sep: { height: 1, backgroundColor: theme.border },
    blockSpinner: { paddingVertical: 20 },
    empty: { paddingHorizontal: 16, paddingVertical: 18, fontSize: 13, color: theme.textSecondary },
  });
}
