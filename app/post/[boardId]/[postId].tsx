import React, { useEffect, useMemo, useState, useRef } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  fetchPost,
  fetchComments,
  createComment,
  toggleLike,
  checkLiked,
} from "../../../src/services/boardService";
import { getOrCreateChat } from "../../../src/services/chatService";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import ModerationMenu from "../../../src/components/common/ModerationMenu";
import type { ReportTargetType } from "../../../src/types/moderation";
import type { Theme } from "../../../src/theme/themes";
import { BOARDS, type BoardId, type Post, type Comment } from "../../../src/types/board";

export default function PostDetailScreen() {
  const { boardId, postId } = useLocalSearchParams<{ boardId: string; postId: string }>();
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { isBlocked } = useBlock();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  // 通報・ブロックメニューの対象
  const [modTarget, setModTarget] = useState<
    | { targetType: ReportTargetType; targetPath: string; targetAuthorUid: string }
    | null
  >(null);

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

  async function handleSendMessage(targetUid: string) {
    if (!user || !schoolDomain || !post) return;
    if (user.uid === targetUid) return;
    const chatRoomId = await getOrCreateChat(schoolDomain, user.uid, targetUid, post.title);
    router.push(`/(tabs)/messages/${chatRoomId}`);
  }

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
    if (!user || !schoolDomain) { Alert.alert(t("post.loginRequired")); return; }

    setSubmitting(true);
    try {
      await createComment(schoolDomain, boardId as BoardId, postId, user.uid, commentText.trim());
      const updated = await fetchComments(schoolDomain, boardId as BoardId, postId);
      setComments(updated);
      setCommentText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert(t("post.commentFailed"), e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  if (!post) {
    return <View style={styles.center}><Text style={{ color: theme.textSecondary }}>{t("post.notFound")}</Text></View>;
  }

  const board = BOARDS.find((b) => b.id === boardId);

  // 같은 사람이 여러 번 댓글을 달아도 같은 번호(匿名1, 匿名2...)가 유지되도록
  // authorUid의 첫 등장 순서로 번호를 부여
  const anonNumbers = new Map<string, number>();
  for (const c of comments) {
    if (!anonNumbers.has(c.authorUid)) anonNumbers.set(c.authorUid, anonNumbers.size + 1);
  }

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
            <TouchableOpacity
              disabled={!user || user.uid === post.authorUid}
              onPress={() => handleSendMessage(post.authorUid)}
            >
              <Text style={styles.meta}>{t("boards.anonymous")}</Text>
            </TouchableOpacity>
            <Text style={styles.meta}>·</Text>
            <Text style={styles.meta}>{timeAgo(language, post.createdAt)}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() =>
                setModTarget({
                  targetType: "post",
                  targetPath: `schools/${schoolDomain}/boards/${boardId}/posts/${postId}`,
                  targetAuthorUid: post.authorUid,
                })
              }
            >
              <Text style={styles.moreBtn}>⋯</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <Text style={styles.postBody}>{post.body}</Text>
          <View style={styles.actionRow}>
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
        </View>

        {/* Comments */}
        <Text style={styles.commentHeader}>{t("post.commentsHeader")} {comments.length}</Text>
        {comments.map((c) =>
          isBlocked(c.authorUid) ? (
            <View key={c.id} style={styles.commentCard}>
              <Text style={styles.blockedText}>{t("post.blockedComment")}</Text>
            </View>
          ) : (
            <View key={c.id} style={styles.commentCard}>
              <View style={styles.commentAuthorRow}>
                <TouchableOpacity
                  disabled={!user || user.uid === c.authorUid}
                  onPress={() => handleSendMessage(c.authorUid)}
                >
                  <Text style={styles.commentAuthor}>{t("boards.anonymous")}{anonNumbers.get(c.authorUid)}</Text>
                </TouchableOpacity>
                {c.authorUid === post.authorUid && (
                  <View style={styles.authorTag}>
                    <Text style={styles.authorTagText}>{t("post.authorTag")}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() =>
                    setModTarget({
                      targetType: "comment",
                      targetPath: `schools/${schoolDomain}/boards/${boardId}/posts/${postId}/comments/${c.id}`,
                      targetAuthorUid: c.authorUid,
                    })
                  }
                >
                  <Text style={styles.moreBtn}>⋯</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.commentBody}>{c.body}</Text>
              <Text style={styles.commentTime}>{timeAgo(language, c.createdAt)}</Text>
            </View>
          )
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Comment input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t("post.commentPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.disabled]}
          onPress={handleComment}
          disabled={!commentText.trim() || submitting}
        >
          <Text style={styles.sendText}>{t("common.send")}</Text>
        </TouchableOpacity>
      </View>

      {modTarget && (
        <ModerationMenu
          visible
          onClose={() => setModTarget(null)}
          targetType={modTarget.targetType}
          targetPath={modTarget.targetPath}
          targetAuthorUid={modTarget.targetAuthorUid}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    postCard: { backgroundColor: theme.card, padding: 20, marginBottom: 8 },
    boardTag: { fontSize: 12, color: theme.primary, fontWeight: "600", marginBottom: 6 },
    postTitle: { fontSize: 20, fontWeight: "700", color: theme.textPrimary, marginBottom: 8 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
    meta: { fontSize: 12, color: theme.textSecondary },
    moreBtn: { fontSize: 20, color: theme.textSecondary, fontWeight: "700", paddingHorizontal: 4 },
    blockedText: { fontSize: 13, color: theme.textSecondary, fontStyle: "italic" },
    divider: { height: 1, backgroundColor: theme.border, marginBottom: 16 },
    postBody: { fontSize: 15, color: theme.textPrimary, lineHeight: 24 },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    likeBtn: {
      alignSelf: "flex-start",
      marginTop: 20,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    likeBtnActive: { borderColor: theme.accent, backgroundColor: theme.accent + "1A" },
    likeBtnText: { fontSize: 14, color: theme.textSecondary, fontWeight: "600" },
    likeBtnTextActive: { color: theme.accent },
    commentHeader: { fontSize: 14, fontWeight: "700", color: theme.textSecondary, padding: 16, paddingBottom: 8 },
    commentCard: { backgroundColor: theme.card, padding: 16, marginBottom: 1 },
    commentAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    commentAuthor: { fontSize: 13, fontWeight: "600", color: theme.primary },
    authorTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    authorTagText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    commentBody: { fontSize: 14, color: theme.textPrimary, lineHeight: 22 },
    commentTime: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
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
      backgroundColor: theme.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    disabled: { opacity: 0.4 },
    sendText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}
