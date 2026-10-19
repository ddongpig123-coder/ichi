import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  refreshMyPosts: () => Promise<void>;
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
  const seenLoaded = useRef(false);

  // ── 既読コメント数のロード ──
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => {
        if (raw) setSeen(JSON.parse(raw));
        seenLoaded.current = true;
      })
      .catch(() => {
        seenLoaded.current = true;
      });
  }, []);

  // ── ① メッセージ未読（リアルタイム購読） ──
  useEffect(() => {
    if (!user || !schoolDomain) {
      setUnreadChatCount(0);
      return;
    }
    const unsub = subscribeToMyChats(schoolDomain, user.uid, (chats) => {
      setUnreadChatCount(chats.filter((c) => isChatUnread(c, user.uid)).length);
    });
    return unsub;
  }, [user, schoolDomain]);

  const markChatAsRead = useCallback(
    (chatId: string) => {
      if (!user || !schoolDomain) return;
      // 購読が新しい lastRead を拾ってバッジは自動で減る
      markChatRead(schoolDomain, chatId, user.uid);
    },
    [user, schoolDomain]
  );

  // ── ② 自分の投稿へのコメント ──
  const refreshMyPosts = useCallback(async () => {
    if (!user || !schoolReady) return;
    const posts = await fetchMyPosts(schoolDomain, user.uid).catch((e) => {
      console.warn("my posts load failed:", e);
      return null;
    });
    if (!posts) return;
    setMyPosts(posts);

    // 初回（保存が空）のときは現在値で初期化して過去分を新着扱いしない
    if (seenLoaded.current) {
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
  }, [user, schoolDomain, schoolReady]);

  useEffect(() => {
    refreshMyPosts();
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
    if (!seenLoaded.current) return new Set<string>();
    return new Set(
      myPosts
        .filter((p) => (p.commentCount ?? 0) > (seen[myPostKey(p.kind, p.boardId, p.id)] ?? 0))
        .map((p) => myPostKey(p.kind, p.boardId, p.id))
    );
  }, [myPosts, seen]);

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
