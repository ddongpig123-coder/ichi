import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useHidden } from "../../src/contexts/HiddenContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { fetchBestLoungePosts, type BestLoungePost } from "../../src/services/loungeService";
import type { Theme } from "../../src/theme/themes";
import { FORESTS, LOUNGES, forestLabel, loungeLabel, type ForestId } from "../../src/types/lounge";
import LoadError from "../../src/components/common/LoadError";
import BestPostList from "../../src/components/boards/BestPostList";

// みんなの森・留学生の森のベスト投稿（その森の板ぜんぶから いいね数トップ20）。
// 森の板一覧の最上段「ベスト投稿」から /lounge/best?forest=minna|ryugakusei で来る。
// 学校の森の app/(tabs)/boards/best.tsx と同じ一覧部品（2026-11-14 森の構成を学校の森に揃えた）。
export default function ForestBestScreen() {
  const params = useLocalSearchParams<{ forest?: string }>();
  const forest = FORESTS.find((f) => f.id === params.forest);
  const { isHidden } = useHidden();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const navigation = useNavigation();
  const [posts, setPosts] = useState<BestLoungePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: forest ? `${forestLabel(forest, language)} ${t("boards.bestTitle")}` : t("boards.bestTitle") });
  }, [navigation, forest, language, t]);

  async function load() {
    if (!forest) return;
    try {
      setPosts(await fetchBestLoungePosts(forest.id as ForestId));
      setLoadError(false);
    } catch (e) {
      // 失敗を「ベスト投稿なし」に見せない
      console.warn("forest best posts load failed:", e);
      setLoadError(true);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [forest?.id]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

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
        .map((p) => {
          const l = LOUNGES.find((x) => x.id === p.loungeId);
          return {
            id: p.id,
            label: l ? loungeLabel(l, language) : "",
            title: p.title,
            likeCount: p.likeCount,
            commentCount: p.commentCount,
            createdAt: p.createdAt,
          };
        })}
      headerSub={forest ? `${forestLabel(forest, language)} · ${t("boards.bestHeaderSub")}` : t("boards.bestHeaderSub")}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onPressItem={(item) => {
        const p = byId.get(item.id);
        if (p) router.push(`/lounge/${p.loungeId}/${p.id}`);
      }}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, backgroundColor: theme.background },
  });
}
