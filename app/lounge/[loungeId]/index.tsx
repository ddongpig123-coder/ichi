import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import { fetchLoungePosts } from "../../../src/services/loungeService";
import type { Theme } from "../../../src/theme/themes";
import { LOUNGES, type LoungeId, type LoungePost } from "../../../src/types/lounge";

export default function LoungePostListScreen() {
  const { loungeId } = useLocalSearchParams<{ loungeId: string }>();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { isBlocked } = useBlock();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const navigation = useNavigation();

  const lounge = LOUNGES.find((l) => l.id === loungeId);

  React.useEffect(() => {
    if (lounge) navigation.setOptions({ title: lounge.label });
  }, [lounge]);

  const [posts, setPosts] = useState<LoungePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!loungeId) return;
    const p = await fetchLoungePosts(loungeId as LoungeId);
    setPosts(p);
  }, [loungeId]);

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
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>{t("boards.noPosts")}</Text>
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
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{t("boards.anonymous")}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>{timeAgo(language, item.createdAt)}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>❤️ {item.likeCount}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>💬 {item.commentCount}</Text>
              </View>
            </TouchableOpacity>
          )
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/lounge/${loungeId}/write`)}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    sep: { height: 1, backgroundColor: theme.border },
    row: { backgroundColor: theme.card, padding: 16 },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 },
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
