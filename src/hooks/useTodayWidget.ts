import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { useFriends } from "../contexts/FriendsContext";
import type { ClassSession } from "../types/timetable";
import {
  canUseWidgets,
  currentSemesterKey,
  loadWidgetFriends,
  prepareTodayWidget,
  updateTodayWidget,
  type WidgetFriend,
} from "../services/widgetService";

// ============================================================
// iPhone ホーム画面ウィジェット（RELEASE-PLAN N4 / docs/WIDGET.md）へ、
// 自分の今の学期の時間割と「よく使う友達」の時間割を渡す（ホーム画面から呼ぶ）。
// 部品の無い旧アプリ・Android・Web では何もしない（友達の時間割も読まない）。
// ============================================================

export function useTodayWidget(mySessions: ClassSession[] | undefined, language: "ja" | "ko") {
  const { frequent } = useFriends();
  const [friends, setFriends] = useState<WidgetFriend[] | null>(null);
  const semesterKey = currentSemesterKey();
  // よく使う友達の顔ぶれ・名前・順番が変わったときだけ読み直す
  const frequentKey = useMemo(() => frequent.map((f) => `${f.id}:${f.nickname}`).join("|"), [frequent]);

  useEffect(() => {
    if (canUseWidgets) prepareTodayWidget();
  }, []);

  useEffect(() => {
    if (!canUseWidgets) return;
    let cancelled = false;
    loadWidgetFriends(frequent, semesterKey)
      .then((list) => {
        if (!cancelled) setFriends(list);
      })
      .catch(() => {
        if (!cancelled) setFriends([]);
      });
    return () => {
      cancelled = true;
    };
    // frequentKey が frequent の中身の代わり
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequentKey, semesterKey]);

  useEffect(() => {
    if (!canUseWidgets || !mySessions) return; // まだ読んでいない
    updateTodayWidget(mySessions, language, Linking.createURL("/"), friends ?? []);
  }, [mySessions, language, friends]);
}
