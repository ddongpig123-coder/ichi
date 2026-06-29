import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, Pressable, Image, StyleSheet } from "react-native";

export interface FriendDetailModalProps {
  visible: boolean;
  friend: { id: string; nickname: string; photoURL?: string | null } | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function FriendDetailModal({ visible, friend, onClose, onDelete }: FriendDetailModalProps) {
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!friend) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setConfirmVisible(true)}
            >
              <Text style={styles.deleteButtonText}>友達削除</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setImagePreviewVisible(true)}>
              {friend.photoURL ? (
                <Image source={{ uri: friend.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </TouchableOpacity>

            <Text style={styles.nickname}>{friend.nickname}</Text>

            <TouchableOpacity style={styles.messageButton}>
              <Text style={styles.messageButtonText}>メッセージを送る</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={imagePreviewVisible} transparent animationType="fade" onRequestClose={() => setImagePreviewVisible(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setImagePreviewVisible(false)}>
          {friend.photoURL ? (
            <Image source={{ uri: friend.photoURL }} style={styles.avatarLarge} />
          ) : (
            <View style={styles.avatarLargePlaceholder} />
          )}
        </Pressable>
      </Modal>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmVisible(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmText}>{friend.nickname}さんを友達から削除しますか？</Text>
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={() => {
                  setConfirmVisible(false);
                  onDelete(friend.id);
                }}
              >
                <Text style={styles.confirmDeleteButtonText}>削除</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: 260,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  deleteButton: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "#E2574C",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  avatar: { width: 72, height: 72, borderRadius: 36, marginTop: 16 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E0E4EA",
    marginTop: 16,
  },
  nickname: { fontSize: 16, fontWeight: "700", color: "#1A1A2E", marginTop: 12 },
  messageButton: {
    marginTop: 20,
    backgroundColor: "#2F6AD9",
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
  avatarLargePlaceholder: { width: 240, height: 240, borderRadius: 120, backgroundColor: "#3A3A3A" },
  confirmCard: {
    width: 260,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  confirmText: { fontSize: 14, color: "#1A1A2E", textAlign: "center", marginBottom: 16 },
  confirmButtonRow: { flexDirection: "row", gap: 10 },
  confirmButton: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelButton: { backgroundColor: "#F0F0F0" },
  cancelButtonText: { color: "#666", fontWeight: "600" },
  confirmDeleteButton: { backgroundColor: "#E2574C" },
  confirmDeleteButtonText: { color: "#fff", fontWeight: "700" },
});
