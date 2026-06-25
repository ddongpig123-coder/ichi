import { useCallback, useMemo, useState } from "react";
import { MOCK_TIMETABLE, type ClassSession, type Day, type Period } from "../types/timetable";

export function useTimetable(initial: ClassSession[] = MOCK_TIMETABLE) {
  const [sessions, setSessions] = useState<ClassSession[]>(initial);

  const findSession = useCallback(
    (day: Day, period: Period) => sessions.find((s) => s.day === day && s.period === period),
    [sessions]
  );

  // まだUIからは呼ばれないが、編集機能を追加する際はこれを使うだけでよい
  const updateSession = useCallback((id: string, patch: Partial<Omit<ClassSession, "id">>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addSession = useCallback((session: ClassSession) => {
    setSessions((prev) => [...prev, session]);
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return useMemo(
    () => ({ sessions, findSession, updateSession, addSession, removeSession }),
    [sessions, findSession, updateSession, addSession, removeSession]
  );
}
