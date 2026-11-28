import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TAB_BAR_HEIGHT } from "../../src/theme/layout";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import type { Theme } from "../../src/theme/themes";
import { useAuth } from "../../src/contexts/AuthContext";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import TimeTable from "../../src/components/timetable/TimeTable";
import SessionFormModal, { type SessionFormValue } from "../../src/components/timetable/SessionFormModal";
import OtherSessionsRow, { OTHER_ROW_HEIGHT } from "../../src/components/timetable/OtherSessionsRow";
import VisibilitySelector from "../../src/components/timetable/VisibilitySelector";
import FriendsList from "../../src/components/friends/FriendsList";
import {
  getTimetable,
  saveTimetableSessions,
  setTimetableVisibility,
  type TimetableVisibility,
} from "../../src/services/timetableService";
import { useFriendOverlaps } from "../../src/hooks/useFriendOverlaps";
import { canReadTimetableImage } from "../../src/services/timetableOcrService";
import { currentSemesterKey } from "../../src/services/widgetService";
import { useTodayWidget } from "../../src/hooks/useTodayWidget";
import { notify } from "../../src/utils/dialog";
import { friendlyErrorBody } from "../../src/utils/writeError";
import { otherSessions, placedSessions, type ClassSession, type Day, type Period } from "../../src/types/timetable";
import {
  type Semester,
  type SemesterKey,
  getCurrentAcademicYear,
  getCurrentSemester,
  isSemesterAvailable,
} from "../../src/data/semesterTimetables";

const TIMETABLE_HEADER_H = 24;
const PERIODS_COUNT = 7;
const NAV_HEADER_BASE = 44;
const TAB_BAR_BASE = TAB_BAR_HEIGHT;
const FRIENDS_SECTION_H = 185;
const COURSE_SEARCH_ROW_H = 44; // 講義検索への導線ぶんの高さ

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [selectedYear, setSelectedYear] = useState(getCurrentAcademicYear);
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

  // ログイン等で uid が変わったら学期キャッシュは別人のものなので破棄する
  const cachedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    if (cachedUid.current !== user.uid) {
      cachedUid.current = user.uid;
      loadedKeys.current.clear();
      missingDocKeys.current.clear();
      setSessionsMap({});
      setVisibilityMap({});
    }
    if (loadedKeys.current.has(semesterKey)) return;
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

  // iPhone のホーム画面ウィジェット（N4）: 今の学期の時間割（とよく使う友達の時間割）を読んだ・保存したら渡す。
  // ホームで別の学期を見ていても、ウィジェットは今の学期。部品の無い旧アプリ・Android・Web では何もしない
  useTodayWidget(sessionsMap[currentSemesterKey()], language);
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

  // day/period が null = 「その他」欄（曜日・時限なし）の追加・編集（I-8）
  const [target, setTarget] = useState<{ day: Day | null; period: Period | null; session?: ClassSession } | null>(null);

  // 編集モード: 授業を長押し → 揺れて × が出る → × で即削除（2026-11-28 ユーザー要望）。
  // 消した直後は「元に戻す」を数秒出す（誤タップ対策）。学期を替えたら抜ける
  const [editMode, setEditMode] = useState(false);
  const [undo, setUndo] = useState<{ key: SemesterKey; session: ClassSession } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setEditMode(false); setUndo(null); }, [semesterKey]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // ローカル更新 + Firestore保存。失敗したら元に戻して知らせる
  // （以前はログのみで、画面上は保存できたように見え、次回起動で「消えた」になっていた）
  function persistSessions(next: ClassSession[]) {
    const prev = sessionsMap[semesterKey] ?? [];
    setSessionsMap((m) => ({ ...m, [semesterKey]: next }));
    if (!user) return;
    const isNew = missingDocKeys.current.has(semesterKey);
    saveTimetableSessions(user.uid, semesterKey, next, { initVisibility: isNew })
      .then(() => missingDocKeys.current.delete(semesterKey))
      .catch((e) => {
        // その後に別の保存が済んでいたら触らない（参照が next のままの時だけ戻す）
        setSessionsMap((m) => (m[semesterKey] === next ? { ...m, [semesterKey]: prev } : m));
        notify(t("common.saveFailed"), friendlyErrorBody(e, t));
      });
  }

  const headerH = NAV_HEADER_BASE + insets.top;
  const chromeH = headerH + TAB_BAR_BASE + insets.bottom + COURSE_SEARCH_ROW_H + OTHER_ROW_HEIGHT;
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

  function deleteInEditMode(session: ClassSession) {
    const next = (sessionsMap[semesterKey] ?? []).filter((s) => s.id !== session.id);
    persistSessions(next);
    setUndo({ key: semesterKey, session });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4500);
    if (placedSessions(next).length === 0) setEditMode(false);
  }

  function undoDelete() {
    if (!undo || undo.key !== semesterKey) return;
    const current = sessionsMap[semesterKey] ?? [];
    if (!current.some((s) => s.id === undo.session.id)) persistSessions([...current, undo.session]);
    setUndo(null);
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
        rightSlot={
          editMode ? (
            <TouchableOpacity style={styles.doneBtn} onPress={() => setEditMode(false)} accessibilityRole="button">
              <Text style={styles.doneBtnText}>{t("home.editDone")}</Text>
            </TouchableOpacity>
          ) : (
            <VisibilitySelector value={visibility} onChange={handleChangeVisibility} />
          )
        }
      />

      <View>
        <TimeTable
          sessions={sessions}
          onPressEmptyCell={(day, period) => (editMode ? setEditMode(false) : setTarget({ day, period }))}
          onPressSession={(session) => setTarget({ day: session.day, period: session.period, session })}
          editMode={editMode}
          onLongPressSession={() => setEditMode(true)}
          onDeleteSession={deleteInEditMode}
          cellHeight={cellHeight}
          friendOverlaps={friendOverlaps}
        />
        {/* 初めての人は空の格子だけでは何をすればいいか分からない → 読み込み後に0件なら1行だけ重ねる。
            タップは下のマスに通す（box-none: 自分の子以外は素通し）。
            写真選択の部品があるアプリでは「スクショから読み込む」も出す（RELEASE-PLAN N1） */}
        {semesterKey in sessionsMap && placedSessions(sessions).length === 0 && (
          <View style={styles.emptyHint} pointerEvents="box-none">
            <View style={styles.emptyHintPill} pointerEvents="none">
              <Ionicons name="hand-left-outline" size={14} color={theme.textSecondary} />
              <Text style={styles.emptyHintText}>{t("home.emptyHint")}</Text>
            </View>
            {canReadTimetableImage && (
              <TouchableOpacity
                style={styles.ocrBtn}
                onPress={() => router.push(`/timetable-import?year=${selectedYear}&semester=${selectedSemester}`)}
                accessibilityRole="button"
              >
                <Ionicons name="image-outline" size={16} color="#fff" />
                <Text style={styles.ocrBtnText}>{t("home.ocrButton")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {undo && undo.key === semesterKey && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>
            {`「${undo.session.name}」${t("home.deletedSuffix")}`}
          </Text>
          <TouchableOpacity onPress={undoDelete} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.undoBtnText}>{t("home.undo")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 曜日・時限の無い授業（集中講義・オンデマンド・メディア）は表に置けないので、この欄に（I-8） */}
      <OtherSessionsRow
        sessions={otherSessions(sessions)}
        onPressSession={(session) => setTarget({ day: null, period: null, session })}
        onAdd={() => setTarget({ day: null, period: null })}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            router.push(`/course-search?year=${selectedYear}&semester=${selectedSemester}`)
          }
        >
          <Ionicons name="search-outline" size={15} color={theme.primary} />
          <Text style={styles.actionText} numberOfLines={1}>{t("courseSearch.entry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            router.push(`/timetable-wizard?year=${selectedYear}&semester=${selectedSemester}`)
          }
        >
          <Ionicons name="sparkles-outline" size={15} color={theme.primary} />
          <Text style={styles.actionText} numberOfLines={1}>{t("wizard.entry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push("/graduation")}
        >
          <Ionicons name="school-outline" size={15} color={theme.primary} />
          <Text style={styles.actionText} numberOfLines={1}>{t("grad.entry")}</Text>
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
    doneBtn: {
      backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
    },
    doneBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    // 時間割の上に重ねる（下の欄を押し下げない）
    undoBar: {
      position: "absolute", left: 12, right: 12, bottom: 0, zIndex: 10,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
      backgroundColor: "#2C2C2E", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    },
    undoText: { flex: 1, color: "#fff", fontSize: 13 },
    undoBtnText: { color: "#64D2FF", fontSize: 13, fontWeight: "800" },
    emptyHint: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyHintPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyHintText: { fontSize: 13, color: theme.textSecondary },
    ocrBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.primary,
    },
    ocrBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
    actionRow: {
      height: COURSE_SEARCH_ROW_H,
      flexDirection: "row",
      marginHorizontal: 12,
      marginVertical: 4,
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.primary,
    },
    actionText: { color: theme.primary, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  });
}
