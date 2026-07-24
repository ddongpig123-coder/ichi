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
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useBlock } from "../../../src/contexts/BlockContext";
import {
  fetchLoungePost,
  fetchLoungeComments,
  createLoungeComment,
  toggleLoungeLike,
  checkLoungeLiked,
  softDeleteLoungePost,
  softDeleteLoungeComment,
} from "../../../src/services/loungeService";
import { findBannedWords } from "../../../src/utils/contentFilter";
import BannedWordWarning from "../../../src/components/common/BannedWordWarning";
import { getOrCreateChat } from "../../../src/services/chatService";
import ModerationMenu from "../../../src/components/common/ModerationMenu";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import type { ReportTargetType } from "../../../src/types/moderation";
import type { Theme } from "../../../src/theme/themes";
import { LOUNGES, type LoungeId, type LoungePost, type LoungeComment } from "../../../src/types/lounge";

export default function LoungePostDetailScreen() {
  const { loungeId, postId } = useLocalSearchParams<{ loungeId: string; postId: string }>();
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { isBlocked } = useBlock();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const [post, setPost] = useState<LoungePost | null>(null);
  const [comments, setComments] = useState<LoungeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);
  // commentId を持つときはコメント対象（削除の分岐に使う）
  const [modTarget, setModTarget] = useState<
    | {
        targetType: ReportTargetType;
        targetPath: string;
        targetAuthorUid: string;
        commentId?: string;
      }
    | null
  >(null);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!loungeId || !postId) return;
    Promise.all([
      fetchLoungePost(loungeId as LoungeId, postId),
      fetchLoungeComments(loungeId as LoungeId, postId),
      user ? checkLoungeLiked(loungeId as LoungeId, postId, user.uid) : Promise.resolve(false),
    ]).then(([p, c, isLiked]) => {
      setPost(p);
      setComments(c);
      setLiked(isLiked);
      setLikeCount(p?.likeCount ?? 0);
    }).finally(() => setLoading(false));
  }, [loungeId, postId]);

  async function handleSendMessage(targetUid: string) {
    if (!user || !schoolDomain || !post) return;
    if (user.uid === targetUid) return;
    const chatRoomId = await getOrCreateChat(schoolDomain, user.uid, targetUid, post.title);
    router.push(`/(tabs)/messages/${chatRoomId}`);
  }

  async function handleLike() {
    if (!user) return;
    setLiking(true);
    const result = await toggleLoungeLike(loungeId as LoungeId, postId, user.uid);
    setLiked(result.liked);
    setLikeCount(result.likeCount);
    setLiking(false);
  }

  // 自分の投稿・コメントの削除（ソフトデリート）。学校掲示板と同じ扱い。
  async function handleDelete() {
    if (!modTarget) return;
    if (modTarget.commentId) {
      await softDeleteLoungeComment(loungeId as LoungeId, postId, modTarget.commentId);
      setComments(await fetchLoungeComments(loungeId as LoungeId, postId));
    } else {
      await softDeleteLoungePost(loungeId as LoungeId, postId);
      router.back();
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    if (!user) { Alert.alert(t("post.loginRequired")); return; }

    const hits = findBannedWords(commentText);
    if (hits.length) { setBannedWords(hits); return; }
    await submitComment();
  }

  async function submitComment() {
    if (!user) return;
    setBannedWords([]);
    setSubmitting(true);
    try {
      await createLoungeComment(loungeId as LoungeId, postId, user.uid, commentText.trim());
      const updated = await fetchLoungeComments(loungeId as LoungeId, postId);
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

  // 削除済みは本文を出さず墓標だけ（ドキュメントは6ヶ月保存）
  if (post.deleted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.textSecondary }}>{t("moderation.deletedPost")}</Text>
      </View>
    );
  }

  const lounge = LOUNGES.find((l) => l.id === loungeId);

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
        <View style={styles.postCard}>
          <Text style={styles.boardTag}>{lounge?.icon} {lounge?.label}</Text>
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
                  targetPath: `lounges/${loungeId}/posts/${postId}`,
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

        <Text style={styles.commentHeader}>{t("post.commentsHeader")} {comments.length}</Text>
        {comments.map((c) =>
          c.deleted ? (
            <View key={c.id} style={styles.commentCard}>
              <Text style={styles.blockedText}>{t("moderation.deletedComment")}</Text>
            </View>
          ) : isBlocked(c.authorUid) ? (
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
                      targetPath: `lounges/${loungeId}/posts/${postId}/comments/${c.id}`,
                      targetAuthorUid: c.authorUid,
                      commentId: c.id,
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
          onDelete={handleDelete}
        />
      )}

      <BannedWordWarning
        visible={bannedWords.length > 0}
        words={bannedWords}
        onEdit={() => setBannedWords([])}
        onProceed={submitComment}
      />
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
