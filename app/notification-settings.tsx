import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Linking, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";
import ScreenHeader from "../src/components/common/ScreenHeader";
import { notify } from "../src/utils/dialog";
import {
  canUsePush,
  getPushPermission,
  loadPushPrefs,
  setPushPrefs,
  DEFAULT_PUSH_PREFS,
  type PermissionState,
  type PushPrefs,
} from "../src/services/pushService";

// 通知の設定（プロフィール → 通知）。RELEASE-PLAN N2 / docs/PUSH-NOTIFICATIONS.md
// 種類は 2 つだけ: 自分の投稿へのコメント・返信 / メッセージ。お知らせ・広告の通知は送らない。
// 設定はこの端末ごと（端末ローカル + サーバーのトークン文書）。

const OFF: PushPrefs = { comments: false, messages: false };

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [prefs, setPrefs] = useState<PushPrefs>(OFF);
  const [permission, setPermission] = useState<PermissionState>("undetermined");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [p, perm] = await Promise.all([loadPushPrefs(), getPushPermission()]);
    setPermission(perm);
    // OS で通知を切っていたらオンに見せない。許可済みでまだ触っていなければ既定（両方オン）
    setPrefs(perm === "denied" ? OFF : p ?? (perm === "granted" ? DEFAULT_PUSH_PREFS : OFF));
  }, []);

  useEffect(() => {
    if (!canUsePush) return;
    refresh();
    // 「設定を開く」で OS の設定から戻ってきたら読み直す
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function toggle(key: keyof PushPrefs, value: boolean) {
    if (!user || busy) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setBusy(true);
    try {
      const r = await setPushPrefs(user.uid, language, next);
      if (r === "denied") {
        setPrefs(OFF);
        setPermission("denied");
        notify(t("push.deniedTitle"), t("push.deniedBody"));
      } else if (r === "failed" || r === "unavailable") {
        setPrefs(prefs);
        notify(t("push.failed"));
      } else {
        setPermission(await getPushPermission());
      }
    } finally {
      setBusy(false);
    }
  }

  const rows: { key: keyof PushPrefs; icon: ComponentProps<typeof Ionicons>["name"]; label: string; sub: string }[] = [
    { key: "comments", icon: "chatbubble-ellipses-outline", label: t("push.comments"), sub: t("push.commentsSub") },
    { key: "messages", icon: "mail-outline", label: t("push.messages"), sub: t("push.messagesSub") },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("push.title")} fallback="/(tabs)/profile" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        {!canUsePush ? (
          <Text style={[styles.note, { margin: 20 }]}>{t("push.needUpdate")}</Text>
        ) : (
          <>
            {permission === "denied" && (
              <View style={styles.osOffBox}>
                <Ionicons name="notifications-off-outline" size={18} color={theme.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.osOffText}>{t("push.osOff")}</Text>
                  <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
                    <Text style={styles.link}>{t("push.openSettings")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <Text style={styles.sectionTitle}>{t("push.sectionTitle")}</Text>
            <View style={styles.card}>
              {rows.map((r, i) => (
                <View key={r.key} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Ionicons name={r.icon} size={20} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{r.label}</Text>
                    <Text style={styles.rowSub}>{r.sub}</Text>
                  </View>
                  <Switch
                    value={prefs[r.key]}
                    onValueChange={(v) => toggle(r.key, v)}
                    disabled={busy || !user}
                    trackColor={{ true: theme.primary, false: theme.border }}
                    accessibilityLabel={r.label}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.note}>{t("push.noAds")}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.textSecondary, marginTop: 20, marginBottom: 8, marginHorizontal: 20 },
    card: { marginHorizontal: 16, borderRadius: 14, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    rowLabel: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    rowSub: { fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 3 },
    note: { fontSize: 12, lineHeight: 18, color: theme.textSecondary, marginHorizontal: 20, marginTop: 12 },
    osOffBox: {
      flexDirection: "row", gap: 10, alignItems: "flex-start", marginHorizontal: 16, marginTop: 16, padding: 12,
      borderRadius: 12, backgroundColor: theme.warning + "22",
    },
    osOffText: { fontSize: 13, lineHeight: 19, color: theme.textPrimary },
    link: { fontSize: 13, fontWeight: "700", color: theme.primary, marginTop: 6 },
  });
}
