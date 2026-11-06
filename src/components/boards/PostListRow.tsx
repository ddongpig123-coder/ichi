import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import { timeAgo } from "../../i18n/translations";
import type { Theme } from "../../theme/themes";

// 投稿 1 行（板名タグ + タイトル + 時刻・いいね・コメント数）。
// 掲示板タブのホーム（森ごとの新着）・スクラップ・コメントした投稿で共通。
// 絵文字・大きなアイコンは出さない（2026-11-06 準熙: 一覧からアイコンを無くす）。
// likeCount / commentCount を渡さなければ時刻だけ出す（スクラップ等は数を写していない）。
export default function PostListRow({
  boardLabel,
  boardLabelKo,
  title,
  createdAt,
  likeCount,
  commentCount,
  dot,
  onPress,
  onLongPress,
}: {
  boardLabel: string;
  boardLabelKo?: string;
  title: string;
  createdAt?: number;
  likeCount?: number;
  commentCount?: number;
  dot?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { theme } = useTheme();
  const { language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const label = language === "ko" && boardLabelKo ? boardLabelKo : boardLabel;
  const hasCounts = likeCount !== undefined || commentCount !== undefined;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress} delayLongPress={400}>
      <View style={styles.top}>
        <Text style={styles.tag} numberOfLines={1}>{label}</Text>
        {dot && <View style={styles.dot} />}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.meta}>
        {createdAt ? timeAgo(language, createdAt) : ""}
        {hasCounts && (
          <>
            {createdAt ? " · " : ""}
            <Ionicons name="heart-outline" size={12} color={theme.textSecondary} /> {likeCount ?? 0} ·{" "}
            <Ionicons name="chatbubble-outline" size={12} color={theme.textSecondary} /> {commentCount ?? 0}
          </>
        )}
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.card },
    top: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
    tag: { fontSize: 11, color: theme.primary, fontWeight: "600" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger, marginLeft: 6 },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 4 },
    meta: { fontSize: 12, color: theme.textSecondary },
  });
}
