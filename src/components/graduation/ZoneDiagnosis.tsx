import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Theme } from "../../theme/themes";
import type { TranslationKey } from "../../i18n/translations";
import type { ResolvedMaster } from "../../data/facultyMasters";
import { calcZonesOnly } from "../../utils/gradCalc";

const MET_COLOR = "#1F9D6B";

interface Props {
  theme: Theme;
  t: (key: TranslationKey) => string;
  master: ResolvedMaster;
  baseline: Record<string, number>;
  onStep: (zoneId: string, delta: number) => void;
}

// 区分(領域)のみの診断（配当表の無い学部用。商学部以外の9学部）。
// 成績表を見て区分ごとに ＋/− で単位を入力 → 不足区分を優先表示。
export function ZoneDiagnosis(p: Props) {
  const { theme, t, master, baseline, onStep } = p;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const calc = calcZonesOnly(master, baseline);
  const rows = master.zones.map((z) => {
    const zc = calc.zones[z.id];
    const acq = zc?.counted ?? 0;
    return {
      zone: z, acq, met: zc?.met ?? false,
      diff: Math.max(0, z.minUnits - acq), overflow: zc?.overflow ?? 0,
    };
  });
  const shortRows = rows.filter((r) => !r.met).sort((a, b) => b.diff - a.diff);
  const total = calc.total;
  const remaining = Math.max(0, master.totalRequired - total);
  const pct = Math.min(100, Math.round((total / master.totalRequired) * 100));

  return (
    <View>
      {/* サマリー */}
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryLabel}>{t("grad.summaryLabel")}</Text>
          <Text style={styles.summaryNum}>
            <Text style={styles.summaryBig}>{total}</Text> / {master.totalRequired} {t("grad.unit")}
          </Text>
        </View>
        <View style={styles.summaryBar}>
          <View style={[styles.summaryBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.summaryHint}>
          {t("grad.remaining")}: {remaining} {t("grad.unit")} · {t("grad.short")}: {shortRows.length}/{master.zones.length}
        </Text>
      </View>

      {/* 不足している区分（最重要ビュー） */}
      {shortRows.length === 0 ? (
        <View style={styles.allMet}>
          <Text style={styles.allMetText}>{t("grad.allMet")}</Text>
        </View>
      ) : (
        <View style={styles.shortCard}>
          <Text style={styles.shortHeading}>{t("grad.shortHeading")} · {shortRows.length}</Text>
          <Text style={styles.shortIntro}>{t("grad.shortIntro")}</Text>
          {shortRows.map((r) => (
            <View key={r.zone.id} style={styles.shortItem}>
              <View style={styles.shortItemTop}>
                <Text style={styles.shortName}>{r.zone.nameJa}</Text>
                <View style={styles.shortBadge}>
                  <Text style={styles.shortBadgeText}>
                    {t("grad.shortByPrefix")} {r.diff} {t("grad.unit")}
                  </Text>
                </View>
              </View>
              <Text style={styles.shortNum}>{r.acq} / {r.zone.minUnits} {t("grad.unit")}</Text>
              {r.zone.hintJa ? <Text style={styles.shortHint}>{r.zone.hintJa}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* 区分別ゲージ（成績表の合計を ＋/− で入力） */}
      <Text style={styles.inputHeading}>{t("grad.inputHeading")}</Text>
      <Text style={styles.stepHint}>{t("grad.stepHint")}</Text>
      {rows.map((r) => {
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
              <View style={[styles.zoneBarFill, { width: `${w}%`, backgroundColor: r.met ? MET_COLOR : theme.accent }]} />
            </View>
            <View style={styles.zoneBottom}>
              <Text style={styles.zoneNum}>{r.acq} / {z.minUnits} {t("grad.unit")}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(z.id, -1)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(z.id, 1)}>
                  <Text style={styles.stepBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
            {r.overflow > 0 ? (
              <Text style={styles.zoneSub}>{t("grad.rec.overflow")} {r.overflow} {t("grad.unit")}</Text>
            ) : null}
            {z.hintJa && r.met ? <Text style={styles.zoneSub}>{z.hintJa}</Text> : null}
          </View>
        );
      })}

      <View style={styles.todoNote}>
        <Text style={styles.todoText}>{t("grad.zonesTodo")}</Text>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
    summaryHint: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },

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
    zoneName: { fontSize: 13.5, fontWeight: "700", color: theme.textPrimary, flex: 1, paddingRight: 8 },
    chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
    chipOk: { backgroundColor: MET_COLOR + "22" },
    chipShort: { backgroundColor: theme.accent + "22" },
    chipText: { fontSize: 10.5, fontWeight: "700" },
    chipTextOk: { color: MET_COLOR },
    chipTextShort: { color: theme.accent },
    zoneBar: { height: 8, borderRadius: 5, backgroundColor: theme.border, overflow: "hidden" },
    zoneBarFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
    zoneSub: { fontSize: 11, color: theme.textSecondary, marginTop: 5 },
    zoneBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    zoneNum: { fontSize: 12.5, color: theme.textSecondary, fontWeight: "600" },
    stepper: { flexDirection: "row", gap: 8 },
    stepBtn: {
      width: 30, height: 30, borderRadius: 8, backgroundColor: theme.background,
      borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center",
    },
    stepBtnText: { fontSize: 16, fontWeight: "700", color: theme.primary },

    todoNote: {
      backgroundColor: theme.accent + "10", borderRadius: 10, padding: 12, marginTop: 16,
    },
    todoText: { fontSize: 11.5, color: theme.textSecondary, lineHeight: 17 },
  });
}
