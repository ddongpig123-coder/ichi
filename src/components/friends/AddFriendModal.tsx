import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";
import { findUserByEmail, sendFriendRequest } from "../../services/friendRequestService";
import { shareInvite } from "../../services/friendInvite";
import type { PublicProfile } from "../../services/userService";
import { notify } from "../../utils/dialog";
import { friendlyErrorBody } from "../../utils/writeError";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type LookupState = "idle" | "invalid" | "checking" | "found" | "notfound" | "error";

// 形式チェックだけ（存在確認はサーバー）。打ちかけの「abc」で「存在しない」と言わないため
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddFriendModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [email, setEmail] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [foundUser, setFoundUser] = useState<PublicProfile | null>(null);
  const [busy, setBusy] = useState(false);
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
    setFoundUser(null);
    if (!EMAIL_RE.test(trimmed)) {
      setLookupState("invalid");
      return;
    }
    setLookupState("checking");
    // 入力が変わったら古い問い合わせの結果は捨てる（遅れて届いた結果で上書きしない）
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const result = await findUserByEmail(trimmed);
        if (stale) return;
        setFoundUser(result);
        setLookupState(result ? "found" : "notfound");
      } catch (e) {
        console.warn("email lookup failed:", e);
        if (stale) return;
        setLookupState("error");
      }
    }, 400);
    return () => { stale = true; clearTimeout(timer); };
  }, [email]);

  async function handleAdd() {
    if (lookupState !== "found" || !foundUser || !user) return;
    setBusy(true);
    try {
      const result = await sendFriendRequest(user.uid, foundUser.uid);
      switch (result) {
        case "sent":
          notify(t("friends.requestSentTitle"), `${foundUser.nickname}${t("friends.requestSentSuffix")}`);
          onClose();
          break;
        case "self":
          notify(t("friends.cannotSendTitle"), t("friends.cannotSendSelf"));
          break;
        case "already-friends":
          notify(t("friends.alreadyFriendsTitle"), `${foundUser.nickname}${t("friends.alreadyFriendsSuffix")}`);
          break;
        case "already-sent":
          notify(t("friends.alreadySentTitle"), t("friends.alreadySentMessage"));
          break;
        case "incoming-exists":
          notify(t("friends.incomingExistsTitle"), `${foundUser.nickname}${t("friends.incomingExistsSuffix")}`);
          break;
      }
    } catch (e: any) {
      notify(t("friends.sendFailed"), friendlyErrorBody(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleShareInvite() {
    if (!user) return;
    const result = await shareInvite(user.uid, t("friends.inviteMessage"));
    if (result === "copied") notify(t("friends.inviteCopied"));
    else if (result === "failed") notify(t("friends.inviteFailed"));
    // "shared" は OS の共有シートが処理済みなので通知不要
  }

  const addEnabled = lookupState === "found" && !busy;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
          <Text style={styles.title}>{t("friends.addTitle")}</Text>

          <TextInput
            style={styles.input}
            placeholder={t("friends.emailPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            keyboardType="email-address"
          />
          {/* 入力の下に今の状態を1行で返す（打ちかけの間は何も言わない） */}
          {lookupState === "invalid" && email.includes("@") && (
            <Text style={styles.hintText}>{t("friends.emailInvalid")}</Text>
          )}
          {lookupState === "checking" && (
            <Text style={styles.hintText}>{t("friends.lookupChecking")}</Text>
          )}
          {lookupState === "found" && foundUser && (
            <Text style={styles.foundText}>
              {foundUser.nickname}{t("friends.lookupFoundSuffix")}
            </Text>
          )}
          {lookupState === "notfound" && (
            <Text style={styles.errorText}>{t("friends.userNotFound")}</Text>
          )}
          {lookupState === "error" && (
            <Text style={styles.errorText}>{t("friends.lookupFailed")}</Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, addEnabled ? styles.addButtonActive : styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!addEnabled}
            >
              <Text style={styles.addText}>{t("common.add")}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          <TouchableOpacity style={styles.inviteButton} onPress={handleShareInvite}>
            <Text style={styles.inviteText}>
              <Ionicons name="link-outline" size={15} color={theme.primary} /> {t("friends.inviteShare")}
            </Text>
          </TouchableOpacity>
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
    hintText: { fontSize: 12, color: theme.textSecondary, marginTop: 6 },
    foundText: { fontSize: 12, color: theme.primary, fontWeight: "700", marginTop: 6 },
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
    divider: { height: 1, backgroundColor: theme.border, marginTop: 18, marginBottom: 12 },
    inviteButton: {
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingVertical: 11,
      alignItems: "center",
    },
    inviteText: { color: theme.primary, fontSize: 14, fontWeight: "700" },
  });
}
