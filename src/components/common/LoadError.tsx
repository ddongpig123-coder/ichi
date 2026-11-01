import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

// 読み込み失敗の表示（「見つかりません」と区別する）。通信が戻ったらその場で再試行できる。
export default function LoadError({ onRetry }: { onRetry: () => void }) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.box}>
      <Ionicons name="cloud-offline-outline" size={32} color={theme.textSecondary} />
      <Text style={styles.title}>{t("common.loadFailed")}</Text>
      <Text style={styles.hint}>{t("common.networkError")}</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.7}>
        <Ionicons name="refresh" size={15} color={theme.primary} />
        <Text style={styles.buttonText}>{t("common.retry")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    box: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8, backgroundColor: theme.background },
    title: { fontSize: 15, fontWeight: "700", color: theme.textPrimary, marginTop: 4 },
    hint: { fontSize: 13, color: theme.textSecondary, textAlign: "center", lineHeight: 19 },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    buttonText: { fontSize: 14, fontWeight: "700", color: theme.primary },
  });
}
