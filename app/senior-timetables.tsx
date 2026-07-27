import { useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList,
  ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import { getUserProfile } from "../src/services/userService";
import {
  listDepartmentTimetables,
  gradeFromAdmissionYear,
  type SeniorTimetable,
} from "../src/services/timetableService";
import TimeTable from "../src/components/timetable/TimeTable";
import DefaultAvatar from "../src/components/common/DefaultAvatar";
import type { Theme } from "../src/theme/themes";

// ============================================================
// 先輩の時間割 閲覧（Phase 2 2週目）
// 同じ学部の「公開/学部公開」時間割をリスト表示し、学年で絞り込む。
// - 候補列挙は usersPublic(学部で絞る) → 各自の時間割を get（非公開は自動スキップ）。
//   規則デプロイ不要（usersPublic は list 可、時間割 get は visibility でゲート済み）。
// - 学年は入学年度(admissionYear)から派生（単一ソース・gardrail §6-3）。
// - 対象学期は呼び出し元（ホーム）から year / semester で受け取る。
// ============================================================

export default function SeniorTimetablesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ year?: string; semester?: string }>();
  const year = params.year ?? `${new Date().getFullYear()}`;
  const semester = params.semester ?? "春";
  const semesterKey = `${year}-${semester}`;

  const [loading, setLoading] = useState(true);
  const [myDepartment, setMyDepartment] = useState<string | null>(null);
  const [items, setItems] = useState<SeniorTimetable[]>([]);
  const [gradeFilter, setGradeFilter] = useState<number | null>(null); // null = 全学年
  const [viewing, setViewing] = useState<SeniorTimetable | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    getUserProfile(user.uid)
      .then(async (p) => {
        if (cancelled) return;
        setMyDepartment(p?.department ?? null);
        if (!p?.department) {
          setItems([]);
          return;
        }
        const list = await listDepartmentTimetables(
          { uid: user.uid, department: p.department, schoolDomain: p.schoolDomain ?? null },
          semesterKey
        );
        if (!cancelled) setItems(list);
      })
      .catch((e) => console.warn("senior timetables load failed:", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, semesterKey]);

  // リストに存在する学年（重複排除・昇順）。フィルタチップに使う。
  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    for (const it of items) {
      const g = gradeFromAdmissionYear(it.admissionYear);
      if (g != null) set.add(g);
    }
    return [...set].sort((a, b) => a - b);
  }, [items]);

  const filtered = useMemo(() => {
    if (gradeFilter == null) return items;
    return items.filter((it) => gradeFromAdmissionYear(it.admissionYear) === gradeFilter);
  }, [items, gradeFilter]);

  function gradeLabel(it: SeniorTimetable): string {
    const g = gradeFromAdmissionYear(it.admissionYear);
    return g != null ? `${g}${t("profile.gradeSuffix")}` : t("senior.gradeUnknown");
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
        <Text style={styles.headerTitle}>{t("senior.title")}</Text>
        <Text style={styles.semesterBadge}>{`${year} ${semester}`}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : !myDepartment ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("senior.noDepartment")}</Text>
          <TouchableOpacity style={styles.goBtn} onPress={() => router.replace("/(tabs)/profile")}>
            <Text style={styles.goBtnText}>{t("senior.goProfile")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* 学部 + 学年フィルタ */}
          <Text style={styles.deptLine}>{myDepartment}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label={t("senior.gradeAll")}
              active={gradeFilter == null}
              onPress={() => setGradeFilter(null)}
              styles={styles}
            />
            {availableGrades.map((g) => (
              <FilterChip
                key={g}
                label={`${g}${t("profile.gradeSuffix")}`}
                active={gradeFilter === g}
                onPress={() => setGradeFilter(g)}
                styles={styles}
              />
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t("senior.empty")}</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(it) => it.uid}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.card} onPress={() => setViewing(item)}>
                  <DefaultAvatar size={40} />
                  <View style={styles.cardTexts}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.nickname || t("friends.unknownUser")}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {gradeLabel(item)} · {item.sessions.length}{t("senior.courseCountSuffix")}
                    </Text>
                  </View>
                  <Text style={styles.cardChevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      {/* 読み取り専用ビューア（RN Web の Modal は animationType 付きだと visible=false で
          閉じないことがあるため "none" 固定。VisibilitySelector と同じ対応） */}
      <Modal
        visible={viewing !== null}
        animationType="none"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setViewing(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {viewing?.nickname || t("friends.unknownUser")}
            </Text>
            <Text style={styles.semesterBadge}>{viewing ? gradeLabel(viewing) : ""}</Text>
          </View>
          {viewing && <TimeTable sessions={viewing.sessions} cellHeight={58} />}
        </View>
      </Modal>
    </View>
  );
}

function FilterChip({
  label, active, onPress, styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
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
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary, flex: 1, textAlign: "center" },
    semesterBadge: { fontSize: 13, color: theme.textSecondary, width: 60, textAlign: "right" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 14 },
    emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
    goBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.primary,
    },
    goBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    deptLine: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textPrimary,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    filterScroll: { flexGrow: 0 },
    filterRow: { paddingHorizontal: 12, gap: 8, paddingVertical: 8, alignItems: "center" },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { fontSize: 13, color: theme.textPrimary },
    chipTextOn: { color: "#FFFFFF", fontWeight: "600" },
    listContent: { padding: 12, gap: 8 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTexts: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    cardMeta: { fontSize: 12.5, color: theme.textSecondary, marginTop: 2 },
    cardChevron: { fontSize: 22, color: theme.textSecondary },
  });
}
