import { createContext, useContext, useState, ReactNode } from "react";

export interface Friend {
  id: string;
  nickname: string;
  photoURL: string | null;
}

// 全友達リスト（将来的には Firestore から取得）
export const ALL_FRIENDS: Friend[] = [
  { id: "1", nickname: "りく", photoURL: null },
  { id: "2", nickname: "さくらもち", photoURL: null },
  { id: "3", nickname: "ゆうたろう", photoURL: null },
  { id: "4", nickname: "ちょこばななだいすき", photoURL: null },
  { id: "5", nickname: "あお", photoURL: null },
  { id: "6", nickname: "かいと", photoURL: null },
  { id: "7", nickname: "なな", photoURL: null },
  { id: "8", nickname: "まなと", photoURL: null },
];

function sortAlpha(friends: Friend[]) {
  return [...friends].sort((a, b) => a.nickname.localeCompare(b.nickname, "ja"));
}

// 初期「よく使う友達」: 全友達をあいうえお順にして先頭6人
const INITIAL_FREQUENT_IDS = sortAlpha(ALL_FRIENDS)
  .slice(0, 6)
  .map((f) => f.id);

interface FriendsContextValue {
  allFriends: Friend[];
  frequentIds: string[];         // 順番つき、最大6人
  frequent: Friend[];            // frequentIds 順に並んだ Friend[]
  nonFrequent: Friend[];         // よく使わない友達（あいうえお順）
  promote: (id: string) => void; // よく使うに追加
  demote: (id: string) => void;  // よく使うから外す
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const [frequentIds, setFrequentIds] = useState<string[]>(INITIAL_FREQUENT_IDS);

  const frequent = frequentIds
    .map((id) => ALL_FRIENDS.find((f) => f.id === id)!)
    .filter(Boolean);

  const nonFrequent = sortAlpha(
    ALL_FRIENDS.filter((f) => !frequentIds.includes(f.id))
  );

  function promote(id: string) {
    if (frequentIds.includes(id) || frequentIds.length >= 6) return;
    // あいうえお順に挿入
    const friend = ALL_FRIENDS.find((f) => f.id === id)!;
    setFrequentIds((prev) => {
      const newList = [...prev, id];
      // 並べ替え: あいうえお順を保つ
      return newList.sort((a, b) => {
        const fa = ALL_FRIENDS.find((f) => f.id === a)!;
        const fb = ALL_FRIENDS.find((f) => f.id === b)!;
        return fa.nickname.localeCompare(fb.nickname, "ja");
      });
    });
  }

  function demote(id: string) {
    setFrequentIds((prev) => prev.filter((fid) => fid !== id));
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setFrequentIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setFrequentIds((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  return (
    <FriendsContext.Provider
      value={{ allFriends: ALL_FRIENDS, frequentIds, frequent, nonFrequent, promote, demote, moveUp, moveDown }}
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
