import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { PRESET_COLORS, EXTRA_COLORS, type Day, type Period } from "../../types/timetable";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import { dayLabel } from "../../i18n/translations";
import type { Theme } from "../../theme/themes";

export interface SessionFormValue {
  name: string;
  teacher: string;
  room: string;
  color: string;
}

interface SessionFormModalProps {
  visible: boolean;
  day: Day | null;
  period: Period | null;
  initialValue?: SessionFormValue | null;
  onClose: () => void;
  onSubmit: (value: SessionFormValue) => void;
  onDelete?: () => void;
}

export default function SessionFormModal({
  visible,
  day,
  period,
  initialValue,
  onClose,
  onSubmit,
  onDelete,
}: SessionFormModalProps) {
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isEditing = !!initialValue;

  useEffect(() => {
    if (visible) {
      setName(initialValue?.name ?? "");
      setTeacher(initialValue?.teacher ?? "");
      setRoom(initialValue?.room ?? "");
      setColor(initialValue?.color ?? PRESET_COLORS[0]);
      setPaletteOpen(false);
    }
  }, [visible, initialValue]);

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), teacher: teacher.trim(), room: room.trim(), color });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {isEditing ? t("timetable.editTitle") : t("timetable.addTitle")}
              </Text>
              {day && period && (
                <Text style={styles.subtitle}>
                  {dayLabel(language, day)}{t("timetable.daySuffix")} ・ {period}{t("timetable.periodSuffix")}
                </Text>
              )}
            </View>
            {isEditing && (
              <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.deleteButtonText}>{t("common.delete")}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder={t("timetable.name")}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder={t("timetable.teacher")}
            placeholderTextColor={theme.textSecondary}
            value={teacher}
            onChangeText={setTeacher}
          />
          <TextInput
            style={styles.input}
            placeholder={t("timetable.room")}
            placeholderTextColor={theme.textSecondary}
            value={room}
            onChangeText={setRoom}
          />

          <Text style={styles.label}>{t("timetable.color")}</Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  color === c && styles.swatchSelected,
                ]}
                onPress={() => {
                  setColor(c);
                  setPaletteOpen(false);
                }}
              />
            ))}
            <TouchableOpacity
              style={[styles.swatch, styles.addSwatch]}
              onPress={() => setPaletteOpen((v) => !v)}
            >
              <Text style={styles.addSwatchText}>+</Text>
            </TouchableOpacity>
          </View>

          {paletteOpen && (
            <View style={styles.palette}>
              {EXTRA_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && styles.swatchSelected,
                  ]}
                  onPress={() => {
                    setColor(c);
                    setPaletteOpen(false);
                  }}
                />
              ))}
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, !name.trim() && styles.disabled]}
              onPress={handleSubmit}
              disabled={!name.trim()}
            >
              <Text style={styles.submitText}>{isEditing ? t("common.save") : t("common.add")}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: 300,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    title: { fontSize: 16, fontWeight: "700", color: theme.textPrimary },
    subtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2, marginBottom: 12 },
    deleteButton: {
      backgroundColor: theme.accent + "1A",
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    deleteButtonText: { color: theme.accent, fontSize: 12, fontWeight: "700" },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      marginBottom: 10,
    },
    label: { fontSize: 12, color: theme.textSecondary, marginBottom: 8, marginTop: 4 },
    colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchSelected: { borderColor: theme.textPrimary },
    addSwatch: {
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
    },
    addSwatchText: { fontSize: 16, color: theme.textSecondary, fontWeight: "700" },
    palette: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    buttonRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    button: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
    cancelButton: { backgroundColor: theme.background },
    cancelText: { color: theme.textSecondary, fontWeight: "600" },
    submitButton: { backgroundColor: theme.primary },
    disabled: { opacity: 0.5 },
    submitText: { color: "#fff", fontWeight: "700" },
  });
}
