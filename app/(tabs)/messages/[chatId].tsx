import React, { useEffect, useRef, useState } from "react";
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
import { sendMessage, subscribeToMessages } from "../../../src/services/chatService";
import type { ChatMessage } from "../../../src/types/chat";

function timeStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ChatRoomScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user, schoolDomain } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!schoolDomain || !chatId) return;
    const unsub = subscribeToMessages(schoolDomain, chatId, (msgs) => {
      setMessages(msgs);
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
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>匿</Text>
          </View>
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
            <Text style={styles.emptyText}>メッセージを送ってみましょう</Text>
          </View>
        }
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="メッセージを入力..."
          placeholderTextColor="#aaa"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#F5F7FA" },
  listContent: { padding: 16, gap: 12 },
  empty: { flex: 1, alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#bbb", fontSize: 14 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowMine: { flexDirection: "row-reverse" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF3FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 13, color: "#2F6AD9", fontWeight: "700" },
  bubble: {
    maxWidth: "72%",
    backgroundColor: "#fff",
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
    backgroundColor: "#2F6AD9",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 15, color: "#1A1A2E", lineHeight: 22 },
  bubbleTextMine: { color: "#fff" },
  timeText: { fontSize: 10, color: "#bbb", marginTop: 4, textAlign: "right" },
  timeTextMine: { color: "rgba(255,255,255,0.6)" },
  inputBar: {
    flexDirection: "row",
    padding: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E8E8E8",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2F6AD9",
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  sendIcon: { color: "#fff", fontSize: 16 },
});
