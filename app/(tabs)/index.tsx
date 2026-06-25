import { View, Text, StyleSheet } from "react-native";
import { useTimetable } from "../../src/hooks/useTimetable";
import TimeTable from "../../src/components/timetable/TimeTable";

export default function HomeScreen() {
  const { sessions } = useTimetable();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>時間割</Text>
      <TimeTable sessions={sessions} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA", paddingTop: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#1A1A2E", paddingHorizontal: 16, marginBottom: 12 },
});
