import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  toggleLoungeCommentLike,
  fetchLikedLoungeCommentIds,
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
  const insets = useSafeAreaInsets();

  // ⚠️ 【暫定・12月にネイティブ化する時は丸ごと削除すること】
  //   これは JS だけでキーボードを避ける暫定実装。「OSはキーボード表示時に画面を
  //   リサイズ/パンしない」という前提に依存しており、この前提が成り立たない端末では
  //   二重に持ち上がる/持ち上がらない等で破綻する（＝全端末保証は不可）。
  //   全端末保証は react-native-keyboard-controller（ネイティブ, EAS dev build 必須）で行う。
  //   → ネイティブ化の際は削除するもの:
  //      ① この kbInset state と下の useEffect（Keyboard リスナー）
  //      ② ルート <View style={{ flex:1, paddingBottom: kbInset }}>（KeyboardProvider 配下の
  //         KeyboardStickyView 等に置換）
  //      ③ 入力バーの paddingBottom の kbInset 分岐（insets.bottom 固定に戻す）
  //      ④ 未使用になる Keyboard / Dimensions の import
  //   （自由掲示板 app/post/[boardId]/[postId].tsx にも同じ暫定実装あり — 一緒に消すこと）
  //
  // キーボードがせり上がった分（画面下端からの遮蔽量 = window高 - screenY）だけ手動で持ち上げる。
  // screenY が無い端末向けに height + insets.bottom のフォールバックも持つ。
  const [kbInset, setKbInset] = useState(0);
  useEffect(() => {
    const onShow = (e: any) => {
      const ec = e?.endCoordinates ?? {};
      const winH = Dimensions.get("window").height;
      let lift = 0;
      if (ec.screenY != null && ec.screenY > 0 && ec.screenY < winH) lift = winH - ec.screenY;
      else if (ec.height) lift = ec.height + insets.bottom; // screenY が無い端末向けフォールバック
      setKbInset(lift);
    };
    const s = Keyboard.addListener("keyboardDidShow", onShow);
    const f = Keyboard.addListener("keyboardDidChangeFrame", onShow);
    const h = Keyboard.addListener("keyboardDidHide", () => setKbInset(0));
    return () => { s.remove(); f.remove(); h.remove(); };
  }, [insets.bottom]);

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
  // コメント/返信のいいね状態
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [likingComment, setLikingComment] = useState<string | null>(null);
  // 返信のスレッド文脈（rootId=スレッド root コメント id）と、取り外し可能なメンション（返信先の人）を分離。
  // メンションだけ消しても reply(スレッド文脈)は残る = メンションなしの返信として投稿（一般コメントにしない）。
  const [reply, setReply] = useState<{ rootId: string } | null>(null);
  const [mention, setMention] = useState<{ uid: string; label: string } | null>(null);
  const inputRef = useRef<TextInput>(null);
  // 返信ボタン押下のたびに +1。onPress 内で同期 focus するとレンダー確定前（メンションチップが
  // まだレイアウトに入っていない）で Android がキーボードを開かないことがあるため、
  // レンダー確定後の effect でフォーカスする（= 閉じたキーボードでも確実に開く）。
  const [replyFocusNonce, setReplyFocusNonce] = useState(0);
  useEffect(() => {
    if (replyFocusNonce === 0) return;
    inputRef.current?.focus();
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, [replyFocusNonce]);

  // コメント一覧を取得し、自分がいいね済みの id 集合も合わせてロードする。
  const loadComments = useCallback(async () => {
    const c = await fetchLoungeComments(loungeId as LoungeId, postId);
    setComments(c);
    if (user && c.length) {
      fetchLikedLoungeCommentIds(loungeId as LoungeId, postId, c.map((x) => x.id), user.uid)
        .then(setLikedComments)
        .catch(() => {});
    }
    return c;
  }, [loungeId, postId, user]);

  useEffect(() => {
    if (!loungeId || !postId) return;
    Promise.all([
      fetchLoungePost(loungeId as LoungeId, postId),
      loadComments(),
      user ? checkLoungeLiked(loungeId as LoungeId, postId, user.uid) : Promise.resolve(false),
    ]).then(([p, _c, isLiked]) => {
      setPost(p);
      setLiked(isLiked as boolean);
      setLikeCount(p?.likeCount ?? 0);
    }).finally(() => setLoading(false));
  }, [loungeId, postId]);

  async function handleCommentLike(commentId: string) {
    if (!user || likingComment) return;
    setLikingComment(commentId);
    try {
      const res = await toggleLoungeCommentLike(loungeId as LoungeId, postId, commentId, user.uid);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, likeCount: res.likeCount } : c)));
      setLikedComments((prev) => {
        const n = new Set(prev);
        if (res.liked) n.add(commentId); else n.delete(commentId);
        return n;
      });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? "");
    } finally {
      setLikingComment(null);
    }
  }

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
      await loadComments();
    } else {
      await softDeleteLoungePost(loungeId as LoungeId, postId);
      // 直リンクで開いた場合は戻り先がないので一覧へ差し替え
      if (router.canGoBack()) router.back();
      else router.replace(`/lounge/${loungeId}`);
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
      await createLoungeComment(
        loungeId as LoungeId, postId, user.uid, commentText.trim(),
        reply?.rootId ?? null, mention?.uid ?? null
      );
      await loadComments();
      setCommentText("");
      setReply(null);
      setMention(null);
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

  // 1階層フラットのスレッド化: トップレベル + スレッドごとの返信配列（parentId=root id）。
  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, LoungeComment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }
  const visibleCommentCount = comments.filter((c) => !c.deleted).length;

  // 返信開始: スレッド root にぶら下げ、返信先の人をメンション。
  // フォーカスはタップのジェスチャ内で同期呼び出し（= 入力欄を直接タップしたのと同じ。setTimeout で
  // 遅延させるとジェスチャ文脈を外れて Android がキーボードを出さないため）。
  const startReply = (c: LoungeComment) => {
    setReply({ rootId: c.parentId ?? c.id });
    setMention({ uid: c.authorUid, label: `${t("boards.anonymous")}${anonNumbers.get(c.authorUid)}` });
    setReplyFocusNonce((n) => n + 1); // レンダー確定後に effect でフォーカス（確実にキーボードを開く）
  };

  // コメント/返信カード。isReply=返信スタイル（インデント＋左アクセント）。メンションは @匿名N。
  const renderCommentCard = (c: LoungeComment, isReply: boolean) => {
    if (c.deleted) {
      return (
        <View key={c.id} style={[styles.commentCard, isReply && styles.replyCard]}>
          <Text style={styles.blockedText}>{t("moderation.deletedComment")}</Text>
        </View>
      );
    }
    if (isBlocked(c.authorUid)) {
      return (
        <View key={c.id} style={[styles.commentCard, isReply && styles.replyCard]}>
          <Text style={styles.blockedText}>{t("post.blockedComment")}</Text>
        </View>
      );
    }
    const likedByMe = likedComments.has(c.id);
    return (
      <View key={c.id} style={[styles.commentCard, isReply && styles.replyCard]}>
        <View style={styles.commentAuthorRow}>
          {isReply && <Text style={styles.replyArrow}>↳</Text>}
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
        <Text style={styles.commentBody}>
          {c.mentionUid ? (
            <Text style={styles.mention}>@{t("boards.anonymous")}{anonNumbers.get(c.mentionUid)} </Text>
          ) : null}
          {c.body}
        </Text>
        <View style={styles.commentFooter}>
          <Text style={styles.commentTime}>{timeAgo(language, c.createdAt)}</Text>
          <TouchableOpacity
            style={styles.cmtAction}
            disabled={!user || likingComment === c.id}
            onPress={() => handleCommentLike(c.id)}
          >
            <Text style={[styles.cmtActionText, likedByMe && styles.cmtLikeOn]}>
              {likedByMe ? "❤️" : "🤍"} {c.likeCount}
            </Text>
          </TouchableOpacity>
          {/* 返信はコメント・返信の両方に表示（req 2）。返信への返信も同じスレッドにフラット追加（req 5）。 */}
          <TouchableOpacity style={styles.cmtAction} onPress={() => startReply(c)}>
            <Text style={styles.cmtActionText}>{t("post.reply")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, paddingBottom: kbInset }}>
      <ScrollView ref={scrollRef} style={styles.container} keyboardShouldPersistTaps="handled">
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

        <Text style={styles.commentHeader}>{t("post.commentsHeader")} {visibleCommentCount}</Text>
        {topLevelComments.map((c) => {
          const replies = repliesByParent.get(c.id) ?? [];
          const aliveReplies = replies.filter((r) => !r.deleted);
          // コメント削除済み かつ 生存返信なし → スレッド丸ごと非表示（req 7,10）。
          // コメント削除済みでも生存返信があれば墓標を残す（req 8）。返信の墓標は維持（req 9）。
          if (c.deleted && aliveReplies.length === 0) return null;
          return (
            <React.Fragment key={c.id}>
              {renderCommentCard(c, false)}
              {replies.map((r) => renderCommentCard(r, true))}
            </React.Fragment>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* paddingBottom は常に safe-area bottom で固定（休止時はナビバーに重ならず、
          キーボード表示中(kbInset>0)は画面全体を持ち上げるので小さめ、
          休止時はナビバー分だけ確保して重なりを防ぐ。 */}
      <View style={[styles.inputBar, { paddingBottom: kbInset > 0 ? 10 : Math.max(insets.bottom, 10) }]}>
        {/* 返信を押したら必ず返信モード（대댓글）。メンションあり=「@匿名N ✕」、
            メンションを外しても返信は継続し「↩ 返信」インジケータを表示（取り消し✕なし＝送信でのみ解除）。 */}
        {mention ? (
          <View style={styles.mentionChip}>
            <Text style={styles.mentionChipText}>@{mention.label}</Text>
            <TouchableOpacity onPress={() => setMention(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.mentionChipX}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : reply ? (
          <View style={styles.replyChip}>
            <Text style={styles.replyChipText}>↩ {t("post.reply")}</Text>
          </View>
        ) : null}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={reply ? t("post.replyPlaceholder") : t("post.commentPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          onKeyPress={({ nativeEvent }) => {
            // バックスペースはメンションのみ外す。返信モードは解除しない（送信で終了）。
            if (nativeEvent.key === "Backspace" && commentText.length === 0 && mention) setMention(null);
          }}
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
    </View>
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
    // 返信（대댓글）: インデント＋左アクセント＋薄い背景で通常コメントと区別
    replyCard: {
      marginLeft: 24,
      backgroundColor: theme.background,
      borderLeftWidth: 2,
      borderLeftColor: theme.primary,
      paddingLeft: 14,
    },
    replyArrow: { fontSize: 12, color: theme.textSecondary, marginRight: 2 },
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
    // メンション表示（@匿名N）: 通常本文と区別（プライマリ色・太字）
    mention: { color: theme.primary, fontWeight: "700" },
    commentFooter: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
    commentTime: { fontSize: 11, color: theme.textSecondary },
    cmtAction: { flexDirection: "row", alignItems: "center" },
    cmtActionText: { fontSize: 12, color: theme.textSecondary, fontWeight: "600" },
    cmtLikeOn: { color: theme.accent },
    // 入力欄内のメンショントークン（@匿名N ✕）
    mentionChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-end",
      gap: 4,
      backgroundColor: theme.primary + "1A",
      borderRadius: 16,
      paddingLeft: 12,
      paddingRight: 8,
      height: 40,
    },
    mentionChipText: { fontSize: 13, color: theme.primary, fontWeight: "700" },
    mentionChipX: { fontSize: 12, color: theme.primary, fontWeight: "700" },
    // メンションを外しても返信中を示すインジケータ（↩ 返信・取り消し✕なし）
    replyChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-end",
      backgroundColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      height: 40,
    },
    replyChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: "700" },
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
