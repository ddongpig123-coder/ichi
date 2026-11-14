import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";
import type { TranslationKey } from "../src/i18n/translations";
import { dayLabel } from "../src/i18n/translations";
import ScreenHeader from "../src/components/common/ScreenHeader";
import TimeTable from "../src/components/timetable/TimeTable";
import { getTimetable, saveTimetableSessions } from "../src/services/timetableService";
import {
  canReadTimetableImage,
  pickTimetableImage,
  readTimetableImage,
  loadOcrDraft,
  saveOcrDraft,
  clearOcrDraft,
  OcrError,
  type OcrErrorCode,
  type OcrResult,
  type OcrSession,
  type OcrUnplaced,
} from "../src/services/timetableOcrService";
import { getCurrentAcademicYear, getCurrentSemester, type Semester } from "../src/data/semesterTimetables";
import { DAYS, PERIODS, type ClassSession } from "../src/types/timetable";

// 時間割スクショ読み取り（RELEASE-PLAN N1 / docs/TIMETABLE-OCR.md §4）
// 説明 + AI 送信の同意（Apple 審査ガイドライン 5.1.2(i)）→ 画像を選ぶ → 読み取り中 → 確認・修正 → 保存。
// 入口: はじめの設定 ②（TutorialOverlay）と、ホームの空の時間割。
// 旧バイナリ（写真選択の部品が無いアプリ）では入口を出さない（canReadTimetableImage）。

type Phase = "intro" | "reading" | "review" | "saving";
type Row = OcrSession & { key: string };
type SaveMode = "fill" | "replace";

const ERROR_KEYS: Record<OcrErrorCode | "not-timetable" | "empty" | "unsupported" | "too-large" | "pick-failed", TranslationKey> = {
  "login-required": "ocr.errLogin",
  "already-used": "ocr.errAlreadyUsed",
  "in-progress": "ocr.errInProgress",
  "daily-cap": "ocr.errDailyCap",
  "bad-image": "ocr.errUnsupported",
  failed: "ocr.errFailed",
  "not-timetable": "ocr.errNotTimetable",
  empty: "ocr.errEmpty",
  unsupported: "ocr.errUnsupported",
  "too-large": "ocr.errTooLarge",
  "pick-failed": "ocr.errPickFailed",
};

// 講義名から色を決める（timetable-wizard と同じ方式: 同じ講義は同じ色）
function colorFor(name: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}

const slot = (s: { day: string; period: number }) => `${s.day}-${s.period}`;

function toRows(r: OcrResult): Row[] {
  const order = (s: OcrSession) => DAYS.indexOf(s.day) * 10 + s.period;
  return [...r.sessions].sort((a, b) => order(a) - order(b)).map((s, i) => ({ ...s, key: `r${i}` }));
}

export default function TimetableImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ year?: string; semester?: string }>();
  const year = Number(params.year) || getCurrentAcademicYear();
  const semester: Semester = params.semester === "秋" || params.semester === "春" ? params.semester : getCurrentSemester();
  const semesterKey = `${year}-${semester}`;
  const semesterLabel = `${year} ${semester === "春" ? t("timetable.springSemester") : t("timetable.fallSemester")}`;

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [unplaced, setUnplaced] = useState<OcrUnplaced[]>([]);
  const [fromDraft, setFromDraft] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [existing, setExisting] = useState<ClassSession[] | null>(null); // null = 読み込み中
  const [docExists, setDocExists] = useState(false);
  const [mode, setMode] = useState<SaveMode>("fill");

  // 今の時間割（「空いているコマだけ追加 / 置き換え」の判断用）と、前回の読み取り結果（保存前に閉じた場合）
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getTimetable(user.uid, semesterKey)
      .then((d) => {
        if (!alive) return;
        setExisting(d?.sessions ?? []);
        setDocExists(d !== null);
      })
      .catch(() => alive && setExisting([]));
    loadOcrDraft(user.uid, semesterKey).then((d) => {
      if (alive && d && (d.sessions.length > 0 || d.unplaced.length > 0)) {
        showReview(d, true);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, semesterKey]);

  function showReview(r: OcrResult, draft: boolean) {
    setRows(toRows(r));
    setUnplaced(r.unplaced);
    setFromDraft(draft);
    setEditingKey(null);
    setPhase("review");
  }

  async function pickAndRead() {
    if (!user) return;
    setError(null);
    const picked = await pickTimetableImage();
    if (!picked.ok) {
      if (picked.reason === "canceled") return;
      setError(t(ERROR_KEYS[picked.reason === "unavailable" || picked.reason === "failed" ? "pick-failed" : picked.reason]));
      return;
    }
    setPreviewUri(picked.image.uri);
    setPhase("reading");
    try {
      const r = await readTimetableImage(picked.image, semesterKey);
      if (r.notTimetable) throw new Error("not-timetable");
      if (r.sessions.length === 0 && r.unplaced.length === 0) throw new Error("empty");
      saveOcrDraft(user.uid, semesterKey, r);
      showReview(r, false);
    } catch (e) {
      const code =
        e instanceof OcrError ? e.code : e instanceof Error && (e.message === "not-timetable" || e.message === "empty") ? e.message : "failed";
      // もう使った学期でも、この端末に前回の結果が残っていればそれを見せる
      if (code === "already-used") {
        const d = await loadOcrDraft(user.uid, semesterKey);
        if (d && (d.sessions.length > 0 || d.unplaced.length > 0)) {
          showReview(d, true);
          return;
        }
      }
      setError(t(ERROR_KEYS[code as keyof typeof ERROR_KEYS] ?? "ocr.errFailed"));
      setPhase("intro");
    }
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
    if (editingKey === key) setEditingKey(null);
  }

  const duplicateSlots = useMemo(() => {
    const count = new Map<string, number>();
    rows.forEach((r) => count.set(slot(r), (count.get(slot(r)) ?? 0) + 1));
    return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
  }, [rows]);
  const lowCount = rows.filter((r) => r.confidence === "low").length;
  const validRows = rows.filter((r) => r.name.trim());

  // プレビュー用（保存されるのと同じ形）
  const freshSessions: ClassSession[] = useMemo(
    () =>
      validRows.map((r) => ({
        id: r.key,
        day: r.day,
        period: r.period,
        name: r.name.trim(),
        teacher: r.teacher?.trim() ?? "",
        room: r.room?.trim() ?? "",
        color: colorFor(r.name.trim(), theme.timetableCells),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, theme.timetableCells]
  );
  const hasExisting = (existing?.length ?? 0) > 0;
  const takenSlots = useMemo(() => new Set((existing ?? []).map(slot)), [existing]);
  const skippedByFill = hasExisting && mode === "fill" ? freshSessions.filter((s) => takenSlots.has(slot(s))).length : 0;

  async function save() {
    if (!user || existing === null || freshSessions.length === 0) return;
    setPhase("saving");
    const stamp = Date.now();
    const fresh = freshSessions.map((s, i) => ({ ...s, id: `${stamp}-${i}` }));
    const next =
      hasExisting && mode === "fill"
        ? [...existing, ...fresh.filter((s) => !takenSlots.has(slot(s)))]
        : fresh;
    try {
      await saveTimetableSessions(user.uid, semesterKey, next, { initVisibility: !docExists });
      clearOcrDraft(user.uid, semesterKey);
      router.replace("/(tabs)");
    } catch (e) {
      console.warn("ocr save failed:", e);
      setError(t("common.saveFailed"));
      setPhase("review");
    }
  }

  const header = (
    <ScreenHeader
      title={t("ocr.title")}
      fallback="/(tabs)"
      right={<Text style={styles.semesterBadge}>{semesterLabel}</Text>}
    />
  );

  if (!canReadTimetableImage) {
    // 旧バイナリでは入口を出していないが、リンク等で来てしまった場合
    return (
      <View style={styles.container}>
        {header}
        <Text style={[styles.body, { margin: 24 }]}>{t("ocr.needUpdate")}</Text>
      </View>
    );
  }

  if (phase === "reading") {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.readingWrap}>
          {previewUri ? <Image source={{ uri: previewUri }} style={styles.readingImage} resizeMode="contain" /> : null}
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
          <Text style={styles.readingTitle}>{t("ocr.reading")}</Text>
          <Text style={styles.readingSub}>{t("ocr.readingSub")}</Text>
        </View>
      </View>
    );
  }

  if (phase === "review" || phase === "saving") {
    const saving = phase === "saving";
    return (
      <View style={styles.container}>
        {header}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
          <View style={styles.section}>
            <Text style={styles.reviewTitle}>
              {t("ocr.reviewTitle").replace("{n}", String(validRows.length))}
            </Text>
            <Text style={styles.body}>{t(fromDraft ? "ocr.reviewFromDraft" : "ocr.reviewBody")}</Text>
            {lowCount > 0 && (
              <View style={styles.warnBox}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.warning} />
                <Text style={styles.warnText}>{t("ocr.lowConfidence").replace("{n}", String(lowCount))}</Text>
              </View>
            )}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {freshSessions.length > 0 && (
            <View style={styles.previewWrap} pointerEvents={saving ? "none" : "auto"}>
              <TimeTable
                sessions={freshSessions}
                cellHeight={46}
                onPressSession={(s) => setEditingKey((k) => (k === s.id ? null : s.id))}
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("ocr.listTitle")}</Text>
            {rows.length === 0 && <Text style={styles.muted}>{t("ocr.listEmpty")}</Text>}
            {rows.map((r) => {
              const low = r.confidence === "low";
              const dup = duplicateSlots.has(slot(r));
              const open = editingKey === r.key;
              return (
                <View key={r.key} style={[styles.rowCard, low && styles.rowCardLow, open && styles.rowCardOpen]}>
                  <View style={styles.rowTop}>
                    <TouchableOpacity
                      style={styles.slotChip}
                      onPress={() => setEditingKey(open ? null : r.key)}
                      accessibilityRole="button"
                      accessibilityLabel={t("ocr.changeSlot")}
                    >
                      <Text style={styles.slotText}>{`${dayLabel(language, r.day)}${r.period}`}</Text>
                      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={13} color={theme.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.nameInput]}
                      value={r.name}
                      onChangeText={(v) => updateRow(r.key, { name: v })}
                      placeholder={t("ocr.namePlaceholder")}
                      placeholderTextColor={theme.textSecondary}
                      maxLength={100}
                    />
                    <TouchableOpacity
                      onPress={() => removeRow(r.key)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.delete")}
                    >
                      <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.rowBottom}>
                    <TextInput
                      style={[styles.input, styles.subInput]}
                      value={r.teacher ?? ""}
                      onChangeText={(v) => updateRow(r.key, { teacher: v })}
                      placeholder={t("ocr.teacherPlaceholder")}
                      placeholderTextColor={theme.textSecondary}
                      maxLength={100}
                    />
                    <TextInput
                      style={[styles.input, styles.subInput]}
                      value={r.room ?? ""}
                      onChangeText={(v) => updateRow(r.key, { room: v })}
                      placeholder={t("ocr.roomPlaceholder")}
                      placeholderTextColor={theme.textSecondary}
                      maxLength={100}
                    />
                  </View>
                  {(low || dup) && (
                    <Text style={styles.rowNote}>
                      {[low ? t("ocr.rowLow") : null, dup ? t("ocr.rowDuplicate") : null].filter(Boolean).join(" ・ ")}
                    </Text>
                  )}
                  {open && (
                    <View style={styles.slotPicker}>
                      <View style={styles.chipRow}>
                        {DAYS.map((d) => (
                          <TouchableOpacity
                            key={d}
                            style={[styles.pickChip, r.day === d && styles.pickChipOn]}
                            onPress={() => updateRow(r.key, { day: d })}
                          >
                            <Text style={[styles.pickChipText, r.day === d && styles.pickChipTextOn]}>{dayLabel(language, d)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={styles.chipRow}>
                        {PERIODS.map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[styles.pickChip, r.period === p && styles.pickChipOn]}
                            onPress={() => updateRow(r.key, { period: p })}
                          >
                            <Text style={[styles.pickChipText, r.period === p && styles.pickChipTextOn]}>{p}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {unplaced.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("ocr.unplacedTitle")}</Text>
              <Text style={styles.muted}>{t("ocr.unplacedBody")}</Text>
              {unplaced.map((u, i) => (
                <View key={i} style={styles.unplacedRow}>
                  <Text style={styles.unplacedName}>{u.name}</Text>
                  {u.reason ? <Text style={styles.unplacedReason}>{u.reason}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {hasExisting && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("ocr.existingTitle").replace("{n}", String(existing?.length ?? 0))}
              </Text>
              {(["fill", "replace"] as SaveMode[]).map((m) => (
                <TouchableOpacity key={m} style={styles.modeRow} onPress={() => setMode(m)} accessibilityRole="radio">
                  <Ionicons
                    name={mode === m ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={mode === m ? theme.primary : theme.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modeLabel}>{t(m === "fill" ? "ocr.modeFill" : "ocr.modeReplace")}</Text>
                    <Text style={styles.muted}>{t(m === "fill" ? "ocr.modeFillSub" : "ocr.modeReplaceSub")}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {skippedByFill > 0 && (
                <Text style={styles.rowNote}>{t("ocr.skipped").replace("{n}", String(skippedByFill))}</Text>
              )}
            </View>
          )}

          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.primaryBtn, (saving || freshSessions.length === 0 || existing === null) && { opacity: 0.5 }]}
              onPress={save}
              disabled={saving || freshSessions.length === 0 || existing === null}
              accessibilityRole="button"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
              <Text style={styles.primaryText}>{t("ocr.save")}</Text>
            </TouchableOpacity>
            <Text style={[styles.muted, { textAlign: "center", marginTop: 10 }]}>{t("ocr.draftNote")}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── intro（説明 + AI 送信の同意）
  const steps: TranslationKey[] = ["ocr.step1", "ocr.step2", "ocr.step3"];
  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <View style={[styles.section, { alignItems: "center" }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="image-outline" size={34} color={theme.primary} />
          </View>
          <Text style={styles.heroTitle}>{t("ocr.heroTitle")}</Text>
          <Text style={[styles.body, { textAlign: "center" }]}>{t("ocr.heroBody")}</Text>
        </View>

        <View style={styles.section}>
          {steps.map((k, i) => (
            <View key={k} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{t(k)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, styles.consentBox]}>
          <View style={styles.consentHead}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.primary} />
            <Text style={styles.consentTitle}>{t("ocr.consentTitle")}</Text>
          </View>
          <Text style={styles.consentBody}>{t("ocr.consentBody")}</Text>
          <TouchableOpacity onPress={() => router.push("/privacy")} accessibilityRole="link">
            <Text style={styles.link}>{t("ocr.consentPolicy")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="information-circle-outline" size={18} color={theme.textPrimary} />
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, !user && { opacity: 0.5 }]}
            onPress={pickAndRead}
            disabled={!user}
            accessibilityRole="button"
          >
            <Ionicons name="images-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>{t("ocr.agreeAndPick")}</Text>
          </TouchableOpacity>
          <Text style={[styles.muted, { textAlign: "center", marginTop: 10 }]}>{t("ocr.oncePerSemester")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    semesterBadge: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    section: { marginHorizontal: 16, marginTop: 16 },
    iconCircle: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: theme.primary + "18",
      justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    heroTitle: { fontSize: 19, fontWeight: "800", color: theme.textPrimary, textAlign: "center", marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 21, color: theme.textSecondary },
    muted: { fontSize: 12, lineHeight: 18, color: theme.textSecondary },
    stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
    stepNum: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary,
      justifyContent: "center", alignItems: "center", marginTop: 1,
    },
    stepNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    stepText: { flex: 1, fontSize: 14, lineHeight: 21, color: theme.textPrimary },
    consentBox: { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14 },
    consentHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    consentTitle: { fontSize: 14, fontWeight: "800", color: theme.textPrimary },
    consentBody: { fontSize: 13, lineHeight: 20, color: theme.textSecondary, marginBottom: 8 },
    link: { fontSize: 13, fontWeight: "700", color: theme.primary },
    primaryBtn: {
      flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
      backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 15,
    },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    errorBox: {
      flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.danger, marginBottom: 12,
    },
    errorBoxText: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.textPrimary },
    errorText: { fontSize: 13, color: theme.danger, marginTop: 8 },
    readingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    readingImage: { width: 160, height: 260, borderRadius: 12, opacity: 0.55, backgroundColor: theme.card },
    readingTitle: { fontSize: 16, fontWeight: "800", color: theme.textPrimary, marginTop: 14 },
    readingSub: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
    reviewTitle: { fontSize: 17, fontWeight: "800", color: theme.textPrimary, marginBottom: 6 },
    warnBox: {
      flexDirection: "row", gap: 6, alignItems: "center", marginTop: 10, padding: 10, borderRadius: 10,
      backgroundColor: theme.warning + "22",
    },
    warnText: { flex: 1, fontSize: 13, color: theme.textPrimary, fontWeight: "600" },
    previewWrap: { marginTop: 14 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: theme.textPrimary, marginBottom: 8 },
    rowCard: {
      backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
      padding: 10, marginBottom: 8,
    },
    rowCardLow: { borderColor: theme.warning, backgroundColor: theme.warning + "14" },
    rowCardOpen: { borderColor: theme.primary },
    rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowBottom: { flexDirection: "row", gap: 8, marginTop: 6, marginLeft: 64 },
    slotChip: {
      width: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2,
      paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: theme.primary,
    },
    slotText: { fontSize: 13, fontWeight: "800", color: theme.primary },
    input: {
      borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
      color: theme.textPrimary, backgroundColor: theme.background,
    },
    // minWidth 0: Web の TextInput は既定幅を持つので、0 にしないと行からはみ出す
    nameInput: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
    subInput: { flex: 1, minWidth: 0, fontSize: 12 },
    rowNote: { fontSize: 12, fontWeight: "600", color: theme.warning, marginTop: 6, marginLeft: 64 },
    slotPicker: { marginTop: 10, gap: 6 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pickChip: {
      minWidth: 36, alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background,
    },
    pickChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    pickChipText: { fontSize: 13, fontWeight: "700", color: theme.textPrimary },
    pickChipTextOn: { color: "#fff" },
    unplacedRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    unplacedName: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
    unplacedReason: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    modeRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 8 },
    modeLabel: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
  });
}
