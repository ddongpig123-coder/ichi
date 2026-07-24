import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useBlock } from "../../contexts/BlockContext";
import { createReport } from "../../services/reportService";
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from "../../types/moderation";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { TranslationKey } from "../../i18n/translations";
import type { Theme } from "../../theme/themes";

// 通報理由 → 辞書キー（ラベル文字列は translations.ts 側で管理）
const REASON_KEYS: Record<ReportReason, TranslationKey> = {
  spam: "report.reasonSpam",
  abuse: "report.reasonAbuse",
  defamation: "report.reasonDefamation",
  privacy: "report.reasonPrivacy",
  illegal: "report.reasonIllegal",
  other: "report.reasonOther",
};

// 投稿・コメント・メッセージ共通の「⋯」メニュー。
// menu → 通報(理由選択) / ブロック(確認) / 削除(確認) の2段構成。
// Alert の複数ボタンは Web で不安定なため、確認はモーダル内で完結させる。
interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetPath: string;
  targetAuthorUid: string;
  canBlock?: boolean; // 自分の投稿には false を渡す
  onBlocked?: () => void; // ブロック成功時（一覧の再描画などに使用）
  // 自分の投稿の削除。パスがボード/ラウンジ/コメントで異なるため、
  // 実際の削除処理は呼び出し側が渡す（このメニューはサービス層を知らない）。
  // 渡された かつ 自分の投稿 のときだけ「削除」が出る。
  onDelete?: () => Promise<void>;
}

type Mode = "menu" | "report" | "confirmBlock" | "confirmDelete";

export default function ModerationMenu({
  visible,
  onClose,
  targetType,
  targetPath,
  targetAuthorUid,
  canBlock = true,
  onBlocked,
  onDelete,
}: Props) {
  const { user } = useAuth();
  const { block } = useBlock();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [mode, setMode] = useState<Mode>("menu");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSelf = !!user && user.uid === targetAuthorUid;
  const showBlock = canBlock && !isSelf;
  const showDelete = isSelf && !!onDelete;

  function reset() {
    setMode("menu");
    setReason(null);
    setDetail("");
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmitReport() {
    if (!user || !reason) return;
    setSubmitting(true);
    try {
      await createReport(user.uid, {
        targetType,
        targetPath,
        targetAuthorUid,
        reason,
        detail,
      });
      handleClose();
      Alert.alert(t("report.submitted"), t("report.submittedMessage"));
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert(t("report.failed"), e?.message ?? "");
    }
  }

  async function handleConfirmDelete() {
    if (!onDelete) return;
    setSubmitting(true);
    try {
      await onDelete();
      handleClose();
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert(t("moderation.deleteFailed"), e?.message ?? "");
    }
  }

  async function handleConfirmBlock() {
    if (!user) return;
    setSubmitting(true);
    try {
      await block(targetAuthorUid);
      handleClose();
      onBlocked?.();
      Alert.alert(t("report.blocked"), t("report.blockedMessage"));
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert(t("report.blockFailed"), e?.message ?? "");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          {mode === "menu" && (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={() => setMode("report")}>
                <Text style={styles.menuText}>{t("report.menuReport")}</Text>
              </TouchableOpacity>
              {showBlock && (
                <TouchableOpacity style={styles.menuItem} onPress={() => setMode("confirmBlock")}>
                  <Text style={styles.menuTextDanger}>{t("report.menuBlock")}</Text>
                </TouchableOpacity>
              )}
              {showDelete && (
                <TouchableOpacity style={styles.menuItem} onPress={() => setMode("confirmDelete")}>
                  <Text style={styles.menuTextDanger}>{t("moderation.menuDelete")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.menuItem, styles.cancelItem]} onPress={handleClose}>
                <Text style={styles.cancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === "report" && (
            <>
              <Text style={styles.title}>{t("report.chooseReason")}</Text>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.reasonItem, reason === r.value && styles.reasonItemActive]}
                  onPress={() => setReason(r.value)}
                >
                  <Text style={[styles.reasonText, reason === r.value && styles.reasonTextActive]}>
                    {reason === r.value ? "● " : "○ "}
                    {t(REASON_KEYS[r.value])}
                  </Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.detailInput}
                placeholder={t("report.detailPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                value={detail}
                onChangeText={setDetail}
                multiline
                maxLength={300}
              />
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode("menu")}>
                  <Text style={styles.secondaryText}>{t("common.back")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, (!reason || submitting) && styles.disabled]}
                  onPress={handleSubmitReport}
                  disabled={!reason || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryText}>{t("common.send")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === "confirmDelete" && (
            <>
              <Text style={styles.title}>{t("moderation.deleteTitle")}</Text>
              <Text style={styles.confirmDesc}>{t("moderation.deleteDesc")}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode("menu")}>
                  <Text style={styles.secondaryText}>{t("common.back")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dangerBtn, submitting && styles.disabled]}
                  onPress={handleConfirmDelete}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryText}>{t("common.delete")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === "confirmBlock" && (
            <>
              <Text style={styles.title}>{t("report.blockTitle")}</Text>
              <Text style={styles.confirmDesc}>{t("report.blockDesc")}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode("menu")}>
                  <Text style={styles.secondaryText}>{t("common.back")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dangerBtn, submitting && styles.disabled]}
                  onPress={handleConfirmBlock}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryText}>{t("report.blockAction")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
      // BannedWordWarning と同じ理由（Web でのスタック順）
      zIndex: 1000,
      elevation: 1000,
    },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      paddingBottom: 32,
      gap: 8,
    },
    menuItem: { paddingVertical: 14, alignItems: "center", borderRadius: 10 },
    menuText: { fontSize: 16, color: theme.textPrimary, fontWeight: "600" },
    menuTextDanger: { fontSize: 16, color: theme.accent, fontWeight: "600" },
    cancelItem: { backgroundColor: theme.background, marginTop: 4 },
    cancelText: { fontSize: 15, color: theme.textSecondary, fontWeight: "600" },
    title: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 8, textAlign: "center" },
    reasonItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
    reasonItemActive: { backgroundColor: theme.primary + "1A" },
    reasonText: { fontSize: 15, color: theme.textPrimary },
    reasonTextActive: { color: theme.primary, fontWeight: "700" },
    detailInput: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      color: theme.textPrimary,
      minHeight: 60,
      maxHeight: 120,
      marginTop: 8,
    },
    confirmDesc: { fontSize: 14, color: theme.textSecondary, lineHeight: 21, marginBottom: 8 },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: theme.background,
    },
    secondaryText: { fontSize: 15, color: theme.textSecondary, fontWeight: "600" },
    primaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: theme.primary,
    },
    dangerBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: theme.accent,
    },
    primaryText: { fontSize: 15, color: "#fff", fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });
}
