import { useEffect, useState } from "react";
import { useFriends, type Friend } from "../contexts/FriendsContext";
import { getTimetable } from "../services/timetableService";
import { isPlaced, type ClassSession } from "../types/timetable";
import type { Course } from "../types/course";

// ============================================================
// 友達の時間割（学期ごと）をまとめて読む。講義検索の「この授業を取っている友達」用（S7 / I-2, 2026-11-28）。
// 非公開（permission-denied）・未作成は空として扱う。読み取りは友達の人数ぶん。
// 同じ学期は 5 分間アプリ内でキャッシュ（検索のたびに読み直さない）。
// ============================================================

const TTL = 5 * 60 * 1000;
const cache = new Map<string, { at: number; sessions: ClassSession[] }>();

export function useFriendSessions(semesterKey: string): Record<string, ClassSession[]> {
  const { allFriends } = useFriends();
  const [map, setMap] = useState<Record<string, ClassSession[]>>({});

  useEffect(() => {
    let alive = true;
    Promise.all(
      allFriends.map(async (f) => {
        const key = `${f.id}|${semesterKey}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL) return [f.id, hit.sessions] as const;
        let sessions: ClassSession[] = [];
        try { sessions = (await getTimetable(f.id, semesterKey))?.sessions ?? []; } catch { /* 非公開 */ }
        cache.set(key, { at: Date.now(), sessions });
        return [f.id, sessions] as const;
      })
    ).then((entries) => { if (alive) setMap(Object.fromEntries(entries)); });
    return () => { alive = false; };
  }, [allFriends, semesterKey]);

  return map;
}

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");

// その講義を時間割に入れている友達。一致 = 曜日・時限・講義名（ホームの重なり表示と同じ基準）。
// 曜日・時限なしの講義（集中・オンデマンド）は「その他」欄どうしで講義名だけ見る（I-8）
export function friendsTakingCourse(
  course: Course,
  friendSessions: Record<string, ClassSession[]>,
  friends: Friend[]
): Friend[] {
  const name = norm(course.name);
  return friends.filter((f) =>
    (friendSessions[f.id] ?? []).some((s) =>
      norm(s.name) === name &&
      (course.day === null
        ? !isPlaced(s)
        : s.day === course.day && s.period === course.period)
    )
  );
}
