import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BoardId } from "../types/board";

const STORAGE_KEY = "ichi:pinnedBoards";

export function usePinnedBoards() {
  const [pinned, setPinned] = useState<BoardId[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ストレージ読み込みに失敗しても画面自体は表示させる
    // （過去にネイティブモジュール不一致でここが落ちて掲示板タブ全体が開けなくなった）
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPinned(JSON.parse(raw) as BoardId[]);
      })
      .catch((e) => console.warn("pinnedBoards load failed:", e))
      .finally(() => setReady(true));
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
