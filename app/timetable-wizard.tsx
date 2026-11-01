import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import {
  departmentName,
  hasDepartmentData,
  matchDepartment,
  orderDepartments,
} from "../src/data/departments";
import { searchCourses } from "../src/services/courseService";
import { getTimetable, saveTimetableSessions } from "../src/services/timetableService";
import { getUserProfile } from "../src/services/userService";
import type { Course, Semester } from "../src/types/course";
import { getCurrentAcademicYear } from "../src/data/semesterTimetables";
import { DAYS, type ClassSession, type Period } from "../src/types/timetable";
import type { Theme } from "../src/theme/themes";
import {
  groupCourseUnits,
  courseUnitKey,
  generateTimetables,
  type CourseUnit,
  type WizardOutcome,
  type WizardResult,
} from "../src/utils/timetableWizard";

// ============================================================
// 時間割メーカー（自動作成 / 시간표 마법사）
// 受けたい講義を候補に集め、必須指定と目標単位範囲を決めると、時間の重ならない
// 時間割の組み合わせを自動生成する。プレビューからワンタップで時間割へ保存。
// firestore.rules / types の変更なし（courses を読み timetables に書くだけ）。
// ============================================================

const CREDIT_STEP = 2;

// 講義名から決定的に色を選ぶ（course-search と同じ方針で見た目を揃える）。
function colorFor(name: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}

// 組み合わせ（選ばれたユニット群）を ClassSession[] に展開する。週複数コマは各コマを1セッションに。
function resultToSessions(result: WizardResult, palette: string[]): ClassSession[] {
  const sessions: ClassSession[] = [];
  for (const u of result.units) {
    const color = colorFor(u.name, palette);
    for (const c of u.courses) {
      sessions.push({
        id: `${Date.now()}-${c.id}`,
        day: c.day,
        period: c.period,
        name: u.name,
        teacher: u.teacher,
        room: c.campus ?? "",
        color,
      });
    }
  }
  return sessions;
}

export default function TimetableWizardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ year?: string; semester?: string }>();
  const year = Number(params.year) || getCurrentAcademicYear();
  const semester: Semester = params.semester === "秋" ? "秋" : "春";
  const semesterKey = `${year}-${semester}`;

  // 講義データは学校別スコープ。schoolDomain は course-search と同じくプロフィール値を使う。
  const [schoolDomain, setSchoolDomain] = useState("meiji.ac.jp");
  const [myDeptRaw, setMyDeptRaw] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid)
      .then((p) => {
        if (p?.schoolDomain) setSchoolDomain(p.schoolDomain);
        if (p?.department) setMyDeptRaw(p.department);
      })
      .catch(() => {});
  }, [user]);

  // 学部は学校ごと（1.1 S2）。照合・並べ替えは departments.ts に寄せた。
  const myDept = useMemo(
    () => matchDepartment(schoolDomain, myDeptRaw),
    [schoolDomain, myDeptRaw]
  );
  const orderedDepartments = useMemo(
    () => orderDepartments(schoolDomain, myDept),
    [schoolDomain, myDept]
  );
  // 講義データが無い学校では学部チップを出さない。
  const deptReady = hasDepartmentData(schoolDomain);
  const [deptId, setDeptId] = useState<string | null>(null);
  useEffect(() => {
    if (myDept) setDeptId((cur) => cur ?? myDept.id);
  }, [myDept]);

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 候補プール（受けたい講義の候補）と、必須指定したユニット key。
  const [candidates, setCandidates] = useState<Course[]>([]);
  const [requiredKeys, setRequiredKeys] = useState<Set<string>>(new Set());

  const [minCredits, setMinCredits] = useState(12);
  const [maxCredits, setMaxCredits] = useState(20);

  const [outcome, setOutcome] = useState<WizardOutcome | null>(null);
  const [generating, setGenerating] = useState(false);

  // 保存確認モーダル
  const [applyTarget, setApplyTarget] = useState<WizardResult | null>(null);
  const [saving, setSaving] = useState(false);

  const units = useMemo(() => groupCourseUnits(candidates), [candidates]);
  const candidateIds = useMemo(() => new Set(candidates.map((c) => c.id)), [candidates]);

  async function handleSearch() {
    if (!deptId) {
      setNotice(t("courseSearch.selectDepartmentFirst"));
      return;
    }
    if (!keyword.trim()) return;
    Keyboard.dismiss();
    setNotice(null);
    setSearching(true);
    setSearched(true);
    try {
      const found = await searchCourses({ schoolDomain, deptId, keyword, year, semester });
      setResults(found);
    } catch (e) {
      console.warn("wizard search failed:", e);
      setResults([]);
      setNotice(t("common.error"));
    } finally {
      setSearching(false);
    }
  }

  function addCandidate(course: Course) {
    setCandidates((prev) => (prev.some((c) => c.id === course.id) ? prev : [...prev, course]));
  }

  function removeUnit(u: CourseUnit) {
    // キーで消す。同じ講義の同じ曜限が2件ある(別キャンパス開講など)と groupCourseUnits が
    // 2件目を u.courses に入れないため、id で消すと候補に残ってユニットが復活してしまう。
    setCandidates((prev) => prev.filter((c) => courseUnitKey(c) !== u.key));
    setRequiredKeys((prev) => {
      const next = new Set(prev);
      next.delete(u.key);
      return next;
    });
  }

  function toggleRequired(u: CourseUnit) {
    setRequiredKeys((prev) => {
      const next = new Set(prev);
      if (next.has(u.key)) next.delete(u.key);
      else next.add(u.key);
      return next;
    });
  }

  function stepCredit(which: "min" | "max", dir: 1 | -1) {
    if (which === "min") {
      setMinCredits((v) => Math.max(0, Math.min(maxCredits, v + dir * CREDIT_STEP)));
    } else {
      setMaxCredits((v) => Math.min(40, Math.max(minCredits, v + dir * CREDIT_STEP)));
    }
  }

  function handleGenerate() {
    if (units.length === 0) {
      setNotice(t("wizard.candidatesEmpty"));
      return;
    }
    setNotice(null);
    setGenerating(true);
    // 同期計算だが UI をブロックしないよう次フレームで実行。
    setTimeout(() => {
      const out = generateTimetables(units, {
        requiredKeys: [...requiredKeys],
        minCredits,
        maxCredits,
      });
      setOutcome(out);
      setGenerating(false);
    }, 0);
  }

  async function handleApply() {
    if (!user || !applyTarget) return;
    setSaving(true);
    try {
      const doc = await getTimetable(user.uid, semesterKey);
      const sessions = resultToSessions(applyTarget, theme.timetableCells);
      await saveTimetableSessions(user.uid, semesterKey, sessions, { initVisibility: doc === null });
      setApplyTarget(null);
      router.replace("/(tabs)"); // ホームで新しい時間割を確認
    } catch (e) {
      console.warn("wizard apply failed:", e);
      setNotice(t("common.saveFailed"));
      setApplyTarget(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wizard.title")}</Text>
        <Text style={styles.semesterBadge}>{`${year} ${semester}`}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        {/* 학부 선택 — 강의 데이터가 있는 학교에서만 */}
        <Text style={styles.sectionLabel}>{t("courseSearch.departmentLabel")}</Text>
        {!deptReady ? (
          <Text style={styles.deptEmpty}>{t("courseSearch.schoolNotReady")}</Text>
        ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.deptScroll}
          contentContainerStyle={styles.deptRow}
        >
          {orderedDepartments.map((dept) => {
            const selected = dept.id === deptId;
            return (
              <TouchableOpacity
                key={dept.id}
                style={[styles.deptChip, selected && styles.deptChipOn]}
                onPress={() => setDeptId(dept.id)}
              >
                <Text style={[styles.deptChipText, selected && styles.deptChipTextOn]}>
                  {departmentName(dept, language)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        )}

        {/* 검색 → 후보 담기 */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder={t("wizard.searchPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>{t("courseSearch.search")}</Text>
          </TouchableOpacity>
        </View>

        {notice && <Text style={styles.notice}>{notice}</Text>}

        {searching ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} />
        ) : results.length > 0 ? (
          <View style={styles.searchResults}>
            {results.map((c) => {
              const added = candidateIds.has(c.id);
              return (
                <View key={c.id} style={styles.resultRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{c.name}</Text>
                    <Text style={styles.courseMeta}>
                      {c.teacher} · {c.day}
                      {c.period}
                      {c.credits !== null ? ` · ${c.credits}${t("courseSearch.credits")}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, added && styles.addBtnDone]}
                    disabled={added}
                    onPress={() => addCandidate(c)}
                  >
                    <Text style={styles.addBtnText}>{added ? "✓" : t("wizard.addCandidate")}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : searched ? (
          <Text style={styles.hint}>{t("courseSearch.noResults")}</Text>
        ) : null}

        {/* 후보 강의 풀 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t("wizard.candidatesLabel")} ({units.length})
          </Text>
          <Text style={styles.requiredHint}>{t("wizard.requiredHint")}</Text>
        </View>
        {units.length === 0 ? (
          <Text style={styles.emptyPool}>{t("wizard.candidatesEmpty")}</Text>
        ) : (
          units.map((u) => {
            const isRequired = requiredKeys.has(u.key);
            const slotText = u.slots.map((s) => `${s.day}${s.period}`).join(" · ");
            return (
              <View key={u.key} style={styles.poolRow}>
                <TouchableOpacity
                  style={[styles.starBtn, isRequired && styles.starBtnOn]}
                  onPress={() => toggleRequired(u)}
                >
                  <Text style={[styles.starText, isRequired && styles.starTextOn]}>★</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{u.name}</Text>
                  <Text style={styles.courseMeta}>
                    {slotText}
                    {u.credits ? ` · ${u.credits}${t("courseSearch.credits")}` : ""}
                    {isRequired ? ` · ${t("wizard.required")}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeUnit(u)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* 목표 학점 범위 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t("wizard.creditRange")}</Text>
        </View>
        <View style={styles.creditRow}>
          <CreditStepper
            label={t("wizard.min")}
            value={minCredits}
            onDec={() => stepCredit("min", -1)}
            onInc={() => stepCredit("min", 1)}
            styles={styles}
          />
          <Text style={styles.creditTilde}>~</Text>
          <CreditStepper
            label={t("wizard.max")}
            value={maxCredits}
            onDec={() => stepCredit("max", -1)}
            onInc={() => stepCredit("max", 1)}
            styles={styles}
          />
        </View>

        {/* 생성 */}
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
          {generating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateText}>{t("wizard.generate")}</Text>
          )}
        </TouchableOpacity>

        {/* 결과 */}
        {outcome && (
          <View style={styles.resultsSection}>
            {outcome.requiredConflict ? (
              <Text style={styles.resultMsg}>{t("wizard.requiredConflict")}</Text>
            ) : outcome.results.length === 0 ? (
              <>
                <Text style={styles.resultMsg}>{t("wizard.noResults")}</Text>
                <Text style={styles.hint}>{t("wizard.noResultsHint")}</Text>
              </>
            ) : (
              <>
                <Text style={styles.resultCount}>
                  {outcome.results.length}
                  {t("wizard.resultsSuffix")}
                  {outcome.truncated ? ` · ${t("wizard.truncated")}` : ""}
                </Text>
                {outcome.results.map((r, idx) => (
                  <ResultCard
                    key={idx}
                    result={r}
                    theme={theme}
                    styles={styles}
                    onApply={() => setApplyTarget(r)}
                    creditsLabel={t("courseSearch.credits")}
                    gapsLabel={t("wizard.gaps")}
                    applyLabel={t("wizard.apply")}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* 저장 확인 모달 */}
      <Modal
        visible={applyTarget !== null}
        transparent
        animationType="none"
        onRequestClose={() => setApplyTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setApplyTarget(null)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("wizard.applyConfirmTitle")}</Text>
            <Text style={styles.modalBody}>
              {t("wizard.applyConfirmBody").replace("{semester}", `${year} ${semester}`)}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setApplyTarget(null)}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={handleApply} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalOkText}>{t("wizard.applyConfirmOk")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CreditStepper({
  label,
  value,
  onDec,
  onInc,
  styles,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepBtnText}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 結果カード: ミニ時間割グリッド + 単位/空きコマ + 講義名 + 保存ボタン。
function ResultCard({
  result,
  theme,
  styles,
  onApply,
  creditsLabel,
  gapsLabel,
  applyLabel,
}: {
  result: WizardResult;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
  onApply: () => void;
  creditsLabel: string;
  gapsLabel: string;
  applyLabel: string;
}) {
  // グリッド範囲: 使う最大時限（最低5）まで。
  let maxPeriod = 5;
  const cellMap = new Map<string, string>(); // "day-period" -> color
  for (const u of result.units) {
    const color = colorFor(u.name, theme.timetableCells);
    for (const s of u.slots) {
      cellMap.set(`${s.day}-${s.period}`, color);
      if (s.period > maxPeriod) maxPeriod = s.period;
    }
  }
  const periods = Array.from({ length: maxPeriod }, (_, i) => (i + 1) as Period);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardCredits}>
          {result.totalCredits}
          {creditsLabel}
        </Text>
        <Text style={styles.cardGaps}>
          {gapsLabel.replace("{n}", String(result.gapCount))}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
          <Text style={styles.applyBtnText}>{applyLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* 미니 그리드 */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={styles.gridCorner} />
          {DAYS.map((d) => (
            <View key={d} style={styles.gridHeadCell}>
              <Text style={styles.gridHeadText}>{d}</Text>
            </View>
          ))}
        </View>
        {periods.map((p) => (
          <View key={p} style={styles.gridRow}>
            <View style={styles.gridPeriodCell}>
              <Text style={styles.gridPeriodText}>{p}</Text>
            </View>
            {DAYS.map((d) => {
              const color = cellMap.get(`${d}-${p}`);
              return (
                <View
                  key={d}
                  style={[styles.gridCell, color ? { backgroundColor: color } : null]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* 강의명 목록 */}
      <View style={styles.chipList}>
        {result.units.map((u) => (
          <View key={u.key} style={styles.courseChip}>
            <View style={[styles.chipDot, { backgroundColor: colorFor(u.name, theme.timetableCells) }]} />
            <Text style={styles.chipText} numberOfLines={1}>
              {u.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 30, color: theme.primary, lineHeight: 32, width: 28 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    semesterBadge: { fontSize: 13, color: theme.textSecondary, width: 60, textAlign: "right" },

    sectionLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
    },
    deptScroll: { flexGrow: 0 },
    // 講義データ未投入の学校に出す案内（学部チップの代わり）
    deptEmpty: {
      fontSize: 13,
      color: theme.textSecondary,
      paddingHorizontal: 16,
      paddingBottom: 10,
      lineHeight: 19,
    },
    deptRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 4, alignItems: "center" },
    deptChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    deptChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    deptChipText: { fontSize: 13, color: theme.textPrimary },
    deptChipTextOn: { color: "#FFFFFF", fontWeight: "600" },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    input: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.textPrimary,
    },
    searchBtn: {
      height: 40,
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.primary,
    },
    searchBtnText: { color: "#FFFFFF", fontWeight: "600" },
    notice: { fontSize: 13, color: theme.primary, paddingHorizontal: 16, paddingBottom: 8 },

    searchResults: { borderTopWidth: 1, borderColor: theme.border },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    courseName: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    courseMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
    addBtn: {
      minWidth: 72,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: theme.primary,
      paddingHorizontal: 10,
    },
    addBtnDone: { backgroundColor: theme.textSecondary },
    addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
    hint: { color: theme.textSecondary, fontSize: 12, textAlign: "center", paddingVertical: 12, paddingHorizontal: 24 },

    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 8,
    },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    requiredHint: { fontSize: 12, color: theme.textSecondary },
    emptyPool: {
      fontSize: 13,
      color: theme.textSecondary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      textAlign: "center",
    },
    poolRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    starBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    starBtnOn: { backgroundColor: theme.primary + "1A", borderColor: theme.primary },
    starText: { fontSize: 16, color: theme.textSecondary },
    starTextOn: { color: theme.primary },
    removeBtn: { width: 28, alignItems: "center", justifyContent: "center" },
    removeText: { fontSize: 22, color: theme.textSecondary, lineHeight: 24 },

    creditRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 16,
      paddingHorizontal: 16,
    },
    stepper: { alignItems: "center", gap: 6 },
    stepperLabel: { fontSize: 12, color: theme.textSecondary },
    stepperControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stepBtnText: { fontSize: 18, color: theme.primary, fontWeight: "700" },
    stepValue: { fontSize: 20, fontWeight: "700", color: theme.textPrimary, minWidth: 32, textAlign: "center" },
    creditTilde: { fontSize: 18, color: theme.textSecondary, paddingBottom: 8 },

    generateBtn: {
      marginHorizontal: 16,
      marginTop: 24,
      height: 48,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    generateText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

    resultsSection: { paddingTop: 8 },
    resultMsg: { fontSize: 14, color: theme.textPrimary, textAlign: "center", paddingTop: 16, paddingHorizontal: 24 },
    resultCount: { fontSize: 12, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },

    card: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    cardCredits: { fontSize: 15, fontWeight: "700", color: theme.primary },
    cardGaps: { fontSize: 12, color: theme.textSecondary },
    applyBtn: {
      paddingHorizontal: 14,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    applyBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

    grid: { borderWidth: 1, borderColor: theme.border, borderRadius: 6, overflow: "hidden" },
    gridRow: { flexDirection: "row" },
    gridCorner: { width: 22, height: 20, backgroundColor: theme.background },
    gridHeadCell: {
      flex: 1,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      borderLeftWidth: 1,
      borderColor: theme.border,
    },
    gridHeadText: { fontSize: 10, color: theme.textSecondary },
    gridPeriodCell: {
      width: 22,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    gridPeriodText: { fontSize: 10, color: theme.textSecondary },
    gridCell: {
      flex: 1,
      height: 24,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      borderColor: theme.border,
    },

    chipList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    courseChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: "48%",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.background,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { fontSize: 12, color: theme.textPrimary, flexShrink: 1 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
    modalBox: { width: "84%", maxWidth: 340, backgroundColor: theme.card, borderRadius: 14, padding: 20 },
    modalTitle: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 8 },
    modalBody: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 18 },
    modalActions: { flexDirection: "row", gap: 10 },
    modalCancel: {
      flex: 1,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalCancelText: { fontSize: 15, color: theme.textPrimary, fontWeight: "600" },
    modalOk: {
      flex: 1,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    modalOkText: { fontSize: 15, color: "#FFFFFF", fontWeight: "700" },
  });
}
