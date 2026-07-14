import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { fetchFriendProfiles, removeFriendship } from "../services/friendRequestService";
import { getUserProfile, saveFriendOrders } from "../services/userService";

export interface Friend {
  id: string; // = 상대방 uid
  nickname: string;
  photoURL: string | null;
}

const FREQUENT_MAX = 6;

interface FriendsContextValue {
  allFriends: Friend[];
  loading: boolean;
  frequentIds: string[];
  nonFrequentIds: string[];
  frequent: Friend[];
  nonFrequent: Friend[];
  promote: (id: string) => void;
  demote: (id: string) => void;
  reorderFrequent: (ids: string[]) => void;
  reorderNonFrequent: (ids: string[]) => void;
  removeFriend: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [allFriends, setAllFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [frequentIds, setFrequentIds] = useState<string[]>([]);
  const [nonFrequentIds, setNonFrequentIds] = useState<string[]>([]);

  function sortAlpha(ids: string[], friends: Friend[]) {
    return [...ids].sort((a, b) => {
      const fa = friends.find((f) => f.id === a)?.nickname ?? "";
      const fb = friends.find((f) => f.id === b)?.nickname ?? "";
      return fa.localeCompare(fb, "ja");
    });
  }

  // Firestoreから友達一覧と保存済みの表示順を読み込み、
  // 「保存順に並べる → 新規はあいうえお順で末尾へ / 削除済みは除外」の整合を取る
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profiles, me] = await Promise.all([
        fetchFriendProfiles(user.uid),
        getUserProfile(user.uid),
      ]);
      const friends: Friend[] = profiles.map((p) => ({
        id: p.uid,
        nickname: p.nickname || "ゲスト",
        photoURL: p.photoURL,
      }));
      setAllFriends(friends);

      const ids = friends.map((f) => f.id);
      const savedFrequent = (me?.frequentFriendIds ?? []).filter((id) => ids.includes(id));
      const savedOrder = (me?.friendListOrder ?? []).filter(
        (id) => ids.includes(id) && !savedFrequent.includes(id)
      );
      const unknown = ids.filter(
        (id) => !savedFrequent.includes(id) && !savedOrder.includes(id)
      );
      // 새 친구는 자주 찾는 목록이 여유 있으면 거기부터 채움 (초기 사용자 경험)
      const frequentNext = [...savedFrequent];
      const restNew: string[] = [];
      for (const id of sortAlpha(unknown, friends)) {
        if (frequentNext.length < FREQUENT_MAX) frequentNext.push(id);
        else restNew.push(id);
      }
      setFrequentIds(frequentNext);
      setNonFrequentIds([...savedOrder, ...restNew]);
    } catch (e) {
      console.warn("friends load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAllFriends([]);
      setFrequentIds([]);
      setNonFrequentIds([]);
      return;
    }
    refresh();
  }, [user, refresh]);

  // 表示順の永続化（失敗してもローカル状態は維持 — 次の変更で再保存される）
  function persistOrders(frequent: string[], rest: string[]) {
    if (!user) return;
    saveFriendOrders(user.uid, frequent, rest).catch((e) =>
      console.warn("friend order save failed:", e)
    );
  }

  const frequent = frequentIds
    .map((id) => allFriends.find((f) => f.id === id))
    .filter((f): f is Friend => !!f);

  const nonFrequent = nonFrequentIds
    .map((id) => allFriends.find((f) => f.id === id))
    .filter((f): f is Friend => !!f);

  function promote(id: string) {
    if (frequentIds.includes(id) || frequentIds.length >= FREQUENT_MAX) return;
    const nextFrequent = sortAlpha([...frequentIds, id], allFriends);
    const nextRest = nonFrequentIds.filter((fid) => fid !== id);
    setFrequentIds(nextFrequent);
    setNonFrequentIds(nextRest);
    persistOrders(nextFrequent, nextRest);
  }

  function demote(id: string) {
    const nextFrequent = frequentIds.filter((fid) => fid !== id);
    const nextRest = sortAlpha([...nonFrequentIds, id], allFriends);
    setFrequentIds(nextFrequent);
    setNonFrequentIds(nextRest);
    persistOrders(nextFrequent, nextRest);
  }

  function reorderFrequent(ids: string[]) {
    setFrequentIds(ids);
    persistOrders(ids, nonFrequentIds);
  }

  function reorderNonFrequent(ids: string[]) {
    setNonFrequentIds(ids);
    persistOrders(frequentIds, ids);
  }

  async function removeFriend(id: string) {
    if (!user) return;
    await removeFriendship(user.uid, id);
    const nextFrequent = frequentIds.filter((fid) => fid !== id);
    const nextRest = nonFrequentIds.filter((fid) => fid !== id);
    setAllFriends((prev) => prev.filter((f) => f.id !== id));
    setFrequentIds(nextFrequent);
    setNonFrequentIds(nextRest);
    persistOrders(nextFrequent, nextRest);
  }

  return (
    <FriendsContext.Provider
      value={{
        allFriends,
        loading,
        frequentIds,
        nonFrequentIds,
        frequent,
        nonFrequent,
        promote,
        demote,
        reorderFrequent,
        reorderNonFrequent,
        removeFriend,
        refresh,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
}
