import { useRef, useState, type ElementRef } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from "react-native";
import { type Semester, getAvailableYears, isSemesterAvailable } from "../../data/semesterTimetables";

interface Props {
  selectedYear: number;
  selectedSemester: Semester;
  onChangeYear: (year: number) => void;
  onChangeSemester: (sem: Semester) => void;
}

export default function SemesterSelector({ selectedYear, selectedSemester, onChangeYear, onChangeSemester }: Props) {
  const availableYears = getAvailableYears();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const yearButtonRef = useRef<ElementRef<typeof TouchableOpacity>>(null);

  function handleYearPress() {
    yearButtonRef.current?.measure((_x: number, _y: number, _w: number, h: number, pageX: number, pageY: number) => {
      setDropdownPos({ top: pageY + h + 4, left: pageX });
      setPickerVisible(true);
    });
  }

  function selectYear(year: number) {
    setPickerVisible(false);
    onChangeYear(year);
    if (!isSemesterAvailable(year, selectedSemester)) {
      onChangeSemester("春");
    }
  }

  return (
    <View style={styles.bar}>
      <TouchableOpacity ref={yearButtonRef} style={styles.yearButton} onPress={handleYearPress}>
        <Text style={styles.yearText}>{selectedYear}年</Text>
        <Text style={styles.yearArrow}>▼</Text>
      </TouchableOpacity>

      <View style={styles.semesterToggle}>
        {(["春", "秋"] as Semester[]).map((sem) => {
          const available = isSemesterAvailable(selectedYear, sem);
          const active = selectedSemester === sem;
          return (
            <TouchableOpacity
              key={sem}
              style={[styles.semBtn, active && styles.semBtnActive, !available && styles.semBtnDisabled]}
              onPress={() => available && onChangeSemester(sem)}
              disabled={!available}
            >
              <Text style={[styles.semBtnText, active && styles.semBtnTextActive]}>{sem}学期</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={pickerVisible} transparent animationType="none" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPickerVisible(false)}>
          <View style={[styles.pickerBox, { position: "absolute", top: dropdownPos.top, left: dropdownPos.left }]}>
            {availableYears.map((year) => (
              <TouchableOpacity
                key={year}
                style={[styles.pickerItem, selectedYear === year && styles.pickerItemActive]}
                onPress={() => selectYear(year)}
              >
                <Text style={[styles.pickerItemText, selectedYear === year && styles.pickerItemTextActive]}>
                  {year}年
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    gap: 12,
  },
  yearButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  yearText: { fontSize: 15, fontWeight: "700", color: "#2F6AD9" },
  yearArrow: { fontSize: 10, color: "#2F6AD9" },
  semesterToggle: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0D8E8",
    overflow: "hidden",
  },
  semBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#fff" },
  semBtnActive: { backgroundColor: "#2F6AD9" },
  semBtnDisabled: { opacity: 0.3 },
  semBtnText: { fontSize: 13, fontWeight: "600", color: "#555" },
  semBtnTextActive: { color: "#fff" },
  overlay: { flex: 1, backgroundColor: "transparent" },
  pickerBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  pickerItemActive: { backgroundColor: "#F0F4FF" },
  pickerItemText: { fontSize: 16, color: "#333", textAlign: "center" },
  pickerItemTextActive: { color: "#2F6AD9", fontWeight: "700" },
});
