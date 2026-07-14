import { useMemo, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import type { Theme } from "../../src/theme/themes";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import TimeTable from "../../src/components/timetable/TimeTable";
import SessionFormModal, { type SessionFormValue } from "../../src/components/timetable/SessionFormModal";
import FriendsList from "../../src/components/friends/FriendsList";
import type { ClassSession, Day, Period } from "../../src/types/timetable";
import {
  SEMESTER_TIMETABLES,
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

  const semesterKey: SemesterKey = `${selectedYear}-${selectedSemester}`;
  const [sessionsMap, setSessionsMap] = useState<Record<string, ClassSession[]>>(
    Object.fromEntries(Object.entries(SEMESTER_TIMETABLES))
  );
  const sessions = sessionsMap[semesterKey] ?? [];
  const friendOverlaps = SEMESTER_FRIEND_OVERLAPS[semesterKey] ?? {};

  const [target, setTarget] = useState<{ day: Day; period: Period; session?: ClassSession } | null>(null);

  const headerH = NAV_HEADER_BASE + insets.top;
  const chromeH = headerH + TAB_BAR_BASE + insets.bottom;
  const timetableH = height - chromeH - FRIENDS_SECTION_H;
  const cellHeight = Math.max(48, (timetableH - TIMETABLE_HEADER_H) / PERIODS_COUNT);

  function handleSubmit(value: SessionFormValue) {
    if (!target) return;
    setSessionsMap((prev) => {
      const current = prev[semesterKey] ?? [];
      if (target.session) {
        return { ...prev, [semesterKey]: current.map((s) => s.id === target.session!.id ? { ...s, ...value } : s) };
      } else {
        return { ...prev, [semesterKey]: [...current, { id: `${Date.now()}`, day: target.day, period: target.period, ...value }] };
      }
    });
    setTarget(null);
  }

  function handleDelete() {
    if (!target?.session) return;
    setSessionsMap((prev) => ({
      ...prev,
      [semesterKey]: (prev[semesterKey] ?? []).filter((s) => s.id !== target.session!.id),
    }));
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
