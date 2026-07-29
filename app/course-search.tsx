import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import { DEPARTMENTS, departmentName } from "../src/data/departments";
import {
  searchCourses,
  contributeCourse,
  confirmCourse,
  fetchConfirmState,
  CROWD_CONFIRM_THRESHOLD,
  type ConfirmState,
} from "../src/services/courseService";
import { getTimetable, saveTimetableSessions } from "../src/services/timetableService";
import { getUserProfile } from "../src/services/userService";
import type { Course, Semester } from "../src/types/course";
import { DAYS, PERIODS, type ClassSession, type Day, type Period } from "../src/types/timetable";
import type { Theme } from "../src/theme/themes";
import ReviewModal from "../src/components/course/ReviewModal";

// ============================================================
// 講義検索 → 時間割にワンタップ追加（Phase 1c / 10月3週）
// - 学部を選び、講義名・教員名で検索し、結果をタップすると時間割に入る。
// - 対象学期は呼び出し元（ホーム）から year / semester で受け取る。
// - 講義データ未投入の間は courseService がモックを返す（画面側は同じ形なので変更不要）。
// - 見つからない講義は従来どおり時間割のマスを直接タップして手入力する（フォールバック）。
// ============================================================

// 同じ講義が毎回同じ色になるよう、講義名から決定的に色を選ぶ。
function colorFor(name: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}

function courseToSession(course: Course, palette: string[]): ClassSession {
  return {
    id: `${Date.now()}-${course.id}`,
    day: course.day,
    period: course.period,
    name: course.name,
    teacher: course.teacher,
    room: course.campus ?? "",
    color: colorFor(course.name, palette),
  };
}

export default function CourseSearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();

  // 講義データは学校別スコープ(schools/{schoolDomain}/...)で適載されている。
  // AuthContext.schoolDomain は暫定で "global" 固定のため、ここではユーザーの
  // 実際の所属校(users.schoolDomain、オンボーディングで保存)を使う。
  // 未設定(「その他」選択)なら現状の対応校 meiji.ac.jp にフォールバック。
  // TODO(app全体): schoolDomain の "global" 固定を解消し、掲示板含め実校スコープへ統一。
  const [schoolDomain, setSchoolDomain] = useState("meiji.ac.jp");
  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid)
      .then((p) => { if (p?.schoolDomain) setSchoolDomain(p.schoolDomain); })
      .catch(() => {});
  }, [user]);
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ year?: string; semester?: string }>();
  const year = Number(params.year) || new Date().getFullYear();
  const semester: Semester = params.semester === "秋" ? "秋" : "春";
  const semesterKey = `${year}-${semester}`;

  const [deptId, setDeptId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // 追加済みの講義ID（ボタン表示の切り替え用）と、追加処理中のID
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // クラウドソーシング: 未確認(verified:false)講義の確認状態と、講義登録モーダル
  const [confirmMap, setConfirmMap] = useState<Record<string, ConfirmState>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regTeacher, setRegTeacher] = useState("");
  const [regDay, setRegDay] = useState<Day>("月");
  const [regPeriod, setRegPeriod] = useState<Period>(1);
  const [registering, setRegistering] = useState(false);
  const [reviewCourse, setReviewCourse] = useState<Course | null>(null); // レビューモーダル対象

  // keyword state を使わず引数で検索できる版（登録直後の即時再検索に使う）
  async function runSearch(kw: string) {
    if (!deptId) {
      setNotice(t("courseSearch.selectDepartmentFirst"));
      return;
    }
    if (!kw.trim()) return;
    Keyboard.dismiss();
    setNotice(null);
    setLoading(true);
    setSearched(true);
    try {
      const found = await searchCourses({ schoolDomain, deptId, keyword: kw, year, semester });
      setResults(found);
      // 未確認講義の確認状態をまとめてロード（公式=verified:true はスキップ）
      const unverified = found.filter((c) => !c.verified);
      if (unverified.length && user) {
        const entries = await Promise.all(
          unverified.map(async (c) => {
            const st = await fetchConfirmState(schoolDomain, deptId, c.id, user.uid).catch(() => null);
            return [c.id, st] as const;
          })
        );
        setConfirmMap((prev) => {
          const next = { ...prev };
          entries.forEach(([id, st]) => { if (st) next[id] = st; });
          return next;
        });
      }
    } catch (e) {
      console.warn("course search failed:", e);
      setResults([]);
      setNotice(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => runSearch(keyword);

  // 実在確認（1人1回。confirms サブコレクションに create）
  async function handleConfirm(course: Course) {
    if (!user || confirmingId) return;
    setConfirmingId(course.id);
    try {
      await confirmCourse(schoolDomain, deptId!, course.id, user.uid);
      const st = await fetchConfirmState(schoolDomain, deptId!, course.id, user.uid);
      setConfirmMap((prev) => ({ ...prev, [course.id]: st }));
    } catch (e) {
      console.warn("confirm failed:", e);
      setNotice(t("courseSearch.confirmFailed"));
    } finally {
      setConfirmingId(null);
    }
  }

  // 講義登録（公式クロールに無い講義を verified:false で追加）
  async function handleRegister() {
    if (!deptId || !user) return;
    const name = keyword.trim();
    if (!name) { setNotice(t("courseSearch.registerNameRequired")); return; }
    setRegistering(true);
    try {
      await contributeCourse(
        { schoolDomain, deptId, year, semester, uid: user.uid },
        { name, teacher: regTeacher.trim(), day: regDay, period: regPeriod }
      );
      setRegisterOpen(false);
      setRegTeacher("");
      setNotice(t("courseSearch.registerDone"));
      await runSearch(name); // 登録した講義が結果に出るよう再検索
    } catch (e) {
      console.warn("contribute failed:", e);
      setNotice(t("courseSearch.registerFailed"));
    } finally {
      setRegistering(false);
    }
  }

  // 時間割ドキュメントを読み → 重複チェック → 追記保存。
  // ホーム画面の state は触らず Firestore を正とする（ホームは復帰時に読み直す）。
  // 講義名タップで詳細画面へ（Phase 2 4週目）。学期は検索対象と同じものを渡す。
  function openDetail(course: Course) {
    if (!deptId) return;
    router.push(
      `/course-detail?schoolDomain=${encodeURIComponent(schoolDomain)}&deptId=${encodeURIComponent(deptId)}` +
      `&courseId=${encodeURIComponent(course.id)}&year=${year}&semester=${semester}`
    );
  }

  async function handleAdd(course: Course) {
    if (!user || addingId) return;
    setAddingId(course.id);
    setNotice(null);
    try {
      const doc = await getTimetable(user.uid, semesterKey);
      const current = doc?.sessions ?? [];
      if (current.some((s) => s.day === course.day && s.period === course.period)) {
        setNotice(t("courseSearch.occupied"));
        return;
      }
      const next = [...current, courseToSession(course, theme.timetableCells)];
      await saveTimetableSessions(user.uid, semesterKey, next, { initVisibility: doc === null });
      setAddedIds((prev) => new Set(prev).add(course.id));
      setNotice(t("courseSearch.added"));
    } catch (e) {
      console.warn("course add failed:", e);
      setNotice(t("common.saveFailed"));
    } finally {
      setAddingId(null);
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
        <Text style={styles.headerTitle}>{t("courseSearch.title")}</Text>
        <Text style={styles.semesterBadge}>{`${year} ${semester}`}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t("courseSearch.departmentLabel")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.deptScroll}
        contentContainerStyle={styles.deptRow}
      >
        {DEPARTMENTS.map((dept) => {
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

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder={t("courseSearch.keywordPlaceholder")}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            searched ? (
              <View style={styles.center}>
                <Text style={styles.empty}>{t("courseSearch.noResults")}</Text>
                <Text style={styles.hint}>{t("courseSearch.manualHint")}</Text>
                {deptId && keyword.trim() ? (
                  <TouchableOpacity style={styles.registerCta} onPress={() => setRegisterOpen(true)}>
                    <Text style={styles.registerCtaText}>{t("courseSearch.registerCta")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const added = addedIds.has(item.id);
            const cs = item.verified ? null : confirmMap[item.id];
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity activeOpacity={0.6} onPress={() => openDetail(item)}>
                  <View style={styles.nameRow}>
                    <Text style={styles.courseName}>{item.name}</Text>
                    {item.verified ? (
                      <Text style={styles.badgeOfficial}>{t("courseSearch.official")}</Text>
                    ) : cs?.verifiedByCrowd ? (
                      <Text style={styles.badgeCrowd}>{t("courseSearch.crowdVerified")}</Text>
                    ) : (
                      <Text style={styles.badgeUnverified}>{t("courseSearch.unverified")}</Text>
                    )}
                  </View>
                  <Text style={styles.courseMeta}>
                    {item.teacher} · {item.day}
                    {item.period}
                    {item.campus ? ` · ${item.campus}` : ""}
                    {item.credits !== null ? ` · ${item.credits}${t("courseSearch.credits")}` : ""}
                  </Text>
                  </TouchableOpacity>
                  {/* 未確認講義: 確認数 + 確認ボタン（自分が未確認のときだけ押せる） */}
                  {!item.verified && (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmCount}>
                        {(cs?.count ?? 0)}{t("courseSearch.confirmSuffix")}
                      </Text>
                      {cs?.mine ? (
                        <Text style={styles.confirmedMine}>✓ {t("courseSearch.confirmedMine")}</Text>
                      ) : (
                        <TouchableOpacity
                          style={styles.confirmBtn}
                          disabled={confirmingId !== null}
                          onPress={() => handleConfirm(item)}
                        >
                          {confirmingId === item.id ? (
                            <ActivityIndicator size="small" color={theme.primary} />
                          ) : (
                            <Text style={styles.confirmBtnText}>{t("courseSearch.confirmButton")}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity style={styles.reviewBtn} onPress={() => setReviewCourse(item)}>
                    <Text style={styles.reviewBtnText}>★ {t("review.short")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addBtn, added && styles.addBtnDone]}
                    disabled={added || addingId !== null}
                    onPress={() => handleAdd(item)}
                  >
                    {addingId === item.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.addBtnText}>
                        {added ? "✓" : t("courseSearch.add")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* 講義登録モーダル（公式に無い講義を verified:false で登録） */}
      <Modal visible={registerOpen} transparent animationType="fade" onRequestClose={() => setRegisterOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRegisterOpen(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("courseSearch.registerTitle")}</Text>
            <Text style={styles.modalName}>{keyword.trim()}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("courseSearch.registerTeacherPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={regTeacher}
              onChangeText={setRegTeacher}
            />
            <Text style={styles.modalLabel}>{t("courseSearch.registerDayLabel")}</Text>
            <View style={styles.chipWrap}>
              {DAYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pickChip, regDay === d && styles.pickChipOn]}
                  onPress={() => setRegDay(d)}
                >
                  <Text style={[styles.pickChipText, regDay === d && styles.pickChipTextOn]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>{t("courseSearch.registerPeriodLabel")}</Text>
            <View style={styles.chipWrap}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pickChip, regPeriod === p && styles.pickChipOn]}
                  onPress={() => setRegPeriod(p)}
                >
                  <Text style={[styles.pickChipText, regPeriod === p && styles.pickChipTextOn]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.modalSubmit, registering && styles.addBtnDone]}
              disabled={registering}
              onPress={handleRegister}
            >
              {registering ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitText}>{t("courseSearch.registerSubmit")}</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 講義レビュー モーダル（Phase 2 3週目） */}
      <ReviewModal
        visible={reviewCourse !== null}
        loc={reviewCourse ? { schoolDomain, deptId: deptId ?? "", courseId: reviewCourse.id } : null}
        courseName={reviewCourse?.name ?? ""}
        year={year}
        semester={semester}
        uid={user?.uid ?? null}
        onClose={() => setReviewCourse(null)}
      />
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
    mockBanner: {
      backgroundColor: theme.accent,
      paddingVertical: 6,
      paddingHorizontal: 16,
    },
    mockBannerText: { color: "#FFFFFF", fontSize: 12, textAlign: "center" },
    sectionLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
    },
    // flexGrow:0 がないと横スクロールビューが縦方向の余白を全部吸って
    // チップが縦に引き伸ばされる（列レイアウト内の ScrollView の既定挙動）
    deptScroll: { flexGrow: 0 },
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
    notice: {
      fontSize: 13,
      color: theme.primary,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    sep: { height: 1, backgroundColor: theme.border },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    courseName: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    courseMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
    addBtn: {
      minWidth: 88,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: theme.primary,
    },
    addBtnDone: { backgroundColor: theme.textSecondary },
    addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
    rowActions: { gap: 6, alignItems: "stretch" },
    reviewBtn: {
      minWidth: 88,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    reviewBtnText: { color: theme.primary, fontSize: 12.5, fontWeight: "600" },
    center: { alignItems: "center", paddingTop: 40, paddingHorizontal: 24, gap: 8 },
    empty: { color: theme.textSecondary, fontSize: 14 },
    hint: { color: theme.textSecondary, fontSize: 12, textAlign: "center" },

    // 배지 + 확인
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    badgeOfficial: {
      fontSize: 10, fontWeight: "700", color: theme.primary,
      backgroundColor: theme.primary + "1A", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
    },
    badgeUnverified: {
      fontSize: 10, fontWeight: "700", color: theme.textSecondary,
      backgroundColor: theme.border, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
    },
    badgeCrowd: {
      fontSize: 10, fontWeight: "700", color: "#2FA84F",
      backgroundColor: "#2FA84F1A", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
    },
    confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    confirmCount: { fontSize: 12, color: theme.textSecondary },
    confirmedMine: { fontSize: 12, color: "#2FA84F", fontWeight: "600" },
    confirmBtn: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
      borderWidth: 1, borderColor: theme.primary,
    },
    confirmBtnText: { fontSize: 12, color: theme.primary, fontWeight: "600" },

    // 등록 CTA + 모달
    registerCta: {
      marginTop: 12, paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 8, backgroundColor: theme.primary,
    },
    registerCtaText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    modalOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center",
    },
    modalBox: {
      width: "86%", maxWidth: 360, backgroundColor: theme.card, borderRadius: 14,
      padding: 20,
    },
    modalTitle: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 4 },
    modalName: { fontSize: 15, fontWeight: "600", color: theme.primary, marginBottom: 14 },
    modalInput: {
      height: 40, borderRadius: 8, paddingHorizontal: 12, color: theme.textPrimary,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    modalLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 14, marginBottom: 6 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pickChip: {
      minWidth: 34, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
      alignItems: "center", backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    pickChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    pickChipText: { fontSize: 13, color: theme.textPrimary },
    pickChipTextOn: { color: "#FFFFFF", fontWeight: "700" },
    modalSubmit: {
      marginTop: 20, height: 44, borderRadius: 8, backgroundColor: theme.primary,
      alignItems: "center", justifyContent: "center",
    },
    modalSubmitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  });
}
