import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";
import { GRAD_MASTERS, type GradMaster } from "../src/data/graduationMaster";

const MET_COLOR = "#1F9D6B";

// 卒業要件マジシャン（お試し版）。
// 便覧の区分別最低単位マスターを読み、各区分の取得単位を＋/−で入力。
// 「どの区分がどれだけ不足しているか」を最上部にまとめて表示する（不足優先ビュー）。
// Firestore・成績保存なし（クライアント計算のみ）。本格版はPhase 3（docs/CREDIT-TRACKING.md §7）。
export default function GraduationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [masterIdx, setMasterIdx] = useState(0);
  const master: GradMaster = GRAD_MASTERS[masterIdx];

  // 区分ごとの取得単位（お試し入力）。マスター切替時も同じidは引き継ぐ。
  const [acquired, setAcquired] = useState<Record<string, number>>({});

  function step(zoneId: string, delta: number) {
    setAcquired((prev) => {
      const next = Math.max(0, (prev[zoneId] ?? 0) + delta);
      return { ...prev, [zoneId]: next };
    });
  }

  // 区分ごとの判定（不足分 diff・充足 met）。
  const zoneRows = master.zones.map((z) => {
    const acq = acquired[z.id] ?? 0;
    const diff = Math.max(0, z.minUnits - acq);
    return { zone: z, acq, diff, met: diff === 0 };
  });

  const shortRows = zoneRows.filter((r) => !r.met).sort((a, b) => b.diff - a.diff);
  const totalAcquired = zoneRows.reduce((s, r) => s + r.acq, 0);
  const metCount = zoneRows.length - shortRows.length;
  const remaining = Math.max(0, master.totalRequired - totalAcquired);
  const pct = Math.min(100, Math.round((totalAcquired / master.totalRequired) * 100));

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
          <Text style={styles.subtitle}>{t("grad.subtitle")}</Text>
        </View>
        <View style={styles.expBadge}><Text style={styles.expBadgeText}>{t("grad.experiment")}</Text></View>
      </View>

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

        {/* サマリー */}
        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryLabel}>{t("grad.summaryLabel")}</Text>
            <Text style={styles.summaryNum}>
              <Text style={styles.summaryBig}>{totalAcquired}</Text> / {master.totalRequired} {t("grad.unit")}
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
                      {t("grad.shortByPrefix")} {r.diff} {t("grad.unit")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.shortNum}>
                  {r.acq} / {r.zone.minUnits} {t("grad.unit")}
                </Text>
                {r.zone.hintJa ? <Text style={styles.shortHint}>{r.zone.hintJa}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* 区分別ゲージ（取得単位の入力） */}
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
            </View>
          );
        })}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{t("grad.disclaimer")}</Text>
        </View>
      </ScrollView>
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
    summaryBarFill: { height: "100%", backgroundColor: theme.primary },
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
    zoneBarFill: { height: "100%" },
    zoneBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    zoneNum: { fontSize: 12.5, color: theme.textSecondary, fontWeight: "600" },
    stepper: { flexDirection: "row", gap: 8 },
    stepBtn: {
      width: 30, height: 30, borderRadius: 8, backgroundColor: theme.background,
      borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center",
    },
    stepBtnText: { fontSize: 16, fontWeight: "700", color: theme.primary },

    disclaimer: {
      backgroundColor: theme.accent + "14", borderRadius: 10, padding: 12, marginTop: 18,
    },
    disclaimerText: { fontSize: 11.5, color: theme.textSecondary, lineHeight: 17 },
  });
}
