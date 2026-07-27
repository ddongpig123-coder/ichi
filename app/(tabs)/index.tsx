import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import type { Theme } from "../../src/theme/themes";
import { useAuth } from "../../src/contexts/AuthContext";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import TimeTable from "../../src/components/timetable/TimeTable";
import SessionFormModal, { type SessionFormValue } from "../../src/components/timetable/SessionFormModal";
import VisibilitySelector from "../../src/components/timetable/VisibilitySelector";
import FriendsList from "../../src/components/friends/FriendsList";
import {
  getTimetable,
  saveTimetableSessions,
  setTimetableVisibility,
  type TimetableVisibility,
} from "../../src/services/timetableService";
import { useFriendOverlaps } from "../../src/hooks/useFriendOverlaps";
import type { ClassSession, Day, Period } from "../../src/types/timetable";
import {
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
const COURSE_SEARCH_ROW_H = 44; // 講義検索への導線ぶんの高さ

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState<Semester>(getCurrentSemester());

  const { user } = useAuth();
  const semesterKey: SemesterKey = `${selectedYear}-${selectedSemester}`;

  // 学期別セッションのローカルキャッシュ。Firestoreからは学期ごとに1回だけロードする。
  const [sessionsMap, setSessionsMap] = useState<Record<string, ClassSession[]>>({});
  // 学期別の公開範囲（未ロード/未作成の学期は既定 "friends"）
  const [visibilityMap, setVisibilityMap] = useState<Record<string, TimetableVisibility>>({});
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
        setVisibilityMap((prev) => ({ ...prev, [semesterKey]: docData?.visibility ?? "friends" }));
      })
      .catch((e) => {
        console.warn("timetable load failed:", e);
        loadedKeys.current.delete(semesterKey); // 次のフォーカスで再試行できるように
      });
  }, [user, semesterKey]);

  // 講義検索画面は Firestore を直接更新するため、戻ってきたら該当学期を読み直す。
  // 初回フォーカスは上の useEffect が読むのでスキップする（二重読み取り防止）。
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (!user) return;
      getTimetable(user.uid, semesterKey)
        .then((docData) => {
          if (!docData) return;
          missingDocKeys.current.delete(semesterKey);
          setSessionsMap((prev) => ({ ...prev, [semesterKey]: docData.sessions }));
          setVisibilityMap((prev) => ({ ...prev, [semesterKey]: docData.visibility ?? "friends" }));
        })
        .catch((e) => console.warn("timetable refresh failed:", e));
    }, [user, semesterKey])
  );

  const sessions = sessionsMap[semesterKey] ?? [];
  const visibility = visibilityMap[semesterKey] ?? "friends";
  // 同じ講義を取っている友達（実データ: 友達の公開時間割と突き合わせ）
  const friendOverlaps = useFriendOverlaps(semesterKey, sessions);

  // 公開範囲の変更（楽観更新 + Firestore保存、失敗時は元に戻す）
  function handleChangeVisibility(next: TimetableVisibility) {
    if (!user || next === visibility) return;
    const prev = visibility;
    setVisibilityMap((m) => ({ ...m, [semesterKey]: next }));
    setTimetableVisibility(user.uid, semesterKey, next)
      .then(() => missingDocKeys.current.delete(semesterKey)) // ドキュメントが確定 → 以後の保存で visibility を初期化しない
      .catch((e) => {
        console.warn("visibility save failed:", e);
        setVisibilityMap((m) => ({ ...m, [semesterKey]: prev }));
      });
  }

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
  const chromeH = headerH + TAB_BAR_BASE + insets.bottom + COURSE_SEARCH_ROW_H;
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
        rightSlot={<VisibilitySelector value={visibility} onChange={handleChangeVisibility} />}
      />

      <TimeTable
        sessions={sessions}
        onPressEmptyCell={(day, period) => setTarget({ day, period })}
        onPressSession={(session) => setTarget({ day: session.day, period: session.period, session })}
        cellHeight={cellHeight}
        friendOverlaps={friendOverlaps}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            router.push(`/course-search?year=${selectedYear}&semester=${selectedSemester}`)
          }
        >
          <Text style={styles.actionText} numberOfLines={1}>{t("courseSearch.entry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            router.push(`/senior-timetables?year=${selectedYear}&semester=${selectedSemester}`)
          }
        >
          <Text style={styles.actionText} numberOfLines={1}>{t("senior.entry")}</Text>
        </TouchableOpacity>
      </View>

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
    actionRow: {
      height: COURSE_SEARCH_ROW_H,
      flexDirection: "row",
      marginHorizontal: 12,
      marginVertical: 4,
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.primary,
    },
    actionText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
  });
}
