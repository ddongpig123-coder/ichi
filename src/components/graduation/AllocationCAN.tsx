import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Theme } from "../../theme/themes";
import type { TranslationKey } from "../../i18n/translations";
import type { AllocCourse } from "../../data/allocationInterdisciplinaryMath";

interface Props {
  theme: Theme;
  t: (key: TranslationKey) => string;
  courses: AllocCourse[];      // 選択中の学科の配当科目
  grade: number;               // 現在の学年
  zones: { id: string; nameJa: string }[]; // 表示する区分（順序）
  gakkaFilter?: string | null; // 学科専門を所属学科で絞る（経営）。他学科のgakka付き科目は隠す
}

// CAN: 選択中の学年に配当されている科目を区分別に表示（便覧 科目配当表より・参考）。
export function AllocationCAN(p: Props) {
  const { theme, t, courses, grade, zones, gakkaFilter } = p;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const atGrade = courses.filter(
    (c) => c.years.includes(grade) && (!gakkaFilter || !c.gakka || c.gakka === gakkaFilter),
  );

  return (
    <View>
      <Text style={styles.byYearNote}>{t("grad.canByYearNote")}</Text>
      {zones.map((z) => {
        const list = atGrade.filter((c) => c.zone === z.id);
        return (
          <View key={z.id} style={styles.zoneBlock}>
            <View style={styles.zoneHeadRow}>
              <Text style={styles.zoneHead}>{z.nameJa}</Text>
              <Text style={styles.zoneCount}>{list.length}</Text>
            </View>
            {list.length === 0 ? (
              <Text style={styles.empty}>{t("grad.canZoneEmpty")}</Text>
            ) : (
              <View style={styles.wrap}>
                {list.map((c, i) => (
                  <View key={`${c.name}-${i}`} style={styles.chip}>
                    {c.mark ? (
                      <View style={[styles.mark, c.mark === "必修" ? styles.markHisshu : styles.markSen]}>
                        <Text style={[styles.markText, c.mark === "必修" ? styles.markTextHisshu : styles.markTextSen]}>
                          {c.mark === "必修" ? t("grad.markHisshu") : t("grad.markSenhisshu")}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.chipName}>{c.name}</Text>
                    <Text style={styles.chipUnits}>{c.units}</Text>
                    {c.media ? <Text style={styles.media}>M</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <Text style={styles.note}>{t("grad.canAllocNote")}</Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    byYearNote: { fontSize: 11.5, color: theme.textSecondary, marginTop: 4, marginBottom: 6, lineHeight: 16 },
    zoneBlock: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
      padding: 12, marginTop: 8,
    },
    zoneHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    zoneHead: { fontSize: 13, fontWeight: "800", color: theme.textPrimary },
    zoneCount: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    empty: { fontSize: 11.5, color: theme.textSecondary },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    },
    chipName: { fontSize: 11.5, color: theme.textPrimary, fontWeight: "600" },
    chipUnits: { fontSize: 10.5, color: theme.textSecondary, fontWeight: "700" },
    mark: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
    markHisshu: { backgroundColor: theme.accent + "26" },
    markSen: { backgroundColor: theme.primary + "22" },
    markText: { fontSize: 9, fontWeight: "800" },
    markTextHisshu: { color: theme.accent },
    markTextSen: { color: theme.primary },
    media: { fontSize: 9, fontWeight: "800", color: theme.primary },
    note: { fontSize: 11, color: theme.textSecondary, marginTop: 12, lineHeight: 16 },
  });
}
