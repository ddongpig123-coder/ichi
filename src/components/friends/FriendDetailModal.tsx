import { useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Pressable, Image, StyleSheet } from "react-native";
import DefaultAvatar from "../common/DefaultAvatar";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

export interface FriendDetailModalProps {
  visible: boolean;
  friend: { id: string; nickname: string; photoURL?: string | null } | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function FriendDetailModal({ visible, friend, onClose, onDelete }: FriendDetailModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!friend) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setConfirmVisible(true)}
            >
              <Text style={styles.deleteButtonText}>{t("friends.removeButton")}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setImagePreviewVisible(true)}>
              {friend.photoURL ? (
                <Image source={{ uri: friend.photoURL }} style={styles.avatar} />
              ) : (
                <DefaultAvatar size={72} />
              )}
            </TouchableOpacity>

            <Text style={styles.nickname}>{friend.nickname}</Text>

            <TouchableOpacity style={styles.messageButton}>
              <Text style={styles.messageButtonText}>{t("friends.sendMessage")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={imagePreviewVisible} transparent animationType="none" onRequestClose={() => setImagePreviewVisible(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setImagePreviewVisible(false)}>
          {friend.photoURL ? (
            <Image source={{ uri: friend.photoURL }} style={styles.avatarLarge} />
          ) : (
            <DefaultAvatar size={240} />
          )}
        </Pressable>
      </Modal>

      <Modal visible={confirmVisible} transparent animationType="none" onRequestClose={() => setConfirmVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmVisible(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmText}>{friend.nickname}{t("friends.removeConfirm")}</Text>
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={() => {
                  setConfirmVisible(false);
                  onDelete(friend.id);
                }}
              >
                <Text style={styles.confirmDeleteButtonText}>{t("common.delete")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: 260,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
    },
    deleteButton: {
      position: "absolute",
      top: 14,
      right: 14,
      backgroundColor: theme.accent,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    deleteButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    avatar: { width: 72, height: 72, borderRadius: 36, marginTop: 16 },
    nickname: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginTop: 12 },
    messageButton: {
      marginTop: 20,
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      width: "100%",
      alignItems: "center",
    },
    messageButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    previewOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLarge: { width: 240, height: 240, borderRadius: 120 },
    confirmCard: {
      width: 260,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 20,
    },
    confirmText: { fontSize: 14, color: theme.textPrimary, textAlign: "center", marginBottom: 16 },
    confirmButtonRow: { flexDirection: "row", gap: 10 },
    confirmButton: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
    cancelButton: { backgroundColor: theme.background },
    cancelButtonText: { color: theme.textSecondary, fontWeight: "600" },
    confirmDeleteButton: { backgroundColor: theme.accent },
    confirmDeleteButtonText: { color: "#fff", fontWeight: "700" },
  });
}
