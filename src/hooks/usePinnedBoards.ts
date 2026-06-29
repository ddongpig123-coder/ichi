import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BoardId } from "../types/board";

const STORAGE_KEY = "ichi:pinnedBoards";

export function usePinnedBoards() {
  const [pinned, setPinned] = useState<BoardId[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setPinned(JSON.parse(raw) as BoardId[]);
      setReady(true);
    });
  }, []);

  const toggle = useCallback(async (id: BoardId) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isPinned = useCallback((id: BoardId) => pinned.includes(id), [pinned]);

  return { pinned, isPinned, toggle, ready };
}
