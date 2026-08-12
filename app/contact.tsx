import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import { submitInquiry } from "../src/services/inquiryService";
import type { Theme } from "../src/theme/themes";

// お問い合わせフォーム。内容（必須）+ 返信先（任意）を inquiries に保存。
export default function ContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user, schoolDomain } = useAuth();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  function notify(msg: string) {
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert(msg);
  }

  async function handleSubmit() {
    if (!message.trim()) {
      notify(t("contact.empty"));
      return;
    }
    if (!user) {
      notify(t("post.loginRequired"));
      return;
    }
    setBusy(true);
    try {
      await submitInquiry(user.uid, message, { contact, schoolDomain });
      setMessage("");
      setContact("");
      notify(t("contact.sent"));
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      notify(`${t("contact.failed")}${e?.message ? `\n${e.message}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("contact.title")}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.desc}>{t("contact.desc")}</Text>

        <Text style={styles.label}>{t("contact.messageLabel")}</Text>
        <TextInput
          style={styles.messageInput}
          placeholder={t("contact.messagePlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>{t("contact.contactLabel")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("contact.contactPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity
          style={[styles.submitBtn, (!message.trim() || busy) && styles.disabled]}
          onPress={handleSubmit}
          disabled={!message.trim() || busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t("contact.submit")}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>{t("contact.note")}</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      height: 48,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 32, color: theme.primary, lineHeight: 34, width: 30 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    content: { padding: 20, gap: 8 },
    desc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 8 },
    label: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      backgroundColor: theme.card,
    },
    messageInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      backgroundColor: theme.card,
      minHeight: 140,
    },
    submitBtn: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 20,
    },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.4 },
    note: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginTop: 16 },
  });
}
