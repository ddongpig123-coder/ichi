import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Theme } from "../../theme/themes";
import type { TranslationKey } from "../../i18n/translations";
import type { RequiredCourse } from "../../data/requiredCoursesLaw";

interface Props {
  theme: Theme;
  t: (key: TranslationKey) => string;
  courses: RequiredCourse[];
  zones: { id: string; nameJa: string }[]; // zone id → 表示名
}

// 必修科目チェックリスト（配当表が整備済みの学部）。区分別にまとめ、学年バッジ・コース別タグを表示。
export function RequiredCourses(p: Props) {
  const { theme, t, courses, zones } = p;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.nameJa ?? id;
  const zoneOrder = Array.from(new Set(courses.map((c) => c.zone)));
  const yearLabel = (ys: number[]) => ys.map((y) => `${y}年`).join("・");

  return (
    <View>
      <Text style={styles.heading}>{t("grad.reqHeading")}</Text>
      <Text style={styles.intro}>{t("grad.reqIntro")}</Text>
      {zoneOrder.map((zid) => {
        const list = courses.filter((c) => c.zone === zid);
        const units = list.reduce((s, c) => s + c.units, 0);
        return (
          <View key={zid} style={styles.block}>
            <View style={styles.blockTop}>
              <Text style={styles.blockName}>{zoneName(zid)}</Text>
              <Text style={styles.blockUnits}>{units}{t("grad.unit")}</Text>
            </View>
            {list.map((c, i) => (
              <View key={`${c.name}-${i}`} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={2}>{c.name}</Text>
                {c.courseTag ? (
                  <View style={styles.tag}><Text style={styles.tagText}>{c.courseTag.replace("コース", "")} {t("grad.reqCourseOnly")}</Text></View>
                ) : null}
                <View style={styles.yearBadge}><Text style={styles.yearText}>{yearLabel(c.years)}</Text></View>
                <Text style={styles.rowUnits}>{c.units}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    heading: { fontSize: 13, color: theme.textPrimary, fontWeight: "800", marginTop: 26 },
    intro: { fontSize: 11.5, color: theme.textSecondary, marginTop: 4, lineHeight: 16 },
    block: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
      padding: 12, marginTop: 8,
    },
    blockTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    blockName: { fontSize: 13, fontWeight: "800", color: theme.textPrimary },
    blockUnits: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    row: {
      flexDirection: "row", alignItems: "center", gap: 6,
      borderTopWidth: 1, borderTopColor: theme.border, paddingVertical: 7,
    },
    rowName: { flex: 1, fontSize: 12.5, color: theme.textPrimary, fontWeight: "600" },
    tag: { backgroundColor: theme.accent + "1E", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
    tagText: { fontSize: 9, fontWeight: "800", color: theme.accent },
    yearBadge: { backgroundColor: theme.primary + "1E", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    yearText: { fontSize: 10, fontWeight: "800", color: theme.primary },
    rowUnits: { fontSize: 11.5, color: theme.textSecondary, fontWeight: "700", width: 16, textAlign: "right" },
  });
}
