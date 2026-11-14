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
import { LOUNGES, isQaLounge, loungeLabel, forestOfLounge, type LoungeId } from "../../../src/types/lounge";
import { QA_TAGS } from "../../../src/types/board";

export default function LoungeWriteScreen() {
  const insets = useSafeAreaInsets();
  const { loungeId } = useLocalSearchParams<{ loungeId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const lounge = LOUNGES.find((l) => l.id === loungeId);
  // 質問掲示板はカテゴリを選べる（任意。学校の質問掲示板と同じ QA_TAGS）
  const isQa = isQaLounge(loungeId);
  const [tag, setTag] = useState<string | null>(null);
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
      await createLoungePost(loungeId as LoungeId, user.uid, title.trim(), body.trim(), isQa ? tag : null);
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
        <Text style={styles.anon}>
          {forestOfLounge(loungeId)?.id === "ryugakusei" ? t("lounge.anonNoticeRyugakusei") : t("lounge.anonNotice")}
        </Text>

        {isQa ? (
          <View style={styles.tagWrap}>
            {QA_TAGS.map((tg) => {
              const on = tag === tg.id;
              return (
                <TouchableOpacity
                  key={tg.id}
                  style={[styles.tagChip, on && styles.tagChipOn]}
                  onPress={() => setTag(on ? null : tg.id)}
                >
                  <Text style={[styles.tagChipText, on && styles.tagChipTextOn]}>
                    {language === "ko" ? tg.ko : tg.ja}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

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
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.card, padding: 16 },
    boardName: { fontSize: 13, color: theme.primary, fontWeight: "600", marginBottom: 2 },
    anon: { fontSize: 12, color: theme.textSecondary, marginBottom: 20 },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: -4, marginBottom: 20 },
    tagChip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    tagChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    tagChipText: { fontSize: 12.5, fontWeight: "700", color: theme.textSecondary },
    tagChipTextOn: { color: "#fff" },
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
