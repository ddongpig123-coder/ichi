import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";
import type { TranslationKey } from "../../i18n/translations";
import type { TimetableVisibility } from "../../services/timetableService";

// 時間割の公開範囲を選ぶピル + モーダル（Phase 2 1週目）
// 保存は呼び出し側（ホーム画面）が setTimetableVisibility で行う。ここは選択UIのみ。

interface Props {
  value: TimetableVisibility;
  onChange: (v: TimetableVisibility) => void;
}

const OPTIONS: {
  key: TimetableVisibility;
  icon: string;
  label: TranslationKey;
  desc: TranslationKey;
}[] = [
  { key: "private", icon: "🔒", label: "timetable.visPrivate", desc: "timetable.visPrivateDesc" },
  { key: "friends", icon: "👥", label: "timetable.visFriends", desc: "timetable.visFriendsDesc" },
];

export default function VisibilitySelector({ value, onChange }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  const current = OPTIONS.find((o) => o.key === value) ?? OPTIONS[1];

  function select(v: TimetableVisibility) {
    setOpen(false);
    if (v !== value) onChange(v);
  }

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={() => setOpen(true)}>
        <Text style={styles.pillIcon}>{current.icon}</Text>
        <Text style={styles.pillText} numberOfLines={1}>
          {t(current.label)}
        </Text>
        <Text style={styles.pillArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>{t("timetable.visibilityTitle")}</Text>
            <Text style={styles.hint}>{t("timetable.visibilityHint")}</Text>
            {OPTIONS.map((o) => {
              const active = o.key === value;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => select(o.key)}
                >
                  <Text style={styles.rowIcon}>{o.icon}</Text>
                  <View style={styles.rowTexts}>
                    <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{t(o.label)}</Text>
                    <Text style={styles.rowDesc}>{t(o.desc)}</Text>
                  </View>
                  {active && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary + "1A",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 5,
      maxWidth: 150,
    },
    pillIcon: { fontSize: 13 },
    pillText: { fontSize: 13, fontWeight: "700", color: theme.primary, flexShrink: 1 },
    pillArrow: { fontSize: 9, color: theme.primary },

    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    sheet: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 18,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 20,
      elevation: 12,
    },
    title: { fontSize: 17, fontWeight: "800", color: theme.textPrimary },
    hint: { fontSize: 13, color: theme.textSecondary, marginTop: 4, marginBottom: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 12,
    },
    rowActive: { backgroundColor: theme.primary + "14" },
    rowIcon: { fontSize: 20 },
    rowTexts: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    rowLabelActive: { color: theme.primary },
    rowDesc: { fontSize: 12.5, color: theme.textSecondary, marginTop: 2 },
    check: { fontSize: 17, fontWeight: "800", color: theme.primary },
  });
}
