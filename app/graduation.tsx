import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import { useAuth } from "../src/contexts/AuthContext";
import { getUserProfile } from "../src/services/userService";
import type { Theme } from "../src/theme/themes";
import { GRAD_MASTERS, type GradMaster } from "../src/data/graduationMaster";
import { COURSES_2021, YEAR3_ONLY } from "../src/data/graduationCourses2021";
import { classifySubject, type CourseId } from "../src/data/gradAllocationMeijiCommerce";
import { calcGrad, diffZones, GRAD_SUB_MINS, type GradRecord, type RecordStatus } from "../src/utils/gradCalc";
import {
  loadGradState, saveGradState, loadTimetableSubjects, type TimetableSubject,
} from "../src/services/gradRecordService";
import { GradRecords, type Classified } from "../src/components/graduation/GradRecords";
import { ENROLLMENT_YEAR } from "../src/data/semesterTimetables";

const MET_COLOR = "#1F9D6B";
const GRADES = [1, 2, 3, 4];
const MEIJI_DOMAIN = "meiji.ac.jp";

// 対応状況の判定。マスターは (学部×入学年度) 単位で、現状は明治 商学部のみ整備済み。
// 学部は自由記述のため「商/商学/commerce」を含むか＋空(未設定)は許容でファジー判定。
// 通信失敗など不明時は fail-open（=対応扱い）で唯一動く画面を誤ってロックしない。
type Coverage = "supported" | "school" | "faculty" | "noschool";
function looksCommerce(dept: string | null): boolean {
  if (!dept || !dept.trim()) return true; // 未設定は許容（scopeラベルで明示済み）
  return /商学|商學|상학|commerce/i.test(dept);
}
function coverageOf(schoolDomain: string | null, dept: string | null): Coverage {
  if (schoolDomain == null) return "noschool";
  if (schoolDomain !== MEIJI_DOMAIN) return "school";
  return looksCommerce(dept) ? "supported" : "faculty";
}

// 卒業要件マジシャン（お試し版）。
// 便覧の区分別最低単位マスター × 修得記録（科目ごとに 取得/不可/履修中）で区分別の充足を集計。
// 記録は ①時間割の科目を候補に出して選ぶ ②成績表を見て手動追加 の両方。配当表で区分を自動判定。
// 記録していない過去分は、区分別の ＋/− で成績表の合計を直接入力できる。
// 保存は端末ローカルのみ（gradRecordService）。本格版の E2E 金庫は Phase 3（docs/CREDIT-TRACKING.md §6-2）。
export default function GraduationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [masterIdx, setMasterIdx] = useState(0);
  const master: GradMaster = GRAD_MASTERS[masterIdx];

  // 成績表の区分別合計（記録していない過去分の手動入力）。マスター切替時も同じidは引き継ぐ。
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  // 修得記録（科目ごと）
  const [records, setRecords] = useState<GradRecord[]>([]);
  // どの保存キー(uid/guest)の読み込みが完了したか。uid切替直後に旧uidの記録を新uidへ保存しないためのガード。
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [delta, setDelta] = useState<string | null>(null);

  // 自コース（基幹科目の自/他判定）+ CAN(履修できる科目) 用の現在学年。
  const [grade, setGrade] = useState(3);
  const [courseId, setCourseId] = useState<CourseId | null>(null);
  const selectedCourse = COURSES_2021.find((c) => c.id === courseId) ?? null;
  const gradeLocked = grade < 3; // 基幹科目は3・4年配当

  // 対応状況ゲーティング（明治 商学部のみ整備済み）。
  const { user, schoolDomain, schoolReady } = useAuth();
  const [dept, setDept] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [override, setOverride] = useState(false); // 「参考として見る」で解除
  const [admissionYear, setAdmissionYear] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setProfileReady(true); return; }
    let alive = true;
    getUserProfile(user.uid)
      .then((p) => {
        if (!alive) return;
        setDept(p?.department ?? null);
        setAdmissionYear(p?.admissionYear ?? null);
        // 入学年度が分かればマスターと学年を自動プリセット（利便性）。
        if (p?.admissionYear != null) {
          setMasterIdx(p.admissionYear <= 2022 ? 0 : 1);
          const g = new Date().getFullYear() - p.admissionYear + 1;
          setGrade(Math.min(4, Math.max(1, g)));
        }
      })
      .catch(() => {}) // 通信失敗は fail-open
      .finally(() => { if (alive) setProfileReady(true); });
    return () => { alive = false; };
  }, [user]);

  // 端末に保存した記録の読み込み（uid ごと。未ログインは guest）
  const uid = user?.uid ?? null;
  const storeKey = uid ?? "guest";
  useEffect(() => {
    let alive = true;
    loadGradState(uid).then((st) => {
      if (!alive) return;
      setRecords(st.records);
      setBaseline(st.baseline);
      setCourseId(st.courseId);
      setDelta(null);
      setLoadedKey(storeKey);
    });
    return () => { alive = false; };
  }, [uid, storeKey]);

  // 変更のたびに保存。現在のキーの読み込み完了前は保存しない（空や別uidの記録で上書きしない）。
  useEffect(() => {
    if (loadedKey !== storeKey) return;
    saveGradState(uid, { version: 1, records, baseline, courseId });
  }, [loadedKey, storeKey, uid, records, baseline, courseId]);

  // 時間割の科目を候補として読む（入学年度〜今学期）
  const [ttSubjects, setTtSubjects] = useState<TimetableSubject[]>([]);
  const [ttState, setTtState] = useState<"loading" | "ready" | "none">("loading");
  useEffect(() => {
    if (!user || !profileReady) { if (profileReady) setTtState("none"); return; }
    let alive = true;
    setTtState("loading");
    loadTimetableSubjects(user.uid, admissionYear ?? ENROLLMENT_YEAR)
      .then((list) => { if (alive) { setTtSubjects(list); setTtState("ready"); } })
      .catch(() => { if (alive) setTtState("none"); });
    return () => { alive = false; };
  }, [user, profileReady, admissionYear]);

  const coverage = coverageOf(schoolDomain, dept);
  // profileReady/schoolReady 前や通信不明時は fail-open（=ブロックしない）。
  const blocked = profileReady && schoolReady && coverage !== "supported" && !override;

  function step(zoneId: string, d: number) {
    setBaseline((prev) => {
      const next = Math.max(0, (prev[zoneId] ?? 0) + d);
      return { ...prev, [zoneId]: next };
    });
  }

  // 配当表（科目→区分）は 2022年度以前入学者カリキュラムのみ整備済み。
  // 2023年度以降はまだ無いので、区分は利用者が選ぶ（自動判定しない）。
  const allocationReady = master.key === "pre2023";
  const classify = useCallback(
    (name: string): Classified | null => {
      if (!allocationReady) return null;
      const c = classifySubject(name, courseId);
      return c && c.zone ? { zone: c.zone, units: c.units } : null;
    },
    [allocationReady, courseId],
  );

  const calc = calcGrad(master, baseline, records, courseId, false);
  const projected = calcGrad(master, baseline, records, courseId, true);

  // 区分ごとの判定（不足分 diff・充足 met）。acq = 区分に算入された単位（超過分はフリーゾーンへ）。
  const zoneRows = master.zones.map((z) => {
    const zc = calc.zones[z.id];
    const acq = zc?.counted ?? 0;
    const diff = Math.max(0, z.minUnits - acq);
    return {
      zone: z, acq, diff, met: zc?.met ?? false, overflow: zc?.overflow ?? 0,
      planned: (projected.zones[z.id]?.counted ?? 0) - acq,
      subShort: zc?.subShort ?? false, subUnverified: zc?.subUnverified ?? false,
    };
  });

  const shortRows = zoneRows.filter((r) => !r.met).sort((a, b) => b.diff - a.diff);
  const unverifiedCount = zoneRows.filter((r) => r.subUnverified).length;
  const totalAcquired = calc.total;
  const remaining = Math.max(0, master.totalRequired - totalAcquired);
  const pct = Math.min(100, Math.round((totalAcquired / master.totalRequired) * 100));
  const projPct = Math.min(100, Math.round((projected.total / master.totalRequired) * 100));

  // 記録の追加・状態変更 → どの区分に何単位入ったかを表示
  const zoneLabel = (id: string) => master.zones.find((z) => z.id === id)?.nameJa ?? id;
  function applyRecords(next: GradRecord[], subject: string, status: RecordStatus) {
    const before = calcGrad(master, baseline, records, courseId, false);
    const after = calcGrad(master, baseline, next, courseId, false);
    const ds = diffZones(before, after);
    setRecords(next);
    if (status === "inProgress") {
      setDelta(`⏳ ${subject}：${t("grad.rec.deltaPlanned")}`);
    } else if (ds.length === 0) {
      setDelta(status === "failed" ? `❌ ${subject}：${t("grad.rec.deltaNone")}` : `✅ ${subject}：${t("grad.rec.deltaNoChange")}`);
    } else {
      const parts = ds.map((d) => {
        const sign = d.after > d.before ? "+" : "";
        const met = d.after >= d.min ? ` ${t("grad.met")}✅` : "";
        return `${zoneLabel(d.zoneId)} ${sign}${d.after - d.before}（${d.before}→${d.after}/${d.min}${met}）`;
      });
      setDelta(`${status === "passed" ? "✅" : "❌"} ${subject} → ${parts.join(" / ")}`);
    }
  }
  function addRecord(r: Omit<GradRecord, "id" | "createdAt">) {
    const rec: GradRecord = { ...r, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() };
    applyRecords([...records, rec], r.name, r.status);
  }
  function setRecordStatus(id: string, status: RecordStatus) {
    const target = records.find((r) => r.id === id);
    if (!target || target.status === status) return;
    applyRecords(records.map((r) => (r.id === id ? { ...r, status } : r)), target.name, status);
  }
  function deleteRecord(id: string) {
    const target = records.find((r) => r.id === id);
    setRecords(records.filter((r) => r.id !== id));
    if (target) setDelta(`🗑 ${target.name}：${t("grad.rec.deltaDeleted")}`);
  }

  // 時間割の候補のうち、まだ記録していないもの（同じ学期・同じ科目名で判定）
  const recordedKeys = new Set(records.map((r) => `${r.name}|${r.semesterKey ?? ""}`));
  const suggestions = ttSubjects.filter((s) => !recordedKeys.has(`${s.name}|${s.semesterKey}`));

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("grad.title")}</Text>
          <Text style={styles.subtitle}>{t("grad.scope")}</Text>
        </View>
        <View style={styles.expBadge}><Text style={styles.expBadgeText}>{t("grad.experiment")}</Text></View>
      </View>

      {blocked ? (
        <View style={styles.content}>
          <View style={styles.soonCard}>
            <Text style={styles.soonIcon}>🛠️</Text>
            <Text style={styles.soonTitle}>{t("grad.soonTitle")}</Text>
            <Text style={styles.soonBody}>
              {coverage === "noschool"
                ? t("grad.soonNoSchool")
                : coverage === "school"
                ? t("grad.soonSchool")
                : t("grad.soonFaculty")}
            </Text>
            <View style={styles.soonSupported}>
              <Text style={styles.soonSupportedText}>{t("grad.soonSupported")}</Text>
            </View>
            <Text style={styles.soonNote}>{t("grad.soonNote")}</Text>
            <TouchableOpacity style={styles.soonBrowse} onPress={() => setOverride(true)}>
              <Text style={styles.soonBrowseText}>{t("grad.soonBrowse")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.content}>
        {/* 入学年度（マスター選択） */}
        <Text style={styles.sectionLabel}>{t("grad.masterLabel")}</Text>
        <View style={styles.seg}>
          {GRAD_MASTERS.map((m, i) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.segBtn, masterIdx === i && styles.segBtnOn]}
              onPress={() => setMasterIdx(i)}
            >
              <Text style={[styles.segText, masterIdx === i && styles.segTextOn]}>{m.labelJa}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 自コース（基幹科目の自/他判定・CAN候補に使う） */}
        <Text style={styles.miniLabel}>{t("grad.courseLabel")}</Text>
        <View style={styles.chipWrap}>
          {COURSES_2021.map((c) => {
            const on = c.id === courseId;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.courseChip, on && styles.courseChipOn]}
                onPress={() => setCourseId(on ? null : (c.id as CourseId))}
              >
                <Text style={[styles.courseChipText, on && styles.courseChipTextOn]}>{c.nameJa}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* サマリー */}
        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryLabel}>{t("grad.summaryLabel")}</Text>
            <Text style={styles.summaryNum}>
              <Text style={styles.summaryBig}>{totalAcquired}</Text> / {master.totalRequired} {t("grad.unit")}
            </Text>
          </View>
          <View style={styles.summaryBar}>
            <View style={[styles.summaryBarPlan, { width: `${projPct}%` }]} />
            <View style={[styles.summaryBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.summaryHint}>
            {t("grad.remaining")}: {remaining} {t("grad.unit")} · {t("grad.short")}: {shortRows.length}/{master.zones.length}
          </Text>
          {projected.total > totalAcquired ? (
            <Text style={styles.summaryPlan}>
              ⏳ {t("grad.rec.projected")}: {projected.total} / {master.totalRequired} {t("grad.unit")}
            </Text>
          ) : null}
        </View>

        {/* 不足している区分（最重要ビュー） */}
        {shortRows.length === 0 ? (
          <View style={styles.allMet}>
            <Text style={styles.allMetText}>{t("grad.allMet")}</Text>
            {unverifiedCount > 0 ? <Text style={styles.allMetNote}>{t("grad.rec.allMetUnverified")}</Text> : null}
          </View>
        ) : (
          <View style={styles.shortCard}>
            <Text style={styles.shortHeading}>
              {t("grad.shortHeading")} · {shortRows.length}
            </Text>
            <Text style={styles.shortIntro}>{t("grad.shortIntro")}</Text>
            {shortRows.map((r) => (
              <View key={r.zone.id} style={styles.shortItem}>
                <View style={styles.shortItemTop}>
                  <Text style={styles.shortName}>{r.zone.nameJa}</Text>
                  <View style={styles.shortBadge}>
                    <Text style={styles.shortBadgeText}>
                      {r.diff > 0 ? `${t("grad.shortByPrefix")} ${r.diff} ${t("grad.unit")}` : t("grad.rec.subShortBadge")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.shortNum}>
                  {r.acq} / {r.zone.minUnits} {t("grad.unit")}
                </Text>
                {r.subShort ? (
                  <Text style={styles.shortHint}>
                    {r.zone.id === "sogo"
                      ? `${t("grad.rec.subBunka")} ${calc.sogoSubs.bunka}/4 · ${t("grad.rec.subChiiki")} ${calc.sogoSubs.chiiki}/4 · ${t("grad.rec.subNingen")} ${calc.sogoSubs.ningen}/4`
                      : `${t("grad.rec.ownCourse")} ${calc.ownCourse ?? 0}/${GRAD_SUB_MINS.ownCourse} · ${t("grad.rec.gaisen")} ${calc.gaisen}/${GRAD_SUB_MINS.gaisen}`}
                  </Text>
                ) : null}
                {r.zone.hintJa ? <Text style={styles.shortHint}>{r.zone.hintJa}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* 修得記録（時間割候補・手動追加・一覧） */}
        {!allocationReady ? (
          <View style={styles.allocNote}>
            <Text style={styles.allocNoteText}>{t("grad.rec.noAllocation")}</Text>
          </View>
        ) : null}
        <GradRecords
          theme={theme}
          t={t}
          master={master}
          records={records}
          suggestions={suggestions}
          timetableState={ttState}
          classify={classify}
          delta={delta}
          onAdd={addRecord}
          onStatus={setRecordStatus}
          onDelete={deleteRecord}
        />

        {/* 区分別ゲージ（記録していない過去分は ＋/− で成績表の合計を入力） */}
        <Text style={styles.inputHeading}>{t("grad.inputHeading")}</Text>
        <Text style={styles.stepHint}>{t("grad.stepHint")}</Text>
        {zoneRows.map((r) => {
          const z = r.zone;
          const w = Math.min(100, Math.round((r.acq / z.minUnits) * 100));
          return (
            <View key={z.id} style={styles.zone}>
              <View style={styles.zoneTop}>
                <Text style={styles.zoneName}>{z.nameJa}</Text>
                <View style={[styles.chip, r.met ? styles.chipOk : styles.chipShort]}>
                  <Text style={[styles.chipText, r.met ? styles.chipTextOk : styles.chipTextShort]}>
                    {r.met ? t("grad.met") : t("grad.short")}
                  </Text>
                </View>
              </View>
              <View style={styles.zoneBar}>
                {r.planned > 0 ? (
                  <View
                    style={[
                      styles.zoneBarPlan,
                      { width: `${Math.min(100, Math.round(((r.acq + r.planned) / z.minUnits) * 100))}%` },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.zoneBarFill,
                    { width: `${w}%`, backgroundColor: r.met ? MET_COLOR : theme.accent },
                  ]}
                />
              </View>
              <View style={styles.zoneBottom}>
                <Text style={styles.zoneNum}>
                  {r.acq} / {z.minUnits} {t("grad.unit")}
                </Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => step(z.id, -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => step(z.id, 1)}>
                    <Text style={styles.stepBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {r.planned > 0 ? (
                <Text style={styles.zoneSub}>⏳ {t("grad.rec.inProgress")} +{r.planned}</Text>
              ) : null}
              {r.overflow > 0 ? (
                <Text style={styles.zoneSub}>{t("grad.rec.overflow")} {r.overflow} {t("grad.unit")}</Text>
              ) : null}
              {z.id === "kikan" ? (
                <Text style={styles.zoneSub}>
                  {calc.ownCourse == null
                    ? t("grad.rec.ownCoursePrompt")
                    : `${t("grad.rec.ownCourse")} ${calc.ownCourse}/${GRAD_SUB_MINS.ownCourse} · ${t("grad.rec.gaisen")} ${calc.gaisen}/${GRAD_SUB_MINS.gaisen}`}
                </Text>
              ) : null}
              {r.subUnverified && !(z.id === "kikan" && calc.ownCourse == null) ? (
                <Text style={styles.zoneSubWarn}>{t("grad.rec.subUnverified")}</Text>
              ) : null}
              {z.id === "sogo" ? (
                <Text style={styles.zoneSub}>
                  {t("grad.rec.subBunka")} {calc.sogoSubs.bunka}/4 · {t("grad.rec.subChiiki")} {calc.sogoSubs.chiiki}/4 · {t("grad.rec.subNingen")} {calc.sogoSubs.ningen}/4
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* CAN — これから履修できる科目（参考） */}
        <Text style={styles.canHeading}>{t("grad.canHeading")}</Text>
        <Text style={styles.canIntro}>{t("grad.canIntro")}</Text>

        {/* 現在の学年 */}
        <Text style={styles.miniLabel}>{t("grad.gradeLabel")}</Text>
        <View style={styles.seg}>
          {GRADES.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.segBtn, grade === g && styles.segBtnOn]}
              onPress={() => setGrade(g)}
            >
              <Text style={[styles.segText, grade === g && styles.segTextOn]}>{g}年</Text>
            </TouchableOpacity>
          ))}
        </View>


        {selectedCourse ? (
          <View style={styles.canCard}>
            <View style={styles.canCardTop}>
              <Text style={styles.canCardTitle}>{selectedCourse.nameJa}</Text>
              <View style={styles.canCountBadge}>
                <Text style={styles.canCountText}>{t("grad.canCount")} {selectedCourse.subjects.length}</Text>
              </View>
            </View>
            <Text style={styles.canYearNote}>{t("grad.canYearNote")}</Text>
            {gradeLocked ? (
              <View style={styles.lockRow}>
                <Text style={styles.lockText}>{t("grad.canGradeLock")}</Text>
              </View>
            ) : null}
            <View style={styles.subjWrap}>
              {selectedCourse.subjects.map((s) => {
                const y3 = YEAR3_ONLY.includes(s);
                return (
                  <View key={s} style={[styles.subjChip, gradeLocked && styles.subjChipDim]}>
                    <Text style={[styles.subjText, gradeLocked && styles.subjTextDim]}>{s}</Text>
                    {y3 ? <Text style={styles.subjYear}>3年</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.canPrompt}>
            <Text style={styles.canPromptText}>{t("grad.coursePromptUp")}</Text>
          </View>
        )}

        {/* 履修のルール */}
        <Text style={styles.rulesHeading}>{t("grad.rulesHeading")}</Text>
        {[t("grad.ruleCap"), t("grad.ruleMedia"), t("grad.ruleFree")].map((r, i) => (
          <View key={i} style={styles.ruleCard}>
            <Text style={styles.ruleDot}>•</Text>
            <Text style={styles.ruleText}>{r}</Text>
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{t("grad.disclaimer")}</Text>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },
    backButton: {
      width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center",
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    backIcon: { fontSize: 18, color: theme.textPrimary },
    title: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    subtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
    expBadge: {
      backgroundColor: theme.accent + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    },
    expBadgeText: { fontSize: 10, fontWeight: "700", color: theme.accent },

    content: { paddingHorizontal: 16, paddingBottom: 40 },
    sectionLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: "700", marginTop: 8, marginBottom: 6 },

    seg: {
      flexDirection: "row", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
      borderRadius: 10, padding: 3, gap: 3,
    },
    segBtn: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: "center" },
    segBtnOn: { backgroundColor: theme.primary },
    segText: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    segTextOn: { color: "#fff" },

    summary: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14,
      padding: 16, marginTop: 14,
    },
    summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
    summaryLabel: { fontSize: 13, color: theme.textSecondary, fontWeight: "700" },
    summaryNum: { fontSize: 13, color: theme.textSecondary },
    summaryBig: { fontSize: 22, fontWeight: "800", color: theme.textPrimary },
    summaryBar: { height: 10, borderRadius: 6, backgroundColor: theme.border, overflow: "hidden" },
    summaryBarFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: theme.primary },
    summaryBarPlan: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: theme.primary + "44" },
    summaryPlan: { fontSize: 12, color: theme.primary, marginTop: 4, fontWeight: "700" },
    allocNote: { backgroundColor: theme.accent + "14", borderRadius: 10, padding: 10, marginTop: 16 },
    allocNoteText: { fontSize: 11.5, color: theme.textSecondary, lineHeight: 16 },
    summaryHint: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },

    // 不足カード（最重要）
    shortCard: {
      backgroundColor: theme.accent + "12", borderWidth: 1, borderColor: theme.accent + "44",
      borderRadius: 14, padding: 14, marginTop: 14,
    },
    shortHeading: { fontSize: 14, fontWeight: "800", color: theme.accent },
    shortIntro: { fontSize: 11.5, color: theme.textSecondary, marginTop: 3, marginBottom: 10, lineHeight: 16 },
    shortItem: {
      backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
      padding: 11, marginTop: 8,
    },
    shortItemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    shortName: { fontSize: 13.5, fontWeight: "700", color: theme.textPrimary, flex: 1, paddingRight: 8 },
    shortBadge: { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    shortBadgeText: { fontSize: 11.5, fontWeight: "800", color: "#fff" },
    shortNum: { fontSize: 12, color: theme.textSecondary, fontWeight: "600", marginTop: 5 },
    shortHint: { fontSize: 11, color: theme.textSecondary, marginTop: 4, lineHeight: 16 },

    // 全区分達成
    allMet: {
      backgroundColor: MET_COLOR + "16", borderWidth: 1, borderColor: MET_COLOR + "44",
      borderRadius: 14, padding: 16, marginTop: 14, alignItems: "center",
    },
    allMetText: { fontSize: 13.5, fontWeight: "800", color: MET_COLOR, textAlign: "center" },

    inputHeading: { fontSize: 13, color: theme.textPrimary, fontWeight: "800", marginTop: 22 },
    stepHint: { fontSize: 11, color: theme.textSecondary, marginTop: 4, marginBottom: 6 },

    zone: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
      padding: 12, marginTop: 8,
    },
    zoneTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    zoneName: { fontSize: 13.5, fontWeight: "700", color: theme.textPrimary, flex: 1 },
    chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
    chipOk: { backgroundColor: MET_COLOR + "22" },
    chipShort: { backgroundColor: theme.accent + "22" },
    chipText: { fontSize: 10.5, fontWeight: "700" },
    chipTextOk: { color: MET_COLOR },
    chipTextShort: { color: theme.accent },
    zoneBar: { height: 8, borderRadius: 5, backgroundColor: theme.border, overflow: "hidden" },
    zoneBarFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
    zoneBarPlan: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: theme.primary + "44" },
    zoneSub: { fontSize: 11, color: theme.textSecondary, marginTop: 5 },
    zoneSubWarn: { fontSize: 11, color: theme.accent, marginTop: 5, fontWeight: "700" },
    allMetNote: { fontSize: 11.5, color: theme.textSecondary, marginTop: 6, textAlign: "center" },
    zoneBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    zoneNum: { fontSize: 12.5, color: theme.textSecondary, fontWeight: "600" },
    stepper: { flexDirection: "row", gap: 8 },
    stepBtn: {
      width: 30, height: 30, borderRadius: 8, backgroundColor: theme.background,
      borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center",
    },
    stepBtnText: { fontSize: 16, fontWeight: "700", color: theme.primary },

    // CAN セクション
    canHeading: { fontSize: 13, color: theme.textPrimary, fontWeight: "800", marginTop: 26 },
    canIntro: { fontSize: 11.5, color: theme.textSecondary, marginTop: 4, lineHeight: 16 },
    miniLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: "700", marginTop: 14, marginBottom: 6 },

    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    courseChip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    courseChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    courseChipText: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    courseChipTextOn: { color: "#fff" },

    canPrompt: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderStyle: "dashed",
      borderRadius: 12, padding: 16, marginTop: 12, alignItems: "center",
    },
    canPromptText: { fontSize: 12, color: theme.textSecondary, textAlign: "center" },

    canCard: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14,
      padding: 14, marginTop: 12,
    },
    canCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    canCardTitle: { fontSize: 14, fontWeight: "800", color: theme.textPrimary, flex: 1, paddingRight: 8 },
    canCountBadge: { backgroundColor: theme.primary + "1E", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    canCountText: { fontSize: 11, fontWeight: "800", color: theme.primary },
    canYearNote: { fontSize: 11, color: theme.textSecondary, marginTop: 6, lineHeight: 16 },
    lockRow: { backgroundColor: theme.accent + "16", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
    lockText: { fontSize: 11.5, fontWeight: "700", color: theme.accent },

    subjWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
    subjChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
      borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
    },
    subjChipDim: { opacity: 0.5 },
    subjText: { fontSize: 11.5, color: theme.textPrimary, fontWeight: "600" },
    subjTextDim: { color: theme.textSecondary },
    subjYear: { fontSize: 9.5, color: theme.primary, fontWeight: "800" },

    rulesHeading: { fontSize: 12.5, color: theme.textPrimary, fontWeight: "800", marginTop: 22, marginBottom: 6 },
    ruleCard: {
      flexDirection: "row", gap: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
      borderRadius: 10, padding: 11, marginTop: 7,
    },
    ruleDot: { fontSize: 13, color: theme.primary, fontWeight: "800", lineHeight: 18 },
    ruleText: { flex: 1, fontSize: 11.5, color: theme.textSecondary, lineHeight: 17 },

    // 準備中(ゲート)
    soonCard: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16,
      padding: 22, marginTop: 20, alignItems: "center",
    },
    soonIcon: { fontSize: 34, marginBottom: 10 },
    soonTitle: { fontSize: 16, fontWeight: "800", color: theme.textPrimary },
    soonBody: { fontSize: 13, color: theme.textSecondary, marginTop: 8, textAlign: "center", lineHeight: 19 },
    soonSupported: {
      backgroundColor: theme.primary + "1A", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 16,
    },
    soonSupportedText: { fontSize: 12, fontWeight: "700", color: theme.primary, textAlign: "center" },
    soonNote: { fontSize: 11, color: theme.textSecondary, marginTop: 12, textAlign: "center" },
    soonBrowse: {
      marginTop: 18, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
      paddingHorizontal: 16, paddingVertical: 11,
    },
    soonBrowseText: { fontSize: 12.5, fontWeight: "700", color: theme.textSecondary },

    disclaimer: {
      backgroundColor: theme.accent + "14", borderRadius: 10, padding: 12, marginTop: 18,
    },
    disclaimerText: { fontSize: 11.5, color: theme.textSecondary, lineHeight: 17 },
  });
}
