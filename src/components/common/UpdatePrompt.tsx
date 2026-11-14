import { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";
import { needsStoreUpdate } from "../../config/storeVersion";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../services/friendInvite";

// 「新しいバージョンがあります」— ストアの最新版より古いアプリ（1.0.0 など）に 1 日 1 回だけ出す。
// 出すかどうかは src/config/storeVersion.ts の STORE_LATEST（リリース日に書き換えて OTA）。
// 強制ではない（「あとで」で閉じられる）。タブのレイアウトに 1 つだけ置く。

const KEY = "ichi:updatePromptDay";
const today = () => new Date().toISOString().slice(0, 10);

export default function UpdatePrompt() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!needsStoreUpdate()) return;
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((d) => {
        if (alive && d !== today()) setVisible(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function close() {
    setVisible(false);
    AsyncStorage.setItem(KEY, today()).catch(() => {});
  }

  function openStore() {
    close();
    Linking.openURL(Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL).catch(() => {});
  }

  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles-outline" size={30} color={theme.primary} />
          </View>
          <Text style={styles.title}>{t("update.title")}</Text>
          <Text style={styles.body}>{t("update.body")}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openStore} accessibilityRole="button">
            <Text style={styles.primaryText}>{t("update.go")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={close} accessibilityRole="button">
            <Text style={styles.laterText}>{t("update.later")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
    card: { width: "100%", maxWidth: 360, borderRadius: 20, backgroundColor: theme.card, padding: 22, alignItems: "center" },
    iconCircle: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primary + "18",
      justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "800", color: theme.textPrimary, textAlign: "center", marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 21, color: theme.textSecondary, textAlign: "center", marginBottom: 18 },
    primaryBtn: { width: "100%", alignItems: "center", backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14 },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    laterBtn: { paddingVertical: 12, paddingHorizontal: 20, marginTop: 4 },
    laterText: { color: theme.textSecondary, fontSize: 14, fontWeight: "700" },
  });
}
