import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

// 学校未選択（AuthContext.schoolDomain === null）のユーザーに、学校掲示板の代わりに
// 「学校を選択」導線を出す共通コンポーネント。全国の留学生ラウンジは別途使えることを案内。
// 掲示板一覧・メッセージ一覧などで再利用する。
export default function SchoolPrompt() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🏫</Text>
      <Text style={styles.title}>{t("school.promptTitle")}</Text>
      <Text style={styles.body}>{t("school.promptBody")}</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.push("/onboarding")}>
        <Text style={styles.buttonText}>{t("school.promptButton")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      paddingHorizontal: 32,
      paddingVertical: 40,
    },
    icon: { fontSize: 40, marginBottom: 12 },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 8,
      textAlign: "center",
    },
    body: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}
