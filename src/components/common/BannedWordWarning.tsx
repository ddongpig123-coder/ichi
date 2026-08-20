import React, { useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

// 投稿前の禁止語警告（MODERATION.md §5 / Phase 1）。
// 「警告」であって「ブロック」ではない — 検知しても最終的には投稿できる。
// 誤検知で正当な投稿を止めないための設計判断。悪質な投稿は通報→運営対応が本線。
interface Props {
  visible: boolean;
  words: string[];      // 検出された語（利用者が直せるよう明示する）
  onEdit: () => void;   // 修正する（入力に戻る）
  onProceed: () => void; // このまま投稿する
}

export default function BannedWordWarning({ visible, words, onEdit, onProceed }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onEdit}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("moderation.bannedTitle")}</Text>
          <Text style={styles.desc}>{t("moderation.bannedDesc")}</Text>
          <View style={styles.wordRow}>
            {words.map((w) => (
              <View key={w} style={styles.wordChip}>
                <Text style={styles.wordText}>{w}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onProceed}>
              <Text style={styles.secondaryText}>{t("moderation.bannedPostAnyway")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={onEdit}>
              <Text style={styles.primaryText}>{t("moderation.bannedEdit")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      paddingHorizontal: 28,
      // Web では Modal が親と同じスタックに描画されるため、指定しないと
      // 背景側のボタン（投稿ボタンなど）がモーダルの上に重なって見える
      zIndex: 1000,
      elevation: 1000,
    },
    sheet: { backgroundColor: theme.card, borderRadius: 16, padding: 20 },
    title: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 8 },
    desc: { fontSize: 14, color: theme.textSecondary, lineHeight: 21 },
    wordRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
    wordChip: {
      backgroundColor: theme.accent + "1A",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    wordText: { fontSize: 13, color: theme.accent, fontWeight: "600" },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: theme.background,
    },
    secondaryText: { fontSize: 14, color: theme.textSecondary, fontWeight: "600" },
    primaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: theme.primary,
    },
    primaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  });
}
