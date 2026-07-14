import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  blockUser,
  unblockUser,
  fetchBlockedUsers,
} from "../services/blockService";
import type { BlockedUser } from "../types/moderation";

// アプリ全体で「自分のブロックリスト」を保持する。
// 各画面は isBlocked(uid) で投稿・コメント・メッセージの表示を折りたたむ。
interface BlockContextValue {
  blockedUids: Set<string>;
  blockedUsers: BlockedUser[];
  isBlocked: (uid: string) => boolean;
  block: (uid: string) => Promise<void>;
  unblock: (uid: string) => Promise<void>;
  reload: () => Promise<void>;
  ready: boolean;
}

const BlockContext = createContext<BlockContextValue>({
  blockedUids: new Set(),
  blockedUsers: [],
  isBlocked: () => false,
  block: async () => {},
  unblock: async () => {},
  reload: async () => {},
  ready: false,
});

export function BlockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setBlockedUsers([]);
      return;
    }
    try {
      const list = await fetchBlockedUsers(user.uid);
      setBlockedUsers(list);
    } catch (e) {
      console.warn("fetchBlockedUsers failed:", e);
    }
  }, [user]);

  useEffect(() => {
    reload().finally(() => setReady(true));
  }, [reload]);

  const blockedUids = new Set(blockedUsers.map((b) => b.blockedUid));

  const isBlocked = useCallback(
    (uid: string) => blockedUids.has(uid),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockedUsers]
  );

  const block = useCallback(
    async (uid: string) => {
      if (!user || user.uid === uid) return;
      await blockUser(user.uid, uid);
      // 楽観的更新（サーバー確定を待たずに即反映）
      setBlockedUsers((prev) =>
        prev.some((b) => b.blockedUid === uid)
          ? prev
          : [{ blockedUid: uid, createdAt: Date.now() }, ...prev]
      );
    },
    [user]
  );

  const unblock = useCallback(
    async (uid: string) => {
      if (!user) return;
      await unblockUser(user.uid, uid);
      setBlockedUsers((prev) => prev.filter((b) => b.blockedUid !== uid));
    },
    [user]
  );

  return (
    <BlockContext.Provider
      value={{ blockedUids, blockedUsers, isBlocked, block, unblock, reload, ready }}
    >
      {children}
    </BlockContext.Provider>
  );
}

export const useBlock = () => useContext(BlockContext);
