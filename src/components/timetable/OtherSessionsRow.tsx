import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClassSession } from "../../types/timetable";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

// ============================================================
// 時間割の表の下に出す「その他」欄（I-8, 2026-11-20）。
// 曜日・時限の決まっていない授業（集中講義・オンデマンド・メディア〔M〕）は表のマスに
// 置けないので、ここにチップで並べる。タップで編集、＋で追加。
// 空のときは 1 行の静かな入口だけ（表の高さを奪わないよう高さは固定）。
// ============================================================

export const OTHER_ROW_HEIGHT = 36;

interface Props {
  sessions: ClassSession[]; // その他の授業だけ（otherSessions() で絞ったもの）
  onPressSession: (session: ClassSession) => void;
  onAdd: () => void;
}

export default function OtherSessionsRow({ sessions, onPressSession, onAdd }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (sessions.length === 0) {
    return (
      <TouchableOpacity style={styles.row} onPress={onAdd} accessibilityRole="button" activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={15} color={theme.textSecondary} />
        <Text style={styles.addText} numberOfLines={1}>{t("timetable.otherAdd")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t("timetable.otherTitle")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {sessions.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, { borderLeftColor: s.color, backgroundColor: `${s.color}22` }]}
            onPress={() => onPressSession(s)}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text style={styles.chipText} numberOfLines={1}>{s.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addChip}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t("timetable.otherAddTitle")}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      height: OTHER_ROW_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    addText: { fontSize: 12, color: theme.textSecondary, flexShrink: 1 },
    label: { fontSize: 11, fontWeight: "700", color: theme.textSecondary },
    chips: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 12 },
    chip: {
      maxWidth: 160,
      borderLeftWidth: 3,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    chipText: { fontSize: 11, fontWeight: "700", color: theme.textPrimary },
    addChip: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
