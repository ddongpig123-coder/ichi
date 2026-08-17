import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";

// お問い合わせ画面。バグ報告・要望・削除依頼などをメールで受ける導線。
// ※ 문의 이메일 주소는 아직 미확정(약관 자리표시자와 동일 사안).
//   확정되면 CONTACT_EMAIL만 교체하면 됨. (12월 스토어 준비 때 확정)
const CONTACT_EMAIL = "support@ichi.example"; // TODO: 정식 문의 이메일로 교체

export default function ContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  async function openMail() {
    const subject = encodeURIComponent(t("contact.mailSubject"));
    const url = `mailto:${CONTACT_EMAIL}?subject=${subject}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else notify();
    } catch {
      notify();
    }
  }

  function notify() {
    const msg = `${t("contact.emailLabel")}: ${CONTACT_EMAIL}`;
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert(t("contact.title"), msg);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("contact.title")}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.lead}>{t("contact.lead")}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t("contact.emailLabel")}</Text>
          <Text style={styles.cardEmail} selectable>{CONTACT_EMAIL}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={openMail}>
          <Text style={styles.buttonText}>{t("contact.sendButton")}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>{t("contact.note")}</Text>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    backIcon: { fontSize: 30, color: theme.primary, lineHeight: 32 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    body: { paddingHorizontal: 20, paddingTop: 8 },
    lead: { fontSize: 14, color: theme.textPrimary, lineHeight: 21, marginBottom: 20 },
    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 16,
      marginBottom: 16,
    },
    cardLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
    cardEmail: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    note: { fontSize: 12, color: theme.textSecondary, marginTop: 16, lineHeight: 18 },
  });
}
