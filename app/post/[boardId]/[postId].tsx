import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  fetchPost,
  fetchComments,
  createComment,
  toggleLike,
  checkLiked,
} from "../../../src/services/boardService";
import { BOARDS, type BoardId, type Post, type Comment } from "../../../src/types/board";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "たった今";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${Math.floor(diff / 86400000)}日前`;
}

export default function PostDetailScreen() {
  const { boardId, postId } = useLocalSearchParams<{ boardId: string; postId: string }>();
  const { user, schoolDomain } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!schoolDomain || !boardId || !postId) return;
    Promise.all([
      fetchPost(schoolDomain, boardId as BoardId, postId),
      fetchComments(schoolDomain, boardId as BoardId, postId),
      user ? checkLiked(schoolDomain, boardId as BoardId, postId, user.uid) : Promise.resolve(false),
    ]).then(([p, c, isLiked]) => {
      setPost(p);
      setComments(c);
      setLiked(isLiked);
      setLikeCount(p?.likeCount ?? 0);
    }).finally(() => setLoading(false));
  }, [schoolDomain, boardId, postId]);

  async function handleLike() {
    if (!user || !schoolDomain) return;
    setLiking(true);
    const result = await toggleLike(schoolDomain, boardId as BoardId, postId, user.uid);
    setLiked(result.liked);
    setLikeCount(result.likeCount);
    setLiking(false);
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    if (!user || !schoolDomain) { Alert.alert("ログインが必要です"); return; }

    setSubmitting(true);
    try {
      await createComment(schoolDomain, boardId as BoardId, postId, user.uid, commentText.trim());
      const updated = await fetchComments(schoolDomain, boardId as BoardId, postId);
      setComments(updated);
      setCommentText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert("コメントに失敗しました", e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2F6AD9" /></View>;
  }

  if (!post) {
    return <View style={styles.center}><Text>投稿が見つかりません</Text></View>;
  }

  const board = BOARDS.find((b) => b.id === boardId);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView ref={scrollRef} style={styles.container}>
        {/* Post */}
        <View style={styles.postCard}>
          <Text style={styles.boardTag}>{board?.label}</Text>
          <Text style={styles.postTitle}>{post.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>匿名</Text>
            <Text style={styles.meta}>·</Text>
            <Text style={styles.meta}>{timeAgo(post.createdAt)}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.postBody}>{post.body}</Text>
          <TouchableOpacity
            style={[styles.likeBtn, liked && styles.likeBtnActive]}
            onPress={handleLike}
            disabled={liking}
          >
            <Text style={[styles.likeBtnText, liked && styles.likeBtnTextActive]}>
              {liked ? "❤️" : "🤍"} {likeCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments */}
        <Text style={styles.commentHeader}>コメント {comments.length}</Text>
        {comments.map((c, i) => (
          <View key={c.id} style={styles.commentCard}>
            <Text style={styles.commentAuthor}>匿名{i + 1}</Text>
            <Text style={styles.commentBody}>{c.body}</Text>
            <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Comment input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="コメントを入力..."
          placeholderTextColor="#aaa"
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.disabled]}
          onPress={handleComment}
          disabled={!commentText.trim() || submitting}
        >
          <Text style={styles.sendText}>送信</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  postCard: { backgroundColor: "#fff", padding: 20, marginBottom: 8 },
  boardTag: { fontSize: 12, color: "#2F6AD9", fontWeight: "600", marginBottom: 6 },
  postTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A2E", marginBottom: 8 },
  metaRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  meta: { fontSize: 12, color: "#999" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginBottom: 16 },
  postBody: { fontSize: 15, color: "#333", lineHeight: 24 },
  likeBtn: {
    alignSelf: "flex-start",
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F9F9F9",
  },
  likeBtnActive: { borderColor: "#E8334A", backgroundColor: "#FFF0F2" },
  likeBtnText: { fontSize: 14, color: "#888", fontWeight: "600" },
  likeBtnTextActive: { color: "#E8334A" },
  commentHeader: { fontSize: 14, fontWeight: "700", color: "#555", padding: 16, paddingBottom: 8 },
  commentCard: { backgroundColor: "#fff", padding: 16, marginBottom: 1 },
  commentAuthor: { fontSize: 13, fontWeight: "600", color: "#2F6AD9", marginBottom: 4 },
  commentBody: { fontSize: 14, color: "#333", lineHeight: 22 },
  commentTime: { fontSize: 11, color: "#bbb", marginTop: 4 },
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
    backgroundColor: "#2F6AD9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
