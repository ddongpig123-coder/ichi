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
import { createPost } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import { BOARDS, type BoardId } from "../../../src/types/board";

export default function WriteScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const board = BOARDS.find((b) => b.id === boardId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) { Alert.alert("タイトルを入力してください"); return; }
    if (!body.trim())  { Alert.alert("本文を入力してください"); return; }
    if (!user || !schoolDomain) { Alert.alert("ログインが必要です"); return; }

    setSubmitting(true);
    try {
      await createPost(schoolDomain, boardId as BoardId, user.uid, title.trim(), body.trim());
      router.back();
    } catch (e: any) {
      Alert.alert("投稿に失敗しました", e.message);
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
        <Text style={styles.anon}>匿名で投稿されます</Text>

        <TextInput
          style={styles.titleInput}
          placeholder="タイトル"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
        <TextInput
          style={styles.bodyInput}
          placeholder="本文を入力..."
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
          <Text style={styles.submitText}>{submitting ? "投稿中..." : "投稿する"}</Text>
        </TouchableOpacity>
      </ScrollView>
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
    disabled: { opacity: 0.6 },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
