import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { DAYS, PERIODS, PERIOD_TIMES, type ClassSession, type Day, type Period } from "../../types/timetable";

const TIME_COL_WIDTH = 30;
const CELL_HEIGHT = 64;

interface TimeTableProps {
  sessions: ClassSession[];
  onPressSession?: (session: ClassSession) => void;
  onPressEmptyCell?: (day: Day, period: Period) => void;
}

export default function TimeTable({ sessions, onPressSession, onPressEmptyCell }: TimeTableProps) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - TIME_COL_WIDTH) / DAYS.length;

  function findSession(day: Day, period: Period) {
    return sessions.find((s) => s.day === day && s.period === period);
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.headerCell, { width: TIME_COL_WIDTH }]} />
        {DAYS.map((day) => (
          <View key={day} style={[styles.headerCell, { width: cellWidth }]}>
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
                  <TouchableOpacity
                    key={day}
                    style={[styles.cell, { width: cellWidth }]}
                    activeOpacity={session ? 1 : 0.6}
                    onPress={() => {
                      if (session) {
                        onPressSession?.(session);
                      } else {
                        onPressEmptyCell?.(day, period);
                      }
                    }}
                  >
                    {session && (
                      <View
                        style={[
                          styles.sessionCard,
                          { backgroundColor: `${session.color}22`, borderLeftColor: session.color },
                        ]}
                      >
                        <Text style={styles.sessionName} numberOfLines={2}>
                          {session.name}
                        </Text>
                        <Text style={styles.sessionTeacher} numberOfLines={1}>{session.teacher}</Text>
                        <Text style={styles.sessionRoom} numberOfLines={1}>{session.room}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  headerCell: {
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDEFF3",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  headerText: { fontSize: 11, fontWeight: "700", color: "#444" },
  timeCell: {
    height: CELL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDEFF3",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  timeStart: { fontSize: 7, color: "#888" },
  periodText: { fontSize: 10, color: "#333", fontWeight: "600", marginVertical: 1 },
  timeEnd: { fontSize: 7, color: "#888" },
  cell: {
    height: CELL_HEIGHT,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    padding: 2,
  },
  sessionCard: {
    flex: 1,
    backgroundColor: "#E7F0FF",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#2F6AD9",
    padding: 3,
  },
  sessionName: { fontSize: 9, fontWeight: "700", color: "#1A1A2E" },
  sessionTeacher: { fontSize: 8, color: "#555", marginTop: 1 },
  sessionRoom: { fontSize: 8, color: "#888" },
});
