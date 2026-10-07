import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { createPost } from "../../../src/services/boardService";
import { findBannedWords } from "../../../src/utils/contentFilter";
import BannedWordWarning from "../../../src/components/common/BannedWordWarning";
import type { Theme } from "../../../src/theme/themes";
import { BOARDS, isQaBoard, QA_TAGS, type BoardId } from "../../../src/types/board";

export default function WriteScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const board = BOARDS.find((b) => b.id === boardId);
  const isQa = isQaBoard(boardId as string);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 禁止語が見つかったら警告を挟む。無視して投稿することもできる（警告であって制限ではない）
  const [bannedWords, setBannedWords] = useState<string[]>([]);

  async function handleSubmit() {
    if (!title.trim()) { Alert.alert(t("post.titleRequired")); return; }
    if (!body.trim())  { Alert.alert(t("post.bodyRequired")); return; }
    if (!user || !schoolDomain) { Alert.alert(t("post.loginRequired")); return; }

    const hits = findBannedWords(title, body);
    if (hits.length) { setBannedWords(hits); return; }
    await submitPost();
  }

  async function submitPost() {
    if (!user || !schoolDomain) return;
    setBannedWords([]);
    setSubmitting(true);
    try {
      await createPost(schoolDomain, boardId as BoardId, user.uid, title.trim(), body.trim(), isQa ? tag : null);
      router.back();
    } catch (e: any) {
      Alert.alert(t("post.submitFailed"), e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.boardName}>{board?.label}</Text>
        <Text style={styles.anon}>{t("post.anonNotice")}</Text>

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
          maxLength={100}
        />
        <TextInput
          style={styles.bodyInput}
          placeholder={t("post.bodyPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting}
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
    anon: { fontSize: 12, color: theme.textSecondary, marginBottom: 16 },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 20 },
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
    disabled: { opacity: 0.6 },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
