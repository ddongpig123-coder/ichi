import { useState, useEffect } from "react";
import type { ClassSession } from "../types/timetable";
import { MOCK_FRIEND_TIMETABLES } from "../data/mockFriendTimetables";

interface UseFriendTimetableResult {
  sessions: ClassSession[];
  loading: boolean;
}

/**
 * 友達の時間割を取得するフック。
 * 現在はローカルモックから返すが、将来的には以下のように Firestore に切り替える:
 *   const doc = await getDoc(doc(db, "users", friendId, "timetable", "data"));
 *   return doc.data()?.sessions ?? [];
 */
export function useFriendTimetable(friendId: string | null): UseFriendTimetableResult {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friendId) {
      setSessions([]);
      return;
    }

    setLoading(true);
    // ネットワーク遅延をシミュレートしない（モック時はすぐ返す）
    // Firestore 切り替え後はここを非同期 fetch に置き換える
    const data = MOCK_FRIEND_TIMETABLES[friendId] ?? [];
    setSessions(data);
    setLoading(false);
  }, [friendId]);

  return { sessions, loading };
}
