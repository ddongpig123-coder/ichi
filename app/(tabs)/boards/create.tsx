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
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { createBoard } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import type { BoardMeta } from "../../../src/types/board";

const CATEGORIES: { value: BoardMeta["category"]; label: string; desc: string }[] = [
  { value: "department", label: "学部別掲示板", desc: "特定の学部・学科向け" },
  { value: "custom",     label: "カスタム掲示板", desc: "自由にテーマを設定" },
];

export default function CreateBoardScreen() {
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BoardMeta["category"]>("custom");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!label.trim()) { Alert.alert("掲示板名を入力してください"); return; }
    if (!user || !schoolDomain) return;
    setSubmitting(true);
    try {
      await createBoard(schoolDomain, label.trim(), description.trim(), category, user.uid);
      router.back();
    } catch (e: any) {
      Alert.alert("作成に失敗しました", e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>カテゴリ</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.catBtn, category === cat.value && styles.catBtnActive]}
              onPress={() => setCategory(cat.value)}
            >
              <Text style={[styles.catLabel, category === cat.value && styles.catLabelActive]}>
                {cat.label}
              </Text>
              <Text style={[styles.catDesc, category === cat.value && styles.catDescActive]}>
                {cat.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>掲示板名 <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="例：情報工学科、サークル情報など"
          placeholderTextColor={theme.textSecondary}
          value={label}
          onChangeText={setLabel}
          maxLength={30}
        />
        <Text style={styles.charCount}>{label.length}/30</Text>

        <Text style={styles.sectionLabel}>説明</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="この掲示板について説明してください"
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={100}
        />
        <Text style={styles.charCount}>{description.length}/100</Text>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "作成中..." : "掲示板を作成"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, padding: 16 },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: theme.textSecondary, marginTop: 20, marginBottom: 8 },
    required: { color: theme.accent },
    categoryRow: { flexDirection: "row", gap: 10 },
    catBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    catBtnActive: { borderColor: theme.primary, backgroundColor: theme.primary + "1A" },
    catLabel: { fontSize: 14, fontWeight: "700", color: theme.textSecondary, marginBottom: 4 },
    catLabelActive: { color: theme.primary },
    catDesc: { fontSize: 11, color: theme.textSecondary },
    catDescActive: { color: theme.primary },
    input: {
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      fontSize: 15,
      color: theme.textPrimary,
    },
    textarea: { height: 80, textAlignVertical: "top" },
    charCount: { fontSize: 11, color: theme.textSecondary, textAlign: "right", marginTop: 4 },
    submitBtn: {
      marginTop: 32,
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
    },
    disabled: { opacity: 0.5 },
    submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
}
