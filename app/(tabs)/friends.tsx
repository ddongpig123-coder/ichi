import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import type { Theme } from "../../src/theme/themes";
import TimeTable from "../../src/components/timetable/TimeTable";
import DefaultAvatar from "../../src/components/common/DefaultAvatar";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import AddFriendModal from "../../src/components/friends/AddFriendModal";
import { useAuth } from "../../src/contexts/AuthContext";
import { useFriends } from "../../src/contexts/FriendsContext";
import {
  acceptFriendRequest,
  fetchReceivedRequests,
  rejectFriendRequest,
  type FriendRequestWithSender,
} from "../../src/services/friendRequestService";
import { getTimetable } from "../../src/services/timetableService";
import type { ClassSession } from "../../src/types/timetable";
import {
  type Semester,
  type SemesterKey,
  getCurrentSemester,
  isSemesterAvailable,
} from "../../src/data/semesterTimetables";

const CELL_HEIGHT = 42;

function notify(title: string, message?: string) {
  if (Platform.OS === "web") window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

function confirmDialog(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "キャンセル", style: "cancel" },
      { text: "OK", style: "destructive", onPress: onConfirm },
    ]);
  }
}

// 友達の時間割ロード結果: null=読み込み中 / "private"=非公開(権限なし) / 配列=表示
type FriendSessions = ClassSession[] | "private" | null;

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user } = useAuth();
  const { allFriends, frequent, nonFrequent, loading, removeFriend, refresh } = useFriends();
  const orderedAll = [...frequent, ...nonFrequent];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = selectedId ?? orderedAll[0]?.id ?? null;
  const [addModalVisible, setAddModalVisible] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState<Semester>(getCurrentSemester());
  const semesterKey: SemesterKey = `${selectedYear}-${selectedSemester}`;

  // ── 受信箱（フレンド申請） ──────────────────────────────
  const [requests, setRequests] = useState<FriendRequestWithSender[]>([]);

  const loadRequests = useCallback(() => {
    if (!user) return;
    fetchReceivedRequests(user.uid)
      .then(setRequests)
      .catch((e) => console.warn("requests load failed:", e));
  }, [user]);

  useFocusEffect(loadRequests);

  async function handleAccept(req: FriendRequestWithSender) {
    try {
      await acceptFriendRequest(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      await refresh(); // 友達一覧に即反映
      notify("承認しました", `${req.sender?.nickname ?? "相手"}さんと友達になりました。`);
    } catch (e: any) {
      notify("承認に失敗しました", e.message ?? String(e));
    }
  }

  async function handleReject(req: FriendRequestWithSender) {
    try {
      await rejectFriendRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e: any) {
      notify("操作に失敗しました", e.message ?? String(e));
    }
  }

  // ── 友達の時間割（実データ） ─────────────────────────────
  // visibility が private の場合はルールで読み取り拒否される → "private" 表示
  const [friendSessionsMap, setFriendSessionsMap] = useState<Record<string, FriendSessions>>({});
  const friendKey = effectiveId ? `${effectiveId}-${semesterKey}` : null;

  useEffect(() => {
    if (!effectiveId || !friendKey) return;
    if (friendSessionsMap[friendKey] !== undefined && friendSessionsMap[friendKey] !== null) return;
    setFriendSessionsMap((prev) => ({ ...prev, [friendKey]: null }));
    getTimetable(effectiveId, semesterKey)
      .then((docData) => {
        setFriendSessionsMap((prev) => ({ ...prev, [friendKey]: docData?.sessions ?? [] }));
      })
      .catch(() => {
        // permission-denied = 非公開設定
        setFriendSessionsMap((prev) => ({ ...prev, [friendKey]: "private" }));
      });
    // friendSessionsMap を依存に入れると無限ループするため除外（キー単位の1回ロード）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId, friendKey, semesterKey]);

  const friendSessions: FriendSessions = friendKey ? (friendSessionsMap[friendKey] ?? null) : null;
  const selectedFriend = allFriends.find((f) => f.id === effectiveId);

  function handleRemove(friendId: string, nickname: string) {
    confirmDialog("友達を削除", `${nickname}さんを友達から削除しますか？`, async () => {
      try {
        await removeFriend(friendId);
        if (selectedId === friendId) setSelectedId(null);
      } catch (e: any) {
        notify("削除に失敗しました", e.message ?? String(e));
      }
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>友達</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Text style={styles.addButtonText}>+ 追加</Text>
        </TouchableOpacity>
      </View>

      <AddFriendModal visible={addModalVisible} onClose={() => { setAddModalVisible(false); loadRequests(); }} />

      {/* 受信箱: 保留中の申請があるときだけ表示 */}
      {requests.length > 0 && (
        <View style={styles.inboxSection}>
          <Text style={styles.inboxTitle}>フレンド申請（{requests.length}）</Text>
          {requests.map((req) => (
            <View key={req.id} style={styles.inboxRow}>
              <DefaultAvatar size={30} />
              <Text style={styles.inboxNickname} numberOfLines={1}>
                {req.sender?.nickname ?? "不明なユーザー"}
              </Text>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(req)}>
                <Text style={styles.acceptButtonText}>承認</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(req)}>
                <Text style={styles.rejectButtonText}>拒否</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {selectedFriend && (
        <View style={styles.timetableSection}>
          <SemesterSelector
            selectedYear={selectedYear}
            selectedSemester={selectedSemester}
            onChangeYear={(year) => {
              setSelectedYear(year);
              if (!isSemesterAvailable(year, selectedSemester)) setSelectedSemester("春");
            }}
            onChangeSemester={setSelectedSemester}
          />
          {friendSessions === "private" ? (
            <View style={styles.privateBox}>
              <Text style={styles.privateText}>
                {selectedFriend.nickname}さんの時間割は非公開です
              </Text>
            </View>
          ) : (
            <TimeTable sessions={friendSessions ?? []} cellHeight={CELL_HEIGHT} />
          )}
        </View>
      )}

      <ScrollView style={styles.listSection} contentContainerStyle={styles.listContent}>
        {!loading && orderedAll.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>まだ友達がいません</Text>
            <Text style={styles.emptySubText}>右上の「+ 追加」からメールアドレスで友達を追加できます</Text>
          </View>
        )}
        {orderedAll.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendRow, friend.id === effectiveId && styles.friendRowSelected]}
            onPress={() => setSelectedId(friend.id)}
            activeOpacity={0.7}
          >
            <DefaultAvatar size={36} />
            <Text
              style={[styles.nickname, friend.id === effectiveId && styles.nicknameSelected]}
              numberOfLines={1}
            >
              {friend.nickname}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.messageButton} onPress={() => {}}>
                <Text style={styles.messageButtonText}>メッセージ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleRemove(friend.id, friend.nickname)}
              >
                <Text style={styles.deleteButtonText}>削除</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    titleText: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    addButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },

    inboxSection: {
      backgroundColor: theme.primary + "14",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    inboxTitle: { fontSize: 12, fontWeight: "700", color: theme.primary, marginBottom: 6 },
    inboxRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
    inboxNickname: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    acceptButton: {
      backgroundColor: theme.primary,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    acceptButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    rejectButton: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    rejectButtonText: { color: theme.textSecondary, fontSize: 12, fontWeight: "700" },

    timetableSection: {
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    privateBox: { paddingVertical: 32, alignItems: "center" },
    privateText: { fontSize: 13, color: theme.textSecondary },

    listSection: { flex: 1 },
    listContent: { paddingVertical: 4 },

    emptyBox: { paddingVertical: 40, alignItems: "center", gap: 6 },
    emptyText: { fontSize: 14, fontWeight: "700", color: theme.textSecondary },
    emptySubText: { fontSize: 12, color: theme.textSecondary, textAlign: "center", paddingHorizontal: 24 },

    friendRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 10,
    },
    friendRowSelected: {
      backgroundColor: theme.primary + "1A",
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    nickname: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    nicknameSelected: { color: theme.primary },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
    },
    messageButton: {
      backgroundColor: theme.primary,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    messageButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    deleteButton: {
      backgroundColor: theme.accent,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    deleteButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  });
}
