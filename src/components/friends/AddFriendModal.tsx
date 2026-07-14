import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, StyleSheet, Alert } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { Theme } from "../../theme/themes";
import { findUserByEmail, sendFriendRequest } from "../../services/friendRequestService";
import type { RegisteredUser } from "../../data/mockRegisteredUsers";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type LookupState = "idle" | "checking" | "found" | "notfound";

export default function AddFriendModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [email, setEmail] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [foundUser, setFoundUser] = useState<RegisteredUser | null>(null);
  const pressStartedInsideRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setEmail("");
      setLookupState("idle");
      setFoundUser(null);
    }
  }, [visible]);

  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed) {
      setLookupState("idle");
      setFoundUser(null);
      return;
    }
    setLookupState("checking");
    const timer = setTimeout(async () => {
      const result = await findUserByEmail(trimmed);
      setFoundUser(result);
      setLookupState(result ? "found" : "notfound");
    }, 400);
    return () => clearTimeout(timer);
  }, [email]);

  async function handleAdd() {
    if (lookupState !== "found" || !foundUser || !user) return;
    await sendFriendRequest(user.uid, foundUser.uid);
    Alert.alert("送信しました", `${foundUser.nickname}さんにフレンド申請を送りました。`);
    onClose();
  }

  const addEnabled = lookupState === "found";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        onPressIn={() => { pressStartedInsideRef.current = false; }}
        onPress={() => {
          if (pressStartedInsideRef.current) {
            pressStartedInsideRef.current = false;
            return;
          }
          onClose();
        }}
      >
        <Pressable
          style={styles.box}
          onPressIn={() => { pressStartedInsideRef.current = true; }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>友達追加</Text>

          <TextInput
            style={styles.input}
            placeholder="メールアドレスを入力"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {lookupState === "notfound" && (
            <Text style={styles.errorText}>存在しないユーザーです</Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, addEnabled ? styles.addButtonActive : styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!addEnabled}
            >
              <Text style={styles.addText}>追加</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    box: {
      backgroundColor: theme.card,
      borderRadius: 14,
      paddingVertical: 20,
      paddingHorizontal: 20,
      minWidth: 280,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 14,
      textAlign: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
    },
    errorText: {
      fontSize: 12,
      color: theme.accent,
      marginTop: 6,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    cancelText: { color: theme.textSecondary, fontSize: 14, fontWeight: "700" },
    addButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    addButtonActive: { backgroundColor: theme.primary },
    addButtonDisabled: { backgroundColor: theme.textSecondary },
    addText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
}
