import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { createLoungePost } from "../../../src/services/loungeService";
import { findBannedWords } from "../../../src/utils/contentFilter";
import { friendlyErrorBody } from "../../../src/utils/writeError";
import { notify } from "../../../src/utils/dialog";
import { useConfirmDiscard } from "../../../src/hooks/useConfirmDiscard";
import { POST_BODY_MAX, POST_TITLE_MAX } from "../../../src/data/limits";
import BannedWordWarning from "../../../src/components/common/BannedWordWarning";
import type { Theme } from "../../../src/theme/themes";
import { LOUNGES, loungeLabel, type LoungeId } from "../../../src/types/lounge";

export default function LoungeWriteScreen() {
  const insets = useSafeAreaInsets();
  const { loungeId } = useLocalSearchParams<{ loungeId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const lounge = LOUNGES.find((l) => l.id === loungeId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;
  const leave = useConfirmDiscard(title.trim().length > 0 || body.trim().length > 0);

  async function handleSubmit() {
    if (!title.trim()) { notify(t("post.titleRequired")); return; }
    if (!body.trim())  { notify(t("post.bodyRequired")); return; }
    if (!user) { notify(t("post.loginRequired")); return; }

    const hits = findBannedWords(title, body);
    if (hits.length) { setBannedWords(hits); return; }
    await submitPost();
  }

  async function submitPost() {
    if (!user) return;
    setBannedWords([]);
    setSubmitting(true);
    try {
      await createLoungePost(loungeId as LoungeId, user.uid, title.trim(), body.trim());
      leave(() => router.back());
    } catch (e: any) {
      notify(t("post.submitFailed"), friendlyErrorBody(e, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <Text style={styles.boardName}>{lounge ? loungeLabel(lounge, language) : ""}</Text>
        <Text style={styles.anon}>{t("lounge.anonNotice")}</Text>

        <TextInput
          style={styles.titleInput}
          placeholder={t("post.titlePlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={POST_TITLE_MAX}
        />
        <TextInput
          style={styles.bodyInput}
          placeholder={t("post.bodyPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={body}
          onChangeText={setBody}
          maxLength={POST_BODY_MAX}
          multiline
          textAlignVertical="top"
        />
        {/* 上限に近づいたときだけ残りを出す（普段は画面を静かに保つ） */}
        {body.length >= POST_BODY_MAX * 0.8 && (
          <Text style={[styles.counter, body.length >= POST_BODY_MAX && styles.counterFull]}>
            {body.length} / {POST_BODY_MAX}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !canSubmit) && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting || !canSubmit}
        >
          <Text style={styles.submitText}>{submitting ? t("post.submitting") : t("post.submit")}</Text>
        </TouchableOpacity>
      </ScrollView>

      <BannedWordWarning
        visible={bannedWords.length > 0}
        words={bannedWords}
        onEdit={() => setBannedWords([])}
        onProceed={submitPost}
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.card, padding: 16 },
    boardName: { fontSize: 13, color: theme.primary, fontWeight: "600", marginBottom: 2 },
    anon: { fontSize: 12, color: theme.textSecondary, marginBottom: 20 },
    titleInput: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      fontSize: 18,
      fontWeight: "600",
      paddingVertical: 12,
      marginBottom: 16,
      color: theme.textPrimary,
    },
    bodyInput: {
      fontSize: 15,
      color: theme.textPrimary,
      minHeight: 200,
      lineHeight: 24,
    },
    submitBtn: {
      marginTop: 32,
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
    },
    disabled: { opacity: 0.4 },
    counter: { fontSize: 12, color: theme.textSecondary, textAlign: "right", marginTop: 6 },
    counterFull: { color: theme.accent, fontWeight: "700" },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
