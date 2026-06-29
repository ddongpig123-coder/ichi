import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useTimetable } from "../../src/hooks/useTimetable";
import TimeTable from "../../src/components/timetable/TimeTable";
import SessionFormModal, { type SessionFormValue } from "../../src/components/timetable/SessionFormModal";
import FriendsList from "../../src/components/friends/FriendsList";
import type { ClassSession, Day, Period } from "../../src/types/timetable";

export default function HomeScreen() {
  const { sessions, addSession, updateSession, removeSession } = useTimetable();
  const [target, setTarget] = useState<{ day: Day; period: Period; session?: ClassSession } | null>(null);

  function handleSubmit(value: SessionFormValue) {
    if (!target) return;
    if (target.session) {
      updateSession(target.session.id, value);
    } else {
      addSession({ id: `${Date.now()}`, day: target.day, period: target.period, ...value });
    }
    setTarget(null);
  }

  function handleDelete() {
    if (!target?.session) return;
    removeSession(target.session.id);
    setTarget(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TimeTable
          sessions={sessions}
          onPressEmptyCell={(day, period) => setTarget({ day, period })}
          onPressSession={(session) => setTarget({ day: session.day, period: session.period, session })}
        />

        <FriendsList />
      </ScrollView>

      <SessionFormModal
        visible={target !== null}
        day={target?.day ?? null}
        period={target?.period ?? null}
        initialValue={target?.session ?? null}
        onClose={() => setTarget(null)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  scrollContent: { paddingBottom: 24 },
});
