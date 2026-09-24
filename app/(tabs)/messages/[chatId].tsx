import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import { useNotifications } from "../../../src/contexts/NotificationsContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import ModerationMenu from "../../../src/components/common/ModerationMenu";
import { sendMessage, subscribeToMessages } from "../../../src/services/chatService";
import type { Theme } from "../../../src/theme/themes";
import type { ChatMessage } from "../../../src/types/chat";

function timeStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ChatRoomScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { isBlocked } = useBlock();
  const { markChatAsRead } = useNotifications();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [modTarget, setModTarget] = useState<{ path: string; authorUid: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!schoolDomain || !chatId) return;
    const unsub = subscribeToMessages(schoolDomain, chatId, (msgs) => {
      setMessages(msgs);
      markChatAsRead(chatId); // 開いている間に届いた分も既読にする
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return unsub;
  }, [schoolDomain, chatId]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !user || !schoolDomain) return;
    setSending(true);
    setText("");
    await sendMessage(schoolDomain, chatId, user.uid, trimmed);
    setSending(false);
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMine = item.senderUid === user?.uid;

    // ブロックした相手のメッセージは折りたたむ
    if (!isMine && isBlocked(item.senderUid)) {
      return (
        <View style={styles.msgRow}>
          <View style={[styles.bubble, styles.bubbleBlocked]}>
            <Text style={styles.blockedText}>{t("messages.blockedMessage")}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          // アバターをタップで通報・ブロックメニュー
          <TouchableOpacity
            style={styles.avatar}
            onPress={() =>
              setModTarget({
                path: `schools/${schoolDomain}/chats/${chatId}/messages/${item.id}`,
                authorUid: item.senderUid,
              })
            }
          >
            <Text style={styles.avatarText}>{t("messages.anonChar")}</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.bubble, isMine && styles.bubbleMine]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
          <Text style={[styles.timeText, isMine && styles.timeTextMine]}>{timeStr(item.createdAt)}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderMessage}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("messages.emptyRoom")}</Text>
          </View>
        }
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t("messages.inputPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>

      {modTarget && (
        <ModerationMenu
          visible
          onClose={() => setModTarget(null)}
          targetType="message"
          targetPath={modTarget.path}
          targetAuthorUid={modTarget.authorUid}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: theme.background },
    listContent: { padding: 16, gap: 12 },
    empty: { flex: 1, alignItems: "center", paddingTop: 60 },
    emptyText: { color: theme.textSecondary, fontSize: 14 },
    msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    msgRowMine: { flexDirection: "row-reverse" },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + "1A",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 13, color: theme.primary, fontWeight: "700" },
    bubble: {
      maxWidth: "72%",
      backgroundColor: theme.card,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    bubbleMine: {
      backgroundColor: theme.primary,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
    },
    bubbleBlocked: { backgroundColor: theme.background },
    blockedText: { fontSize: 13, color: theme.textSecondary, fontStyle: "italic" },
    bubbleText: { fontSize: 15, color: theme.textPrimary, lineHeight: 22 },
    bubbleTextMine: { color: "#fff" },
    timeText: { fontSize: 10, color: theme.textSecondary, marginTop: 4, textAlign: "right" },
    timeTextMine: { color: "rgba(255,255,255,0.6)" },
    inputBar: {
      flexDirection: "row",
      padding: 10,
      paddingBottom: Platform.OS === "ios" ? 24 : 10,
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderColor: theme.border,
      alignItems: "flex-end",
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      maxHeight: 100,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    disabled: { opacity: 0.4 },
    sendIcon: { color: "#fff", fontSize: 16 },
  });
}
