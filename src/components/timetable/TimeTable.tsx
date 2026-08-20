import { useMemo, useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, Modal, Pressable,
} from "react-native";
import { DAYS, PERIODS, PERIOD_TIMES, type ClassSession, type Day, type Period } from "../../types/timetable";
import { useFriends, type Friend } from "../../contexts/FriendsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import { dayLabel } from "../../i18n/translations";
import type { Theme } from "../../theme/themes";
import DefaultAvatar from "../common/DefaultAvatar";

const TIME_COL_WIDTH = 30;
const HEADER_HEIGHT = 24;

interface TimeTableProps {
  sessions: ClassSession[];
  onPressSession?: (session: ClassSession) => void;
  onPressEmptyCell?: (day: Day, period: Period) => void;
  cellHeight?: number;
  friendOverlaps?: Record<string, string[]>;
}

function SessionCard({
  session,
  day,
  period,
  cellHeight,
  friendOverlaps,
  onPress,
  onShowFriendList,
}: {
  session: ClassSession;
  day: Day;
  period: Period;
  cellHeight: number;
  friendOverlaps?: Record<string, string[]>;
  onPress?: () => void;
  onShowFriendList: (friends: Friend[]) => void;
}) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { allFriends } = useFriends();

  const key = `${day}-${period}`;
  const overlappingFriends = (friendOverlaps?.[key] ?? [])
    .map((id) => allFriends.find((f) => f.id === id))
    .filter(Boolean) as Friend[];

  const firstFriend = overlappingFriends[0];
  const hasMultiple = overlappingFriends.length > 1;

  function handleAvatarPress() {
    if (!firstFriend) return;
    onShowFriendList(overlappingFriends);
  }

  return (
    <TouchableOpacity
      style={[styles.cell, { height: cellHeight }]}
      activeOpacity={1}
      onPress={onPress}
    >
      <View style={[styles.sessionCard, { backgroundColor: `${session.color}22`, borderLeftColor: session.color }]}>
        {tooltip && (
          <View style={styles.tooltip} pointerEvents="none">
            <Text style={styles.tooltipText} numberOfLines={1}>{tooltip}</Text>
          </View>
        )}

        <View style={firstFriend ? styles.textAreaWithAvatar : undefined}>
          <Text style={styles.sessionName} numberOfLines={2}>{session.name}</Text>
          <Text style={styles.sessionTeacher} numberOfLines={1}>{session.teacher}</Text>
          <Text style={styles.sessionRoom} numberOfLines={1}>{session.room}</Text>
        </View>

        {firstFriend && (
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={(e) => { e.stopPropagation?.(); handleAvatarPress(); }}
            activeOpacity={0.7}
          >
            <DefaultAvatar size={18} />
            {hasMultiple && (
              <View style={styles.plusBadge}>
                <Text style={styles.plusText}>+</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TimeTable({
  sessions, onPressSession, onPressEmptyCell, cellHeight, friendOverlaps,
}: TimeTableProps) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - TIME_COL_WIDTH) / DAYS.length;
  const CELL_HEIGHT = cellHeight ?? 64;
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [friendListModal, setFriendListModal] = useState<Friend[] | null>(null);

  function findSession(day: Day, period: Period) {
    return sessions.find((s) => s.day === day && s.period === period);
  }

  return (
    <View>
      {/* 友達リストポップアップ */}
      <Modal
        visible={friendListModal !== null}
        transparent
        animationType="none"
        onRequestClose={() => setFriendListModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFriendListModal(null)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t("home.overlapPopupTitle")}</Text>
            {friendListModal?.map((friend) => (
              <View key={friend.id} style={styles.modalRow}>
                <DefaultAvatar size={28} />
                <Text style={styles.modalNickname}>{friend.nickname}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ヘッダー */}
      <View style={styles.row}>
        <View style={[styles.headerCell, { width: TIME_COL_WIDTH }]} />
        {DAYS.map((day) => (
          <View key={day} style={[styles.headerCell, { width: cellWidth }]}>
            <Text style={styles.headerText}>{dayLabel(language, day)}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {PERIODS.map((period) => {
          const time = PERIOD_TIMES[period];
          return (
            <View key={period} style={styles.row}>
              <View style={[styles.timeCell, { width: TIME_COL_WIDTH, height: CELL_HEIGHT }]}>
                <Text style={styles.timeStart}>{time.start}</Text>
                <Text style={styles.periodText}>{period}{t("timetable.periodSuffix")}</Text>
                <Text style={styles.timeEnd}>{time.end}</Text>
              </View>
              {DAYS.map((day) => {
                const session = findSession(day, period);
                if (session) {
                  return (
                    <View key={day} style={{ width: cellWidth }}>
                      <SessionCard
                        session={session}
                        day={day}
                        period={period}
                        cellHeight={CELL_HEIGHT}
                        friendOverlaps={friendOverlaps}
                        onPress={() => onPressSession?.(session)}
                        onShowFriendList={setFriendListModal}
                      />
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.cell, { width: cellWidth, height: CELL_HEIGHT }]}
                    activeOpacity={0.6}
                    onPress={() => onPressEmptyCell?.(day, period)}
                  />
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: "row" },
    headerCell: {
      height: HEADER_HEIGHT,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    headerText: { fontSize: 11, fontWeight: "700", color: theme.textSecondary },
    timeCell: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    timeStart: { fontSize: 7, color: theme.textSecondary },
    periodText: { fontSize: 10, color: theme.textPrimary, fontWeight: "600", marginVertical: 1 },
    timeEnd: { fontSize: 7, color: theme.textSecondary },
    cell: {
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 2,
    },
    sessionCard: {
      flex: 1,
      borderRadius: 4,
      borderLeftWidth: 3,
      padding: 3,
    },
    sessionName: { fontSize: 9, fontWeight: "700", color: theme.textPrimary },
    sessionTeacher: { fontSize: 8, color: theme.textSecondary, marginTop: 1 },
    sessionRoom: { fontSize: 8, color: theme.textSecondary },

    avatarWrapper: {
      position: "absolute",
      bottom: 3,
      right: 3,
    },
    plusBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    plusText: { fontSize: 8, color: "#fff", fontWeight: "700", lineHeight: 10 },

    textAreaWithAvatar: { paddingRight: 20 },
    tooltip: {
      position: "absolute",
      top: 2,
      left: 2,
      right: 2,
      backgroundColor: "rgba(0,0,0,0.65)",
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      zIndex: 10,
    },
    tooltipText: { fontSize: 9, color: "#fff", fontWeight: "600", textAlign: "center" },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalBox: {
      backgroundColor: theme.card,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 20,
      minWidth: 200,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    modalTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 12,
      textAlign: "center",
    },
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    modalNickname: { fontSize: 13, color: theme.textPrimary, fontWeight: "600" },
  });
}
