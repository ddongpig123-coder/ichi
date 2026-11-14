import React, { useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import { timeAgo } from "../../i18n/translations";
import type { Theme } from "../../theme/themes";

// ベスト投稿（いいね数トップ N）の一覧。学校の森（app/(tabs)/boards/best.tsx）と
// みんなの森・留学生の森（app/lounge/best.tsx）で同じ見た目にするための共通部品。
// データの読み込み・エラー表示は各画面が持ち、ここは並べて描くだけ。
export interface BestPostItem {
  id: string;
  label: string;          // 板の名前（表示言語に合わせたもの）
  title: string;
  likeCount: number;
  commentCount: number;
  createdAt: number;
}

interface Props {
  items: BestPostItem[];
  headerSub: string;
  refreshing: boolean;
  onRefresh: () => void;
  onPressItem: (item: BestPostItem) => void;
}

export default function BestPostList({ items, headerSub, refreshing, onRefresh, onPressItem }: Props) {
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("boards.bestTitle")}</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>{t("boards.bestEmpty")}</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity style={styles.row} onPress={() => onPressItem(item)}>
          <View style={styles.rankBadge}>
            <Text style={[styles.rank, index < 3 && styles.rankTop]}>{index + 1}</Text>
          </View>
          <View style={styles.content}>
            <View style={styles.tagRow}>
              <View style={styles.boardTag}>
                <Text style={styles.boardTagText}>{item.label}</Text>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}><Ionicons name="heart-outline" size={12} color={theme.textSecondary} /> {item.likeCount}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}><Ionicons name="chatbubble-outline" size={12} color={theme.textSecondary} /> {item.commentCount}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>{timeAgo(language, item.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    header: { padding: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: theme.textPrimary },
    headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    sep: { height: 1, backgroundColor: theme.border },
    row: {
      flexDirection: "row",
      backgroundColor: theme.card,
      padding: 16,
      alignItems: "center",
      gap: 12,
    },
    rankBadge: { width: 32, alignItems: "center" },
    rank: { fontSize: 16, fontWeight: "700", color: theme.textSecondary },
    rankTop: { color: theme.accent },
    content: { flex: 1 },
    tagRow: { flexDirection: "row", marginBottom: 4 },
    boardTag: {
      backgroundColor: theme.primary + "1A",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    boardTagText: { fontSize: 11, color: theme.primary, fontWeight: "600" },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 },
    meta: { flexDirection: "row", gap: 6 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    empty: { color: theme.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 },
  });
}
