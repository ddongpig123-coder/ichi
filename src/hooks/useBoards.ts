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

  const departmentBoards = customBoards.filter((b) => b.category === "department");
  const userBoards = customBoards.filter((b) => b.category === "custom");
  const allBoards = [...OFFICIAL_BOARDS, ...customBoards];

  return { allBoards, officialBoards: OFFICIAL_BOARDS, departmentBoards, userBoards, customBoards, loading, reload };
}
