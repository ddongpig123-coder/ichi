import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import TimeTable from "../timetable/TimeTable";
import { useFriendTimetable } from "../../hooks/useFriendTimetable";

export interface FriendDetailModalProps {
  visible: boolean;
  friend: { id: string; nickname: string; photoURL?: string | null } | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const MODAL_HORIZONTAL_MARGIN = 16;
const COMPACT_CELL_HEIGHT = 40;

export default function FriendDetailModal({ visible, friend, onClose, onDelete }: FriendDetailModalProps) {
  const { width: screenWidth } = useWindowDimensions();
  const modalWidth = screenWidth - MODAL_HORIZONTAL_MARGIN * 2;
  const timetableWidth = modalWidth - 24; // card padding 12px × 2

  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const { sessions } = useFriendTimetable(friend?.id ?? null);

  if (!friend) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.card, { width: modalWidth }]} onPress={() => {}}>
            {/* 友達削除 — 右上固定 */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setConfirmVisible(true)}
            >
              <Text style={styles.deleteButtonText}>友達削除</Text>
            </TouchableOpacity>

            {/* 프로필 행: 아바타 + 닉네임 */}
            <View style={styles.profileRow}>
              <TouchableOpacity onPress={() => setImagePreviewVisible(true)}>
                {friend.photoURL ? (
                  <Image source={{ uri: friend.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
              </TouchableOpacity>
              <Text style={styles.nickname}>{friend.nickname}</Text>
            </View>

            {/* 시간표 */}
            <View style={styles.timetableWrapper}>
              <TimeTable
                sessions={sessions}
                containerWidth={timetableWidth}
                cellHeight={COMPACT_CELL_HEIGHT}
              />
            </View>

            {/* 버튼 */}
            <TouchableOpacity style={[styles.actionButton, styles.messageButton]}>
              <Text style={styles.actionButtonText}>メッセージを送る</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 프로필 이미지 확대 */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <Pressable style={styles.previewOverlay} onPress={() => setImagePreviewVisible(false)}>
          {friend.photoURL ? (
            <Image source={{ uri: friend.photoURL }} style={styles.avatarLarge} />
          ) : (
            <View style={styles.avatarLargePlaceholder} />
          )}
        </Pressable>
      </Modal>

      {/* 삭제 확인 */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    paddingTop: 44,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0E4EA",
  },
  nickname: { fontSize: 15, fontWeight: "700", color: "#1A1A2E" },
  timetableWrapper: {
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  deleteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#E2574C",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  messageButton: { backgroundColor: "#2F6AD9" },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
