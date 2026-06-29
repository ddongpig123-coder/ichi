import React, { useState } from "react";
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
import { createBoard } from "../../../src/services/boardService";
import type { BoardMeta } from "../../../src/types/board";

const CATEGORIES: { value: BoardMeta["category"]; label: string; desc: string }[] = [
  { value: "department", label: "学部別掲示板", desc: "特定の学部・学科向け" },
  { value: "custom",     label: "カスタム掲示板", desc: "自由にテーマを設定" },
];

export default function CreateBoardScreen() {
  const { user, schoolDomain } = useAuth();
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
          placeholderTextColor="#bbb"
          value={label}
          onChangeText={setLabel}
          maxLength={30}
        />
        <Text style={styles.charCount}>{label.length}/30</Text>

        <Text style={styles.sectionLabel}>説明</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="この掲示板について説明してください"
          placeholderTextColor="#bbb"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA", padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#555", marginTop: 20, marginBottom: 8 },
  required: { color: "#E8334A" },
  categoryRow: { flexDirection: "row", gap: 10 },
  catBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  catBtnActive: { borderColor: "#2F6AD9", backgroundColor: "#EEF3FF" },
  catLabel: { fontSize: 14, fontWeight: "700", color: "#888", marginBottom: 4 },
  catLabelActive: { color: "#2F6AD9" },
  catDesc: { fontSize: 11, color: "#bbb" },
  catDescActive: { color: "#6D9EF5" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 14,
    fontSize: 15,
    color: "#1A1A2E",
  },
  textarea: { height: 80, textAlignVertical: "top" },
  charCount: { fontSize: 11, color: "#bbb", textAlign: "right", marginTop: 4 },
  submitBtn: {
    marginTop: 32,
    backgroundColor: "#2F6AD9",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
