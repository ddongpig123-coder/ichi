import { useEffect, useState } from "react";
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
              <Text style={styles.title}>{isEditing ? "講義を編集" : "講義を追加"}</Text>
              {day && period && (
                <Text style={styles.subtitle}>{day}曜日 ・ {period}限</Text>
              )}
            </View>
            {isEditing && (
              <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.deleteButtonText}>削除</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="講義名"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="担当教授"
            placeholderTextColor="#aaa"
            value={teacher}
            onChangeText={setTeacher}
          />
          <TextInput
            style={styles.input}
            placeholder="教室"
            placeholderTextColor="#aaa"
            value={room}
            onChangeText={setRoom}
          />

          <Text style={styles.label}>カラー</Text>
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
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, !name.trim() && styles.disabled]}
              onPress={handleSubmit}
              disabled={!name.trim()}
            >
              <Text style={styles.submitText}>{isEditing ? "保存" : "追加"}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: 300,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1A1A2E" },
  subtitle: { fontSize: 12, color: "#888", marginTop: 2, marginBottom: 12 },
  deleteButton: {
    backgroundColor: "#FDECEC",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButtonText: { color: "#E2574C", fontSize: 12, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 10,
  },
  label: { fontSize: 12, color: "#888", marginBottom: 8, marginTop: 4 },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: { borderColor: "#1A1A2E" },
  addSwatch: {
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  addSwatchText: { fontSize: 16, color: "#888", fontWeight: "700" },
  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelButton: { backgroundColor: "#F0F0F0" },
  cancelText: { color: "#666", fontWeight: "600" },
  submitButton: { backgroundColor: "#2F6AD9" },
  disabled: { opacity: 0.5 },
  submitText: { color: "#fff", fontWeight: "700" },
});
