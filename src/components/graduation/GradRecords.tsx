import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import type { Theme } from "../../theme/themes";
import type { TranslationKey } from "../../i18n/translations";
import type { GradMaster } from "../../data/graduationMaster";
import type { ZoneId } from "../../data/gradAllocationMeijiCommerce";
import type { GradRecord, RecordStatus } from "../../utils/gradCalc";
import type { TimetableSubject } from "../../services/gradRecordService";

const MET_COLOR = "#1F9D6B";
const FAIL_COLOR = "#D9534F";
const UNIT_CHOICES = [1, 2, 4];

export interface Classified { zone: ZoneId; units: number }

interface Props {
  theme: Theme;
  t: (key: TranslationKey) => string;
  master: GradMaster;
  records: GradRecord[];
  suggestions: TimetableSubject[];
  timetableState: "loading" | "ready" | "none"; // none = 未ログイン等で読めない
  classify: (name: string) => Classified | null;  // 配当表で判定できなければ null
  delta: string | null;
  onAdd: (r: Omit<GradRecord, "id" | "createdAt">) => void;
  onStatus: (id: string, status: RecordStatus) => void;
  onDelete: (id: string) => void;
  canToggleOwn: (r: GradRecord) => boolean; // 「自コースのゼミ」切替を出す記録か
  onToggleOwn: (id: string) => void;
}

const STATUS_ORDER: RecordStatus[] = ["passed", "failed", "inProgress"];
const STATUS_ICON: Record<RecordStatus, string> = { passed: "✅", failed: "❌", inProgress: "⏳" };

// 修得記録セクション（時間割からの候補 → 取得/不可/履修中、記録一覧、手動追加）
export function GradRecords(p: Props) {
  const { theme, t, master } = p;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const zoneName = (id: string) => master.zones.find((z) => z.id === id)?.nameJa ?? id;
  const statusLabel: Record<RecordStatus, string> = {
    passed: t("grad.rec.passed"),
    failed: t("grad.rec.failed"),
    inProgress: t("grad.rec.inProgress"),
  };

  // 区分不明の候補を展開中のキー（name|semesterKey）と、その選択値
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pickZone, setPickZone] = useState<ZoneId | null>(null);
  const [pickUnits, setPickUnits] = useState(2);

  // 手動追加フォーム
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [formZone, setFormZone] = useState<ZoneId | null>(null);
  const [formUnits, setFormUnits] = useState(2);
  const [formStatus, setFormStatus] = useState<RecordStatus>("passed");
  const auto = name.trim() ? p.classify(name) : null;

  function acceptSuggestion(s: TimetableSubject, status: RecordStatus) {
    const c = p.classify(s.name);
    const key = `${s.name}|${s.semesterKey}`;
    if (!c && openKey !== key) {
      setOpenKey(key);
      setPickZone(null);
      setPickUnits(2);
      return;
    }
    const zone = c?.zone ?? pickZone;
    if (!zone) return;
    p.onAdd({
      name: s.name,
      units: c?.units ?? pickUnits,
      zone,
      status,
      source: "timetable",
      semesterKey: s.semesterKey,
    });
    setOpenKey(null);
  }

  function submitForm() {
    const n = name.trim();
    const zone = auto?.zone ?? formZone;
    if (!n || !zone) return;
    p.onAdd({ name: n, units: auto?.units ?? formUnits, zone, status: formStatus, source: "manual" });
    setName("");
    setFormZone(null);
    setFormUnits(2);
  }

  // 並び: 履修中 → 取得 → 不可、同じ状態内は新しい順
  const LIST_ORDER: RecordStatus[] = ["inProgress", "passed", "failed"];
  const sorted = [...p.records].sort(
    (a, b) => LIST_ORDER.indexOf(a.status) - LIST_ORDER.indexOf(b.status) || b.createdAt - a.createdAt,
  );

  function ZonePicker(props: { value: ZoneId | null; onChange: (z: ZoneId) => void }) {
    return (
      <View style={styles.pickWrap}>
        {master.zones.map((z) => {
          const on = props.value === z.id;
          return (
            <TouchableOpacity key={z.id} style={[styles.pickChip, on && styles.pickChipOn]} onPress={() => props.onChange(z.id as ZoneId)}>
              <Text style={[styles.pickText, on && styles.pickTextOn]}>{z.nameJa}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function UnitPicker(props: { value: number; onChange: (u: number) => void }) {
    return (
      <View style={styles.unitRow}>
        {UNIT_CHOICES.map((u) => {
          const on = props.value === u;
          return (
            <TouchableOpacity key={u} style={[styles.unitChip, on && styles.pickChipOn]} onPress={() => props.onChange(u)}>
              <Text style={[styles.pickText, on && styles.pickTextOn]}>{u}{t("grad.unit")}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.heading}>{t("grad.rec.heading")}</Text>
      <Text style={styles.intro}>{t("grad.rec.intro")}</Text>

      {p.delta ? (
        <View style={styles.delta}>
          <Text style={styles.deltaText}>{p.delta}</Text>
        </View>
      ) : null}

      {/* 時間割から見つかった科目 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {t("grad.rec.fromTimetable")}
          {p.timetableState === "ready" ? ` · ${p.suggestions.length}` : ""}
        </Text>
        {p.timetableState === "loading" ? (
          <Text style={styles.muted}>{t("grad.rec.loading")}</Text>
        ) : p.timetableState === "none" ? (
          <Text style={styles.muted}>{t("grad.rec.noTimetable")}</Text>
        ) : p.suggestions.length === 0 ? (
          <Text style={styles.muted}>{t("grad.rec.noSuggestions")}</Text>
        ) : (
          p.suggestions.map((s) => {
            const c = p.classify(s.name);
            const key = `${s.name}|${s.semesterKey}`;
            const open = openKey === key;
            return (
              <View key={key} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{s.name}</Text>
                    <Text style={styles.rowMeta}>
                      {s.semesterKey}
                      {s.isCurrent ? ` · ${t("grad.rec.current")}` : ""}
                      {"  "}
                      {c ? `→ ${zoneName(c.zone)} ${c.units}${t("grad.unit")}` : t("grad.rec.unknownZone")}
                    </Text>
                  </View>
                </View>
                {open ? (
                  <View style={styles.expand}>
                    <Text style={styles.miniLabel}>{t("grad.rec.pickZone")}</Text>
                    <ZonePicker value={pickZone} onChange={setPickZone} />
                    <Text style={styles.miniLabel}>{t("grad.rec.pickUnits")}</Text>
                    <UnitPicker value={pickUnits} onChange={setPickUnits} />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  {(s.isCurrent ? ["inProgress", "passed", "failed"] : ["passed", "failed", "inProgress"]).map((st) => {
                    const status = st as RecordStatus;
                    const disabled = open && !c && !pickZone;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.actBtn, status === "passed" && styles.actPass, disabled && { opacity: 0.4 }]}
                        disabled={disabled}
                        onPress={() => acceptSuggestion(s, status)}
                      >
                        <Text style={[styles.actText, status === "passed" && styles.actPassText]}>
                          {STATUS_ICON[status]} {statusLabel[status]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* 手動追加 */}
      {formOpen ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("grad.rec.addTitle")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("grad.rec.namePlaceholder")}
            placeholderTextColor={theme.textSecondary}
          />
          {name.trim() ? (
            auto ? (
              <Text style={styles.autoOk}>→ {zoneName(auto.zone)} {auto.units}{t("grad.unit")}（{t("grad.rec.autoFound")}）</Text>
            ) : (
              <View>
                <Text style={styles.muted}>{t("grad.rec.autoMissing")}</Text>
                <Text style={styles.miniLabel}>{t("grad.rec.pickZone")}</Text>
                <ZonePicker value={formZone} onChange={setFormZone} />
                <Text style={styles.miniLabel}>{t("grad.rec.pickUnits")}</Text>
                <UnitPicker value={formUnits} onChange={setFormUnits} />
              </View>
            )
          ) : null}
          <Text style={styles.miniLabel}>{t("grad.rec.status")}</Text>
          <View style={styles.unitRow}>
            {STATUS_ORDER.map((st) => {
              const on = formStatus === st;
              return (
                <TouchableOpacity key={st} style={[styles.unitChip, on && styles.pickChipOn]} onPress={() => setFormStatus(st)}>
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{STATUS_ICON[st]} {statusLabel[st]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.formBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormOpen(false)}>
              <Text style={styles.cancelText}>{t("grad.rec.close")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, (!name.trim() || !(auto || formZone)) && { opacity: 0.4 }]}
              disabled={!name.trim() || !(auto || formZone)}
              onPress={submitForm}
            >
              <Text style={styles.addBtnText}>{t("grad.rec.add")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.openForm} onPress={() => setFormOpen(true)}>
          <Text style={styles.openFormText}>＋ {t("grad.rec.addOpen")}</Text>
        </TouchableOpacity>
      )}

      {/* 記録済み */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {t("grad.rec.listTitle")} · {p.records.length}
        </Text>
        {p.records.length === 0 ? (
          <Text style={styles.muted}>{t("grad.rec.empty")}</Text>
        ) : (
          sorted.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, r.status === "failed" && styles.rowNameFail]}>{r.name}</Text>
                  <Text style={styles.rowMeta}>
                    {zoneName(r.zone)} · {r.units}{t("grad.unit")}
                    {r.semesterKey ? ` · ${r.semesterKey}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => p.onDelete(r.id)} style={styles.delBtn}>
                  <Text style={styles.delText}>{t("grad.rec.delete")}</Text>
                </TouchableOpacity>
              </View>
              {p.canToggleOwn(r) ? (
                <TouchableOpacity style={styles.ownToggle} onPress={() => p.onToggleOwn(r.id)}>
                  <Text style={[styles.ownToggleText, r.ownCourseManual && { color: theme.primary }]}>
                    {r.ownCourseManual ? "☑" : "☐"} {t("grad.rec.ownSeminar")}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.actions}>
                {STATUS_ORDER.map((st) => {
                  const on = r.status === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.actBtn, on && (st === "passed" ? styles.actPass : st === "failed" ? styles.actFail : styles.actProg)]}
                      onPress={() => p.onStatus(r.id, st)}
                    >
                      <Text style={[styles.actText, on && { color: "#fff" }]}>
                        {STATUS_ICON[st]} {statusLabel[st]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </View>
      <Text style={styles.localNote}>{t("grad.rec.localNote")}</Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    heading: { fontSize: 13, color: theme.textPrimary, fontWeight: "800", marginTop: 22 },
    intro: { fontSize: 11.5, color: theme.textSecondary, marginTop: 4, lineHeight: 16 },
    delta: {
      backgroundColor: MET_COLOR + "16", borderWidth: 1, borderColor: MET_COLOR + "44",
      borderRadius: 10, padding: 10, marginTop: 10,
    },
    deltaText: { fontSize: 12.5, fontWeight: "700", color: MET_COLOR, lineHeight: 18 },
    card: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14,
      padding: 12, marginTop: 10,
    },
    cardTitle: { fontSize: 13, fontWeight: "800", color: theme.textPrimary, marginBottom: 4 },
    muted: { fontSize: 11.5, color: theme.textSecondary, marginTop: 4, lineHeight: 16 },
    row: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, marginTop: 8 },
    rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    rowName: { fontSize: 13.5, fontWeight: "700", color: theme.textPrimary },
    rowNameFail: { color: theme.textSecondary, textDecorationLine: "line-through" },
    rowMeta: { fontSize: 11, color: theme.textSecondary, marginTop: 3 },
    actions: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
    actBtn: {
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background,
    },
    actText: { fontSize: 11.5, fontWeight: "700", color: theme.textSecondary },
    actPass: { backgroundColor: MET_COLOR, borderColor: MET_COLOR },
    actPassText: { color: "#fff" },
    actFail: { backgroundColor: FAIL_COLOR, borderColor: FAIL_COLOR },
    actProg: { backgroundColor: theme.primary, borderColor: theme.primary },
    expand: { marginTop: 6 },
    miniLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: "700", marginTop: 10, marginBottom: 6 },
    pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pickChip: {
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background,
    },
    pickChipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    pickText: { fontSize: 11.5, fontWeight: "700", color: theme.textSecondary },
    pickTextOn: { color: "#fff" },
    unitRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    unitChip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background,
    },
    input: {
      borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: theme.textPrimary, backgroundColor: theme.background, marginTop: 6,
    },
    autoOk: { fontSize: 12, fontWeight: "700", color: MET_COLOR, marginTop: 8 },
    formBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
    cancelText: { fontSize: 12.5, fontWeight: "700", color: theme.textSecondary },
    addBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.primary },
    addBtnText: { fontSize: 12.5, fontWeight: "800", color: "#fff" },
    openForm: {
      borderWidth: 1, borderStyle: "dashed", borderColor: theme.border, borderRadius: 12,
      paddingVertical: 12, alignItems: "center", marginTop: 10,
    },
    openFormText: { fontSize: 12.5, fontWeight: "700", color: theme.primary },
    delBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    ownToggle: { marginTop: 6, alignSelf: "flex-start" },
    ownToggleText: { fontSize: 11.5, fontWeight: "700", color: theme.textSecondary },
    delText: { fontSize: 11, color: theme.textSecondary, fontWeight: "700" },
    localNote: { fontSize: 10.5, color: theme.textSecondary, marginTop: 8, lineHeight: 15 },
  });
}
