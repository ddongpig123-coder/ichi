import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, Modal, Pressable, Animated, Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  // 編集モード（2026-11-28 ユーザー要望: スマホのホーム画面のように、長押し → × で消す）
  editMode?: boolean;
  onLongPressSession?: (session: ClassSession) => void;
  onDeleteSession?: (session: ClassSession) => void;
}

// 編集モード中の小さな揺れ（ホーム画面のアプリ整理と同じ合図）。ネイティブドライバで軽く
function useWiggle(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { v.stopAnimation(); v.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 110, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(v, { toValue: -1, duration: 220, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 110, easing: Easing.linear, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v.interpolate({ inputRange: [-1, 1], outputRange: ["-1.6deg", "1.6deg"] });
}

function SessionCard({
  session,
  day,
  period,
  cellHeight,
  friendOverlaps,
  onPress,
  onShowFriendList,
  editMode,
  onLongPress,
  onDelete,
}: {
  session: ClassSession;
  day: Day;
  period: Period;
  cellHeight: number;
  friendOverlaps?: Record<string, string[]>;
  onPress?: () => void;
  onShowFriendList: (friends: Friend[]) => void;
  editMode?: boolean;
  onLongPress?: () => void;
  onDelete?: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rotate = useWiggle(!!editMode);
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
      activeOpacity={editMode ? 1 : 0.7}
      onPress={editMode ? undefined : onPress}
      onLongPress={editMode ? undefined : onLongPress}
      delayLongPress={400}
    >
      <Animated.View
        style={[
          styles.sessionCard,
          { backgroundColor: `${session.color}22`, borderLeftColor: session.color },
          editMode && { transform: [{ rotate }] },
        ]}
      >
        <View style={firstFriend ? styles.textAreaWithAvatar : undefined}>
          <Text style={styles.sessionName} numberOfLines={2}>{session.name}</Text>
          <Text style={styles.sessionTeacher} numberOfLines={1}>{session.teacher}</Text>
          <Text style={styles.sessionRoom} numberOfLines={1}>{session.room}</Text>
        </View>

        {firstFriend && !editMode && (
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
      </Animated.View>
      {editMode && (
        <TouchableOpacity
          style={styles.deleteBadge}
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`${session.name} ${t("timetable.deleteSession")}`}
        >
          <Ionicons name="close" size={12} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function TimeTable({
  sessions, onPressSession, onPressEmptyCell, cellHeight, friendOverlaps,
  editMode, onLongPressSession, onDeleteSession,
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
                        editMode={editMode}
                        onLongPress={onLongPressSession ? () => onLongPressSession(session) : undefined}
                        onDelete={() => onDeleteSession?.(session)}
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
    // 7px は実機でほぼ読めなかった → 9px（7限×48px のマスでも3行が収まる）
    timeStart: { fontSize: 9, color: theme.textSecondary },
    periodText: { fontSize: 10, color: theme.textPrimary, fontWeight: "600", marginVertical: 1 },
    timeEnd: { fontSize: 9, color: theme.textSecondary },
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
    sessionName: { fontSize: 10, fontWeight: "700", color: theme.textPrimary },
    sessionTeacher: { fontSize: 9, color: theme.textSecondary, marginTop: 1 },
    sessionRoom: { fontSize: 9, color: theme.textSecondary },

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

    deleteBadge: {
      position: "absolute",
      top: -2,
      left: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#8E8E93",
      borderWidth: 1.5,
      borderColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },

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
