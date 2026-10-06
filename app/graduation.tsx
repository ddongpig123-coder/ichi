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
import { classifySubject, type AllocKey, type CourseId } from "../src/data/gradAllocationMeijiCommerce";
import { calcGrad, canToggleOwnCourse, diffZones, GRAD_SUB_MINS, type GradRecord, type RecordStatus } from "../src/utils/gradCalc";
import {
  loadGradState, saveGradState, loadTimetableSubjects, type TimetableSubject,
} from "../src/services/gradRecordService";
import { GradRecords, type Classified } from "../src/components/graduation/GradRecords";
import { ZoneDiagnosis } from "../src/components/graduation/ZoneDiagnosis";
import { AllocationCAN } from "../src/components/graduation/AllocationCAN";
import { INTERDISCIPLINARY_MATH_ALLOCATION } from "../src/data/allocationInterdisciplinaryMath";
import { RequiredCourses } from "../src/components/graduation/RequiredCourses";
import { LAW_REQUIRED } from "../src/data/requiredCoursesLaw";
import {
  FACULTIES, facultyById, facultyFromDept, bandForAdmissionYear, resolveZones,
  MEIJI, type Faculty, type FBand,
} from "../src/data/facultyMasters";
import { ENROLLMENT_YEAR } from "../src/data/semesterTimetables";

const MET_COLOR = "#1F9D6B";
const GRADES = [1, 2, 3, 4];
const MEIJI_DOMAIN = MEIJI;

// 学校レベルの対応状況。学部マスターは明治の全10学部を整備済み（商=配当表まで / 他9=区分のみ）。
// 明治以外の学校・学校未設定のみ「準備中」。通信失敗など不明時は fail-open。
type SchoolCoverage = "meiji" | "school" | "noschool";
function schoolCoverageOf(schoolDomain: string | null): SchoolCoverage {
  if (schoolDomain == null) return "noschool";
  if (schoolDomain !== MEIJI_DOMAIN) return "school";
  return "meiji";
}
// 区分のみ診断のコンテキストキー（学部/学科/在籍区分ごとに入力を分離）
function zoneCtxKey(facultyId: string, deptId: string | null, ryu: boolean): string {
  return `${facultyId}/${deptId ?? ""}/${ryu ? "r" : "d"}`;
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

  // 学校レベルのゲーティング（明治のみ対応。学部は下のセレクタで選択）。
  const { user, schoolDomain, schoolReady } = useAuth();
  const [dept, setDept] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [override, setOverride] = useState(false); // 「参考として見る」で解除
  const [admissionYear, setAdmissionYear] = useState<number | null>(null);

  // 学部・学科・バンド・在籍区分（当アプリの主ターゲットは留学生なので既定=留学生）。
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [bandKey, setBandKey] = useState<string | null>(null);
  const [isRyugakusei, setIsRyugakusei] = useState(true);
  // 区分のみ診断の入力（コンテキストごと）
  const [zoneBaselines, setZoneBaselines] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!user) { setProfileReady(true); return; }
    let alive = true;
    getUserProfile(user.uid)
      .then((p) => {
        if (!alive) return;
        const d = p?.department ?? null;
        setDept(d);
        setAdmissionYear(p?.admissionYear ?? null);
        // 学部をプロフィールから自動推定。商学部なら従来エンジン。
        const f = facultyFromDept(d);
        if (f) setFacultyId(f.id);
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

  // 選択中の学部・バンド（入学年度でバンド自動選択。未選択時は null）。
  const selFaculty: Faculty | null = facultyId ? facultyById(facultyId) : null;
  const selBand: FBand | null = selFaculty
    ? selFaculty.bands.find((b) => b.key === bandKey) ?? bandForAdmissionYear(selFaculty, admissionYear)
    : null;
  const isCommerce = selFaculty?.engine === "commerce";

  // 学部を変えたら学科/バンドを既定化（最初の学科・入学年度バンド）。
  useEffect(() => {
    if (!selFaculty) { setDeptId(null); return; }
    const band = bandForAdmissionYear(selFaculty, admissionYear);
    setBandKey(band.key);
    const depts = band.byDepartment;
    setDeptId(depts && depts.length > 0 ? depts[0].id : null);
  }, [facultyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setZoneBaselines(st.zoneBaselines ?? {});
      setDelta(null);
      setLoadedKey(storeKey);
    });
    return () => { alive = false; };
  }, [uid, storeKey]);

  // 変更のたびに保存。現在のキーの読み込み完了前は保存しない（空や別uidの記録で上書きしない）。
  useEffect(() => {
    if (loadedKey !== storeKey) return;
    saveGradState(uid, { version: 2, records, baseline, courseId, zoneBaselines });
  }, [loadedKey, storeKey, uid, records, baseline, courseId, zoneBaselines]);

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

  const coverage = schoolCoverageOf(schoolDomain);
  // 明治以外の学校・学校未設定のみブロック。profileReady/schoolReady 前や不明時は fail-open。
  const blocked = profileReady && schoolReady && coverage !== "meiji" && !override;

  // 区分のみ診断の解決マスターと入力（コンテキストごと）。
  const zoneCtx = selFaculty && !isCommerce ? zoneCtxKey(selFaculty.id, deptId, isRyugakusei) : null;
  const resolvedZones = selFaculty && selBand && !isCommerce
    ? resolveZones(selBand, deptId, isRyugakusei)
    : null;
  const zoneBaseline = zoneCtx ? (zoneBaselines[zoneCtx] ?? {}) : {};
  // 科目配当表（CAN）: 現状は総合数理学部のみ整備済み。
  const allocCourses = selFaculty?.id === "interdisciplinary-math" && deptId
    ? INTERDISCIPLINARY_MATH_ALLOCATION[deptId] ?? null
    : null;
  // 必修科目（現状は法学部のみ整備済み）。
  const requiredCourses = selFaculty?.id === "law" ? LAW_REQUIRED : null;
  function stepZone(zoneId: string, d: number) {
    if (!zoneCtx) return;
    setZoneBaselines((prev) => {
      const cur = prev[zoneCtx] ?? {};
      const next = Math.max(0, (cur[zoneId] ?? 0) + d);
      return { ...prev, [zoneCtx]: { ...cur, [zoneId]: next } };
    });
  }

  function step(zoneId: string, d: number) {
    setBaseline((prev) => {
      const next = Math.max(0, (prev[zoneId] ?? 0) + d);
      return { ...prev, [zoneId]: next };
    });
  }

  // 配当表（科目→区分）: 入学年度のカリキュラム（〜2022 / 2023〜）で切り替え
  const allocKey: AllocKey = master.key === "from2023" ? "from2023" : "pre2023";
  const classify = useCallback(
    (name: string): Classified | null => {
      const c = classifySubject(name, courseId, allocKey);
      return c && c.zone ? { zone: c.zone, units: c.units } : null;
    },
    [allocKey, courseId],
  );
  const eigoLabel = allocKey === "from2023" ? t("grad.rec.kikanEigo") : t("grad.rec.gaisen");

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
  function toggleOwn(id: string) {
    setRecords(records.map((r) => (r.id === id ? { ...r, ownCourseManual: !r.ownCourseManual } : r)));
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

  // ヘッダーの基準ラベル（学部×入学年度）。
  const commerceBandLabel = GRAD_MASTERS[masterIdx]?.labelJa ?? "";
  const scopeLabel = selFaculty
    ? `明治 ${selFaculty.nameJa} · ${isCommerce ? commerceBandLabel : selBand?.labelJa ?? ""}`
    : t("grad.scope");

  // 学部セレクタ（共通）。
  const facultyChips = (
    <>
      <Text style={styles.sectionLabel}>{t("grad.facultyLabel")}</Text>
      <View style={styles.chipWrap}>
        {FACULTIES.map((f) => {
          const on = f.id === facultyId;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.courseChip, on && styles.courseChipOn]}
              onPress={() => setFacultyId(f.id)}
            >
              <Text style={[styles.courseChipText, on && styles.courseChipTextOn]}>{f.nameJa}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  // 学科・在籍区分・入学年度（選択中の学部に応じて）。
  const deptList = !isCommerce ? selBand?.byDepartment ?? null : null;
  const selectorsBlock = selFaculty ? (
    <>
      {/* 入学年度（バンド） */}
      {isCommerce ? (
        <>
          <Text style={styles.sectionLabel}>{t("grad.bandLabel")}</Text>
          <View style={styles.seg}>
            {GRAD_MASTERS.map((m, i) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.segBtn, masterIdx === i && styles.segBtnOn]}
                onPress={() => { setMasterIdx(i); setBandKey(m.key); }}
              >
                <Text style={[styles.segText, masterIdx === i && styles.segTextOn]}>{m.labelJa}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : selFaculty.bands.length > 1 ? (
        <>
          <Text style={styles.sectionLabel}>{t("grad.bandLabel")}</Text>
          <View style={styles.seg}>
            {selFaculty.bands.map((b) => (
              <TouchableOpacity
                key={b.key}
                style={[styles.segBtn, selBand?.key === b.key && styles.segBtnOn]}
                onPress={() => setBandKey(b.key)}
              >
                <Text style={[styles.segText, selBand?.key === b.key && styles.segTextOn]}>{b.labelJa}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {/* 学科・専攻 */}
      {deptList ? (
        <>
          <Text style={styles.miniLabel}>{selFaculty.deptLabel ?? t("grad.deptLabelDefault")}</Text>
          <View style={styles.chipWrap}>
            {deptList.map((d) => {
              const on = d.id === deptId;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.courseChip, on && styles.courseChipOn]}
                  onPress={() => setDeptId(d.id)}
                >
                  <Text style={[styles.courseChipText, on && styles.courseChipTextOn]}>{d.nameJa}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {/* 在籍区分（留学生で要件が変わる学部のみ） */}
      {!isCommerce && selFaculty.residencyVariable ? (
        <>
          <Text style={styles.miniLabel}>{t("grad.residencyLabel")}</Text>
          <View style={styles.seg}>
            <TouchableOpacity
              style={[styles.segBtn, isRyugakusei && styles.segBtnOn]}
              onPress={() => setIsRyugakusei(true)}
            >
              <Text style={[styles.segText, isRyugakusei && styles.segTextOn]}>{t("grad.residencyRyu")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, !isRyugakusei && styles.segBtnOn]}
              onPress={() => setIsRyugakusei(false)}
            >
              <Text style={[styles.segText, !isRyugakusei && styles.segTextOn]}>{t("grad.residencyDom")}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </>
  ) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("grad.title")}</Text>
          <Text style={styles.subtitle}>{scopeLabel}</Text>
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
        {/* 学部・入学年度・学科・在籍区分セレクタ（全学部共通） */}
        {facultyChips}
        {selectorsBlock}

        {/* 学部未選択（プロフィールの学部から推定できなかった場合） */}
        {!selFaculty ? (
          <View style={styles.canPrompt}>
            <Text style={styles.canPromptText}>{t("grad.pickFaculty")}</Text>
          </View>
        ) : null}

        {/* 区分のみ診断（商学部以外の9学部） */}
        {selFaculty && !isCommerce && resolvedZones ? (
          <>
            <Text style={styles.zonesIntro}>{t("grad.zonesIntro")}</Text>
            <ZoneDiagnosis
              theme={theme}
              t={t}
              master={resolvedZones}
              baseline={zoneBaseline}
              onStep={stepZone}
            />

            {/* 必修科目（配当表の必修を整備済みの学部のみ） */}
            {requiredCourses ? (
              <RequiredCourses
                theme={theme}
                t={t}
                courses={requiredCourses}
                zones={resolvedZones.zones.map((z) => ({ id: z.id, nameJa: z.nameJa }))}
              />
            ) : null}

            {/* CAN — これから履修できる科目（配当表が整備済みの学科のみ） */}
            {allocCourses ? (
              <>
                <Text style={styles.canHeading}>{t("grad.canHeading")}</Text>
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
                <AllocationCAN
                  theme={theme}
                  t={t}
                  courses={allocCourses}
                  grade={grade}
                  zones={resolvedZones.zones.filter((z) => !/freezone|jiyu/i.test(z.id)).map((z) => ({ id: z.id, nameJa: z.nameJa }))}
                />
              </>
            ) : null}

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>{t("grad.disclaimer")}</Text>
            </View>
          </>
        ) : null}

        {/* 商学部（配当表まで整備済みの従来エンジン） */}
        {isCommerce ? (
        <>
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
                      : `${t("grad.rec.ownCourse")} ${calc.ownCourse ?? 0}/${GRAD_SUB_MINS.ownCourse} · ${eigoLabel} ${calc.eigo}/${GRAD_SUB_MINS.eigo}`}
                  </Text>
                ) : null}
                {r.zone.hintJa ? <Text style={styles.shortHint}>{r.zone.hintJa}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* 修得記録（時間割候補・手動追加・一覧） */}
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
          canToggleOwn={(r) => canToggleOwnCourse(r, allocKey)}
          onToggleOwn={toggleOwn}
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
                    : `${t("grad.rec.ownCourse")} ${calc.ownCourse}/${GRAD_SUB_MINS.ownCourse} · ${eigoLabel} ${calc.eigo}/${GRAD_SUB_MINS.eigo}`}
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
        </>
        ) : null}
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
    zonesIntro: { fontSize: 11.5, color: theme.textSecondary, marginTop: 14, lineHeight: 16 },

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
