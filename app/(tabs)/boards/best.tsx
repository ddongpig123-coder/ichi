import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useHidden } from "../../../src/contexts/HiddenContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { fetchBestPosts } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import type { Post } from "../../../src/types/board";
import LoadError from "../../../src/components/common/LoadError";
import BestPostList from "../../../src/components/boards/BestPostList";

type BestPost = Post & { boardLabel: string };

// 学校の森のベスト投稿（いいね数トップ20）。みんなの森・留学生の森は app/lounge/best.tsx（同じ一覧部品）
export default function BestPostsScreen() {
  const { schoolDomain } = useAuth();
  const { isHidden } = useHidden();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [posts, setPosts] = useState<BestPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!schoolDomain) return;
    try {
      const res = await fetchBestPosts(schoolDomain);
      setPosts(res);
      setLoadError(false);
    } catch (e) {
      // 失敗を「ベスト投稿なし」に見せない
      console.warn("best posts load failed:", e);
      setLoadError(true);
    }
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

  const byId = new Map(posts.map((p) => [p.id, p]));
  return (
    <BestPostList
      items={posts
        .filter((p) => !isHidden(p.id))
        .map((p) => ({
          id: p.id,
          label: p.boardLabel,
          title: p.title,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
        }))}
      headerSub={t("boards.bestHeaderSub")}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onPressItem={(item) => {
        const p = byId.get(item.id);
        if (p) router.push(`/post/${p.boardId}/${p.id}`);
      }}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, backgroundColor: theme.background },
  });
}
