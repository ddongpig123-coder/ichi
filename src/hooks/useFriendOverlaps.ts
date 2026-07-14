import { useEffect, useMemo, useRef, useState } from "react";
import { useFriends } from "../contexts/FriendsContext";
import { getTimetable } from "../services/timetableService";
import type { ClassSession } from "../types/timetable";

// ============================================================
// 自分の時間割と友達の時間割を突き合わせ、同じ講義を取っている友達を
// セルキー("木-1"形式) → 友達uid配列 のマップで返す。
// 一致判定: 曜日 + 時限 + 講義名（前後空白を除去して完全一致）。
// 友達の時間割が非公開(permission-denied)の場合はスキップする。
// ============================================================

function normalize(name: string): string {
  return name.trim();
}

export function useFriendOverlaps(
  semesterKey: string,
  mySessions: ClassSession[]
): Record<string, string[]> {
  const { allFriends } = useFriends();
  // key: `${friendId}|${semesterKey}` → sessions（非公開・未設定は空配列）
  const cacheRef = useRef<Record<string, ClassSession[]>>({});
  const [loadedVersion, setLoadedVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const targets = allFriends.filter(
      (f) => cacheRef.current[`${f.id}|${semesterKey}`] === undefined
    );
    if (targets.length === 0) return;

    Promise.all(
      targets.map(async (f) => {
        const cacheKey = `${f.id}|${semesterKey}`;
        try {
          const docData = await getTimetable(f.id, semesterKey);
          cacheRef.current[cacheKey] = docData?.sessions ?? [];
        } catch {
          cacheRef.current[cacheKey] = []; // 非公開はスキップ扱い
        }
      })
    ).then(() => {
      if (!cancelled) setLoadedVersion((v) => v + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [allFriends, semesterKey]);

  return useMemo(() => {
    const overlaps: Record<string, string[]> = {};
    for (const session of mySessions) {
      const cellKey = `${session.day}-${session.period}`;
      const myName = normalize(session.name);
      const matched: string[] = [];
      for (const friend of allFriends) {
        const friendSessions = cacheRef.current[`${friend.id}|${semesterKey}`] ?? [];
        const hit = friendSessions.some(
          (s) =>
            s.day === session.day &&
            s.period === session.period &&
            normalize(s.name) === myName
        );
        if (hit) matched.push(friend.id);
      }
      if (matched.length > 0) overlaps[cellKey] = matched;
    }
    return overlaps;
    // loadedVersion はキャッシュ更新の再計算トリガー
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySessions, allFriends, semesterKey, loadedVersion]);
}
