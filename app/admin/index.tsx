import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { isOperator, listQueue } from "../../src/services/contentQueueService";
import { queueTargetLabel, type ContentQueueItem, type ContentQueueStatus } from "../../src/types/contentQueue";
import { timeAgo, type TranslationKey } from "../../src/i18n/translations";
import type { Theme } from "../../src/theme/themes";
import ScreenHeader from "../../src/components/common/ScreenHeader";

// コンテンツ管理（運営アカウント専用・docs/CONTENT-OPS.md §9）。
// 下書き → 承認 → GitHub Actions が予約投稿。ここでは一覧と新規作成への導線だけを持つ。
const TABS: { status: ContentQueueStatus; label: TranslationKey }[] = [
  { status: "draft", label: "admin.tabDraft" },
  { status: "approved", label: "admin.tabApproved" },
  { status: "posted", label: "admin.tabPosted" },
  { status: "rejected", label: "admin.tabRejected" },
];

export default function ContentQueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [allowed, setAllowed] = useState<boolean | null>(null); // null = 確認中
  const [status, setStatus] = useState<ContentQueueStatus>("draft");
  const [items, setItems] = useState<ContentQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 編集画面から戻ったときに最新化するため、フォーカスのたびに読み直す
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let alive = true;
      (async () => {
        const ok = await isOperator(user.uid);
        if (!alive) return;
        setAllowed(ok);
        if (!ok) return;
        setLoading(true);
        try {
          const list = await listQueue(status);
          if (alive) setItems(list);
        } catch (e) {
          console.warn("listQueue failed:", e);
          if (alive) setItems([]);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [user, status])
  );

  const header = (
    <ScreenHeader
      title={t("admin.menu")}
      fallback="/(tabs)/profile"
      right={
        allowed ? (
            <TouchableOpacity onPress={() => router.push("/admin/edit")} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.headerAction}>{t("admin.new")}</Text>
            </TouchableOpacity>
        ) : undefined
      }
    />
  );

  if (allowed === null) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      </View>
    );
  }
  if (!allowed) {
    return (
      <View style={styles.container}>
        {header}
        <Text style={styles.empty}>{t("admin.noPermission")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.status}
            style={[styles.tab, status === tab.status && styles.tabActive]}
            onPress={() => setStatus(tab.status)}
          >
            <Text style={[styles.tabText, status === tab.status && styles.tabTextActive]}>{t(tab.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {status === "approved" && items.length > 0 ? (
        <Text style={styles.hint}>{t("admin.approvedHint")}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 20 + insets.bottom }}
          ListEmptyComponent={<Text style={styles.empty}>{t("admin.empty")}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/admin/edit", params: { id: item.id } })}
            >
              <View style={styles.metaRow}>
                <Text style={[styles.badge, item.source === "ai" && styles.badgeAi]}>
                  {t(item.source === "ai" ? "admin.sourceAi" : "admin.sourceManual")}
                </Text>
                <Text style={styles.badge}>{queueTargetLabel(item, language)}</Text>
                {item.topic ? <Text style={styles.metaText}>{item.topic}</Text> : null}
                <Text style={[styles.metaText, { marginLeft: "auto" }]}>
                  {timeAgo(language, item.status === "posted" && item.postedAt ? item.postedAt : item.createdAt)}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    headerAction: { fontSize: 14, fontWeight: "700", color: theme.primary },
    tabs: {
      flexDirection: "row",
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderColor: "transparent" },
    tabActive: { borderColor: theme.primary },
    tabText: { fontSize: 13, color: theme.textSecondary, fontWeight: "600" },
    tabTextActive: { color: theme.primary },
    hint: { fontSize: 12, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 10 },
    empty: { textAlign: "center", color: theme.textSecondary, marginTop: 40, fontSize: 14 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 12,
      gap: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    badge: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.textSecondary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
      overflow: "hidden",
    },
    badgeAi: { color: theme.primary, borderColor: theme.primary },
    metaText: { fontSize: 11, color: theme.textSecondary },
    title: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    body: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  });
}
