import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { isChatUnread, markChatRead, subscribeToMyChats } from "../services/chatService";
import { fetchMyPosts, myPostKey, type MyPostItem } from "../services/myPostsService";

// ============================================================
// タブバーの赤バッジ（新着）をアプリ全体で管理する。
//
// ① メッセージ: chats を購読し「相手が最後に送った & 自分の lastRead より新しい」数。
//    既読はチャット文書の lastRead.{uid}（サーバ保存＝端末をまたぐ）。
// ② 掲示板: 自分の投稿の commentCount が「前に見た数」より増えていれば新着。
//    ⚠️ 既読数の保存は端末ローカル（AsyncStorage）。サーバ保存には
//    users/{uid} 配下の新コレクション＋ルール追加が要るため今は入れていない。
//    初回起動時は既存の投稿を全部「既読」として初期化する（過去分で赤くしないため）。
// ============================================================

const SEEN_KEY = "ichi:seenCommentCounts";

interface NotificationsValue {
  unreadChatCount: number;
  markChatAsRead: (chatId: string) => void;
  myPosts: MyPostItem[];
  newCommentKeys: Set<string>;   // コメントが増えた投稿のキー
  newCommentCount: number;
  // minIntervalMs を渡すと、その間隔内の再取得はスキップ（タブ切替などの頻繁な呼び出し用）
  refreshMyPosts: (opts?: { minIntervalMs?: number }) => Promise<void>;
  markPostSeen: (kind: "board" | "lounge", boardId: string, postId: string, commentCount: number) => void;
}

const NotificationsContext = createContext<NotificationsValue>({
  unreadChatCount: 0,
  markChatAsRead: () => {},
  myPosts: [],
  newCommentKeys: new Set(),
  newCommentCount: 0,
  refreshMyPosts: async () => {},
  markPostSeen: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, schoolDomain, schoolReady } = useAuth();

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [myPosts, setMyPosts] = useState<MyPostItem[]>([]);
  const [seen, setSeen] = useState<Record<string, number>>({});
  // ref ではなく state。ref だとロード完了が再レンダーを起こさず、
  // 下の newCommentKeys(useMemo) と refreshMyPosts の初回シードが取り残される。
  const [seenLoaded, setSeenLoaded] = useState(false);

  // ── 既読コメント数のロード ──
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => {
        if (raw) setSeen(JSON.parse(raw));
        setSeenLoaded(true);
      })
      .catch(() => {
        setSeenLoaded(true);
      });
  }, []);

  // ── ① メッセージ未読（リアルタイム購読） ──
  // チャットは全国スコープなので schoolDomain に依存しない（1.1）。
  // 学校未選択（その他）のユーザーもバッジが正しく出る。
  useEffect(() => {
    if (!user) {
      setUnreadChatCount(0);
      return;
    }
    const unsub = subscribeToMyChats(user.uid, (chats) => {
      setUnreadChatCount(chats.filter((c) => isChatUnread(c, user.uid)).length);
    });
    return unsub;
  }, [user]);

  const markChatAsRead = useCallback(
    (chatId: string) => {
      if (!user) return;
      // 購読が新しい lastRead を拾ってバッジは自動で減る
      markChatRead(chatId, user.uid);
    },
    [user]
  );

  // ── ② 自分の投稿へのコメント ──
  // 直近に取得した時刻。タブ切替・フォアグラウンド復帰のたびに掲示板数ぶんのクエリを出さないよう、
  // 呼び出し側が minIntervalMs を渡した時はその間隔内なら何もしない（引数なしは常に取得）。
  const lastRefreshAt = useRef(0);
  const refreshMyPosts = useCallback(async (opts?: { minIntervalMs?: number }) => {
    if (!user || !schoolReady) return;
    if (opts?.minIntervalMs && Date.now() - lastRefreshAt.current < opts.minIntervalMs) return;
    lastRefreshAt.current = Date.now();
    const posts = await fetchMyPosts(schoolDomain, user.uid).catch((e) => {
      console.warn("my posts load failed:", e);
      return null;
    });
    if (!posts) return;
    setMyPosts(posts);

    // 初回（保存が空）のときは現在値で初期化して過去分を新着扱いしない
    if (seenLoaded) {
      setSeen((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const init: Record<string, number> = {};
        posts.forEach((p) => {
          init[myPostKey(p.kind, p.boardId, p.id)] = p.commentCount ?? 0;
        });
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify(init)).catch(() => {});
        return init;
      });
    }
  }, [user, schoolDomain, schoolReady, seenLoaded]);

  useEffect(() => {
    refreshMyPosts();
  }, [refreshMyPosts]);

  // バックグラウンドから戻った時も新着を拾う。
  // 以前は起動時と「自分の投稿」を開いた時だけで、赤丸が付くのはアプリを立ち上げ直した時だった。
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshMyPosts({ minIntervalMs: 30_000 });
    });
    return () => sub.remove();
  }, [refreshMyPosts]);

  const markPostSeen = useCallback(
    (kind: "board" | "lounge", boardId: string, postId: string, commentCount: number) => {
      const key = myPostKey(kind, boardId, postId);
      setSeen((prev) => {
        if (prev[key] === commentCount) return prev;
        const next = { ...prev, [key]: commentCount };
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      // 一覧側の表示も即座に合わせる
      setMyPosts((prev) =>
        prev.map((p) =>
          p.kind === kind && p.boardId === boardId && p.id === postId
            ? { ...p, commentCount }
            : p
        )
      );
    },
    []
  );

  // 新着コメント判定: 既読数(seen[key])より commentCount が多い投稿。
  // seen に無い投稿(初回シード後に書いた新規投稿)は既読0扱い(?? 0)にする。
  // 以前は prev!==undefined で除外していたため、新規投稿に付いたコメントが永遠にバッジにならなかった。
  // seen の読み込み完了前は空(過去分の一瞬の誤点灯を防ぐ)。unmemoized だと毎レンダー新Set→全consumer再描画になるため useMemo。
  const newCommentKeys = useMemo(() => {
    if (!seenLoaded) return new Set<string>();
    return new Set(
      myPosts
        .filter((p) => (p.commentCount ?? 0) > (seen[myPostKey(p.kind, p.boardId, p.id)] ?? 0))
        .map((p) => myPostKey(p.kind, p.boardId, p.id))
    );
  }, [myPosts, seen, seenLoaded]);

  return (
    <NotificationsContext.Provider
      value={{
        unreadChatCount,
        markChatAsRead,
        myPosts,
        newCommentKeys,
        newCommentCount: newCommentKeys.size,
        refreshMyPosts,
        markPostSeen,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
