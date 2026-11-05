import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchCustomBoards } from "../services/boardService";
import { OFFICIAL_BOARDS, type BoardMeta } from "../types/board";

export function useBoards() {
  const { schoolDomain } = useAuth();
  const [customBoards, setCustomBoards] = useState<BoardMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!schoolDomain) return;
    const boards = await fetchCustomBoards(schoolDomain);
    setCustomBoards(boards);
  }, [schoolDomain]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  // 学部別掲示板は 1.1 S4 で廃止（BOARD-ACCESS §3-3 Q3）。既存の category:"department" 板は
  // 消さずに「学生がつくった掲示板」と同じ枠で表示する — 投稿はそのまま見える。
  const userBoards = customBoards;
  const allBoards = [...OFFICIAL_BOARDS, ...customBoards];

  return { allBoards, officialBoards: OFFICIAL_BOARDS, userBoards, customBoards, loading, reload };
}
