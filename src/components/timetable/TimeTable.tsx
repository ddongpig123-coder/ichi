import { View, Text, ScrollView, StyleSheet } from "react-native";
import { DAYS, PERIODS, PERIOD_TIMES, type ClassSession, type Day, type Period } from "../../types/timetable";

const CELL_WIDTH = 96;
const TIME_COL_WIDTH = 48;
const CELL_HEIGHT = 76;

interface TimeTableProps {
  sessions: ClassSession[];
  onPressSession?: (session: ClassSession) => void;
}

export default function TimeTable({ sessions, onPressSession }: TimeTableProps) {
  function findSession(day: Day, period: Period) {
    return sessions.find((s) => s.day === day && s.period === period);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.row}>
          <View style={[styles.headerCell, { width: TIME_COL_WIDTH }]} />
          {DAYS.map((day) => (
            <View key={day} style={[styles.headerCell, { width: CELL_WIDTH }]}>
              <Text style={styles.headerText}>{day}</Text>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {PERIODS.map((period) => {
            const time = PERIOD_TIMES[period];
            return (
              <View key={period} style={styles.row}>
                <View style={[styles.timeCell, { width: TIME_COL_WIDTH }]}>
                  <Text style={styles.timeStart}>{time.start}</Text>
                  <Text style={styles.periodText}>{period}限</Text>
                  <Text style={styles.timeEnd}>{time.end}</Text>
                </View>
                {DAYS.map((day) => {
                  const session = findSession(day, period);
                  return (
                    <View key={day} style={[styles.cell, { width: CELL_WIDTH }]}>
                      {session && (
                        <View
                          style={styles.sessionCard}
                          onTouchEnd={() => onPressSession?.(session)}
                        >
                          <Text style={styles.sessionName} numberOfLines={2}>
                            {session.name}
                          </Text>
                          <Text style={styles.sessionTeacher}>{session.teacher}</Text>
                          <Text style={styles.sessionRoom}>{session.room}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  headerCell: {
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDEFF3",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  headerText: { fontSize: 13, fontWeight: "700", color: "#444" },
  timeCell: {
    height: CELL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDEFF3",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  timeStart: { fontSize: 9, color: "#888" },
  periodText: { fontSize: 12, color: "#333", fontWeight: "600", marginVertical: 2 },
  timeEnd: { fontSize: 9, color: "#888" },
  cell: {
    height: CELL_HEIGHT,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    padding: 3,
  },
  sessionCard: {
    flex: 1,
    backgroundColor: "#E7F0FF",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#2F6AD9",
    padding: 5,
  },
  sessionName: { fontSize: 11, fontWeight: "700", color: "#1A1A2E" },
  sessionTeacher: { fontSize: 10, color: "#555", marginTop: 2 },
  sessionRoom: { fontSize: 10, color: "#888" },
});
