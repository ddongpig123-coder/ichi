import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { useNotifications } from "../../../src/contexts/NotificationsContext";
import type { Theme } from "../../../src/theme/themes";

// 自分の活動メニュー（掲示板タブ右上の人型アイコンから）。
// 自分の投稿 / コメントした投稿 / スクラップ — 以前ホームに出ていた「自分の投稿」バナーをここへ移した
//（2026-11-06 準熙: エブリタイムの「내 활동」相当）。
export default function ActivityMenuScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { newCommentCount } = useNotifications();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const rows: { key: string; label: string; sub?: string; href: Href; dot?: boolean }[] = [
    { key: "mine", label: t("myPosts.title"), sub: t("myPosts.sub"), href: "/(tabs)/boards/my-posts", dot: newCommentCount > 0 },
    { key: "commented", label: t("boards.commentedTitle"), href: "/(tabs)/boards/commented" },
    { key: "scraps", label: t("boards.scrapsTitle"), sub: t("boards.scrapsHint"), href: "/(tabs)/boards/scraps" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.group}>
        {rows.map((r, i) => (
          <View key={r.key}>
            {i > 0 && <View style={styles.sep} />}
            <TouchableOpacity style={styles.row} onPress={() => router.push(r.href)}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{r.label}</Text>
                  {r.dot && <View style={styles.dot} />}
                </View>
                {r.sub ? <Text style={styles.sub}>{r.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.groupedBackground, paddingTop: 12 },
    group: {
      marginHorizontal: 12,
      borderRadius: 14,
      backgroundColor: theme.card,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
    labelRow: { flexDirection: "row", alignItems: "center" },
    label: { fontSize: 16, fontWeight: "600", color: theme.textPrimary },
    sub: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger, marginLeft: 6 },
    sep: { height: 1, backgroundColor: theme.border },
  });
}
