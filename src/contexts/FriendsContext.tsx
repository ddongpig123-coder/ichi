import { createContext, useContext, useState, ReactNode } from "react";

export interface Friend {
  id: string;
  nickname: string;
  photoURL: string | null;
}

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

function sortAlpha(ids: string[]) {
  return [...ids].sort((a, b) => {
    const fa = ALL_FRIENDS.find((f) => f.id === a)!;
    const fb = ALL_FRIENDS.find((f) => f.id === b)!;
    return fa.nickname.localeCompare(fb.nickname, "ja");
  });
}

const ALL_IDS = ALL_FRIENDS.map((f) => f.id);
const INITIAL_FREQUENT_IDS = sortAlpha(ALL_IDS).slice(0, 6);
const INITIAL_NON_FREQUENT_IDS = sortAlpha(
  ALL_IDS.filter((id) => !INITIAL_FREQUENT_IDS.includes(id))
);

interface FriendsContextValue {
  allFriends: Friend[];
  frequentIds: string[];
  nonFrequentIds: string[];
  frequent: Friend[];
  nonFrequent: Friend[];
  promote: (id: string) => void;
  demote: (id: string) => void;
  reorderFrequent: (ids: string[]) => void;
  reorderNonFrequent: (ids: string[]) => void;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const [frequentIds, setFrequentIds] = useState<string[]>(INITIAL_FREQUENT_IDS);
  const [nonFrequentIds, setNonFrequentIds] = useState<string[]>(INITIAL_NON_FREQUENT_IDS);

  const frequent = frequentIds
    .map((id) => ALL_FRIENDS.find((f) => f.id === id)!)
    .filter(Boolean);

  const nonFrequent = nonFrequentIds
    .map((id) => ALL_FRIENDS.find((f) => f.id === id)!)
    .filter(Boolean);

  function promote(id: string) {
    if (frequentIds.includes(id) || frequentIds.length >= 6) return;
    // あいうえお順に挿入
    setFrequentIds((prev) =>
      sortAlpha([...prev, id])
    );
    setNonFrequentIds((prev) => prev.filter((fid) => fid !== id));
  }

  function demote(id: string) {
    setFrequentIds((prev) => prev.filter((fid) => fid !== id));
    // あいうえお順に挿入
    setNonFrequentIds((prev) => sortAlpha([...prev, id]));
  }

  function reorderFrequent(ids: string[]) {
    setFrequentIds(ids);
  }

  function reorderNonFrequent(ids: string[]) {
    setNonFrequentIds(ids);
  }

  return (
    <FriendsContext.Provider
      value={{
        allFriends: ALL_FRIENDS,
        frequentIds,
        nonFrequentIds,
        frequent,
        nonFrequent,
        promote,
        demote,
        reorderFrequent,
        reorderNonFrequent,
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
