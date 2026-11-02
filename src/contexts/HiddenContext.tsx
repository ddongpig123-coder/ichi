import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 「非表示にした投稿・コメント」をアプリ全体で保持する（App Store 審査指針 1.2 対応）。
// 通報した投稿は即座に自分のフィードから消える必要があるため、サーバーの運営対応を
// 待たずにクライアント側で隠す。対象はドキュメント id（投稿 id / コメント id / レビューの uid）。
//
// 端末ローカル(AsyncStorage)保存 — 本人以外に見える情報ではなく、Firestore 規則の変更が
// 不要なため。ブロック（users/{uid}/blocks）は端末をまたぐが、非表示は端末ごとで十分。
const STORAGE_KEY = "hiddenContent:v1";

interface HiddenContextValue {
  hiddenIds: Set<string>;
  isHidden: (id: string) => boolean;
  hide: (id: string) => Promise<void>;
  unhideAll: () => Promise<void>;
  ready: boolean;
}

const HiddenContext = createContext<HiddenContextValue>({
  hiddenIds: new Set(),
  isHidden: () => false,
  hide: async () => {},
  unhideAll: async () => {},
  ready: false,
});

export function HiddenProvider({ children }: { children: React.ReactNode }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  // setState の更新関数は遅延実行されることがあるため、永続化用に最新値を ref でも持つ
  const latest = useRef<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const loaded = new Set<string>(arr.filter((x) => typeof x === "string"));
          latest.current = loaded;
          setHiddenIds(loaded);
        }
      })
      .catch((e) => console.warn("load hidden content failed:", e))
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback(async (next: Set<string>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch (e) {
      console.warn("save hidden content failed:", e);
    }
  }, []);

  const isHidden = useCallback((id: string) => hiddenIds.has(id), [hiddenIds]);

  const hide = useCallback(
    async (id: string) => {
      if (!id) return;
      if (latest.current.has(id)) return;
      // 楽観的更新: 画面から即座に消すのが要件なので state を先に変え、保存は後で行う
      const next = new Set(latest.current);
      next.add(id);
      latest.current = next;
      setHiddenIds(next);
      await persist(next);
    },
    [persist]
  );

  const unhideAll = useCallback(async () => {
    latest.current = new Set();
    setHiddenIds(new Set());
    await persist(new Set());
  }, [persist]);

  return (
    <HiddenContext.Provider value={{ hiddenIds, isHidden, hide, unhideAll, ready }}>
      {children}
    </HiddenContext.Provider>
  );
}

export const useHidden = () => useContext(HiddenContext);

// 通報・非表示メニューに渡す targetPath（Firestore のドキュメントパス）から、
// 非表示判定に使う id（最後のセグメント）を取り出す。
export function hiddenIdFromPath(path: string): string {
  const seg = path.split("/").filter(Boolean);
  return seg[seg.length - 1] ?? "";
}
