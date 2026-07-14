import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import type { Theme } from "../../src/theme/themes";
import { useAuth } from "../../src/contexts/AuthContext";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import TimeTable from "../../src/components/timetable/TimeTable";
import SessionFormModal, { type SessionFormValue } from "../../src/components/timetable/SessionFormModal";
import FriendsList from "../../src/components/friends/FriendsList";
import { getTimetable, saveTimetableSessions } from "../../src/services/timetableService";
import type { ClassSession, Day, Period } from "../../src/types/timetable";
import {
  SEMESTER_FRIEND_OVERLAPS,
  type Semester,
  type SemesterKey,
  getCurrentSemester,
  isSemesterAvailable,
} from "../../src/data/semesterTimetables";

const TIMETABLE_HEADER_H = 24;
const PERIODS_COUNT = 7;
const NAV_HEADER_BASE = 44;
const TAB_BAR_BASE = 49;
const FRIENDS_SECTION_H = 185;

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState<Semester>(getCurrentSemester());

  const { user } = useAuth();
  const semesterKey: SemesterKey = `${selectedYear}-${selectedSemester}`;

  // 学期別セッションのローカルキャッシュ。Firestoreからは学期ごとに1回だけロードする。
  const [sessionsMap, setSessionsMap] = useState<Record<string, ClassSession[]>>({});
  // Firestoreにまだドキュメントがない学期（初回保存時に visibility を初期化するため記録）
  const missingDocKeys = useRef<Set<string>>(new Set());
  const loadedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || loadedKeys.current.has(semesterKey)) return;
    loadedKeys.current.add(semesterKey);
    getTimetable(user.uid, semesterKey)
      .then((docData) => {
        if (!docData) missingDocKeys.current.add(semesterKey);
        setSessionsMap((prev) => ({ ...prev, [semesterKey]: docData?.sessions ?? [] }));
      })
      .catch((e) => {
        console.warn("timetable load failed:", e);
        loadedKeys.current.delete(semesterKey); // 次のフォーカスで再試行できるように
      });
  }, [user, semesterKey]);

  const sessions = sessionsMap[semesterKey] ?? [];
  // 友達との重なり表示は3〜4週目に実データ化予定（現在はモック）
  const friendOverlaps = SEMESTER_FRIEND_OVERLAPS[semesterKey] ?? {};

  const [target, setTarget] = useState<{ day: Day; period: Period; session?: ClassSession } | null>(null);

  // ローカル更新 + Firestore保存（保存失敗はログのみ — 次の保存で全量上書きされる）
  function persistSessions(next: ClassSession[]) {
    setSessionsMap((prev) => ({ ...prev, [semesterKey]: next }));
    if (!user) return;
    const isNew = missingDocKeys.current.has(semesterKey);
    saveTimetableSessions(user.uid, semesterKey, next, { initVisibility: isNew })
      .then(() => missingDocKeys.current.delete(semesterKey))
      .catch((e) => console.warn("timetable save failed:", e));
  }

  const headerH = NAV_HEADER_BASE + insets.top;
  const chromeH = headerH + TAB_BAR_BASE + insets.bottom;
  const timetableH = height - chromeH - FRIENDS_SECTION_H;
  const cellHeight = Math.max(48, (timetableH - TIMETABLE_HEADER_H) / PERIODS_COUNT);

  function handleSubmit(value: SessionFormValue) {
    if (!target) return;
    const current = sessionsMap[semesterKey] ?? [];
    const next = target.session
      ? current.map((s) => (s.id === target.session!.id ? { ...s, ...value } : s))
      : [...current, { id: `${Date.now()}`, day: target.day, period: target.period, ...value }];
    persistSessions(next);
    setTarget(null);
  }

  function handleDelete() {
    if (!target?.session) return;
    persistSessions((sessionsMap[semesterKey] ?? []).filter((s) => s.id !== target.session!.id));
    setTarget(null);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SemesterSelector
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        onChangeYear={(year) => {
          setSelectedYear(year);
          if (!isSemesterAvailable(year, selectedSemester)) setSelectedSemester("春");
        }}
        onChangeSemester={setSelectedSemester}
      />

      <TimeTable
        sessions={sessions}
        onPressEmptyCell={(day, period) => setTarget({ day, period })}
        onPressSession={(session) => setTarget({ day: session.day, period: session.period, session })}
        cellHeight={cellHeight}
        friendOverlaps={friendOverlaps}
      />

      <FriendsList />

      <SessionFormModal
        visible={target !== null}
        day={target?.day ?? null}
        period={target?.period ?? null}
        initialValue={target?.session ?? null}
        onClose={() => setTarget(null)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
  });
}
