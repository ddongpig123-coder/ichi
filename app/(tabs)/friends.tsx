import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import type { Theme } from "../../src/theme/themes";
import TimeTable from "../../src/components/timetable/TimeTable";
import DefaultAvatar from "../../src/components/common/DefaultAvatar";
import SemesterSelector from "../../src/components/common/SemesterSelector";
import AddFriendModal from "../../src/components/friends/AddFriendModal";
import { useAuth } from "../../src/contexts/AuthContext";
import { useFriends } from "../../src/contexts/FriendsContext";
import { useI18n } from "../../src/contexts/I18nContext";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  subscribeReceivedRequests,
  type FriendRequestWithSender,
} from "../../src/services/friendRequestService";
import { getPublicProfile } from "../../src/services/userService";
import { getTimetable } from "../../src/services/timetableService";
import { getOrCreateChat } from "../../src/services/chatService";
import type { ClassSession } from "../../src/types/timetable";
import {
  type Semester,
  type SemesterKey,
  getCurrentAcademicYear,
  getCurrentSemester,
  isSemesterAvailable,
} from "../../src/data/semesterTimetables";
import { notify, confirmDialog } from "../../src/utils/dialog";
import { friendlyErrorBody } from "../../src/utils/writeError";
import { TAB_BAR_HEIGHT } from "../../src/theme/layout";

// 友達の時間割は画面いっぱいに大きく（2026-11-28 ユーザー要望: 半々だと時間割が小さい）。
// 友達の切り替えは上の小さな横並び（チップ）、メッセージ・削除のある一覧は下へスクロール。
const TIMETABLE_HEADER_H = 24;
const PERIODS_COUNT = 7;
const NAV_HEADER_BASE = 44;
const CHIPS_H = 52;     // 友達チップの行
const SELECTOR_H = 48;  // 学期セレクタ
const PEEK_H = 40;      // 下に一覧が続くと分かるよう、見出しが少し見える分
const MIN_CELL_H = 42;

// 友達の時間割ロード結果: null=読み込み中 / "private"=非公開(権限なし) / 配列=表示
type FriendSessions = ClassSession[] | "private" | null;

export default function FriendsScreen() {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user, schoolDomain } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { allFriends, frequent, nonFrequent, loading, removeFriend, refresh } = useFriends();
  const orderedAll = [...frequent, ...nonFrequent];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = selectedId ?? orderedAll[0]?.id ?? null;
  const [addModalVisible, setAddModalVisible] = useState(false);

  // ホームの友達欄からの遷移: ?friend=uid でその友達の時間割を開く / ?add=1 で追加モーダルを開く。
  // タブ画面は params が残り続けるので、処理したら消す（戻ってきたときに再発火させない）。
  const params = useLocalSearchParams<{ friend?: string; add?: string }>();
  useEffect(() => {
    if (params.friend) {
      setSelectedId(params.friend);
      router.setParams({ friend: undefined });
    }
    if (params.add === "1") {
      setAddModalVisible(true);
      router.setParams({ add: undefined });
    }
  }, [params.friend, params.add, router]);

  const [selectedYear, setSelectedYear] = useState(getCurrentAcademicYear);
  const [selectedSemester, setSelectedSemester] = useState<Semester>(getCurrentSemester());
  const semesterKey: SemesterKey = `${selectedYear}-${selectedSemester}`;

  // ── 受信箱（フレンド申請） ──────────────────────────────
  const [requests, setRequests] = useState<FriendRequestWithSender[]>([]);

  // 受信箱をリアルタイム購読（申請が来た瞬間に出る。承認/拒否で消える）。2026-11-06 準熙
  useEffect(() => {
    if (!user) {
      setRequests([]);
      return;
    }
    let alive = true;
    const unsubscribe = subscribeReceivedRequests(user.uid, async (reqs) => {
      const withSender = await Promise.all(
        reqs.map(async (r) => ({ ...r, sender: await getPublicProfile(r.fromUid).catch(() => null) }))
      );
      if (alive) setRequests(withSender);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [user]);

  // 相手が申請を承認した場合は自分側で何も起きないため、タブを開くたびに友達一覧も読み直す。
  // 初回フォーカスは FriendsContext がログイン時に読んでいるのでスキップ（二重読み取り防止）。
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      refresh();
    }, [refresh])
  );

  async function handleAccept(req: FriendRequestWithSender) {
    try {
      await acceptFriendRequest(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      await refresh(); // 友達一覧に即反映
      notify(
        t("friends.acceptedTitle"),
        `${req.sender?.nickname ?? t("friends.defaultPartner")}${t("friends.becameFriendsSuffix")}`
      );
    } catch (e: any) {
      notify(t("friends.acceptFailed"), friendlyErrorBody(e, t));
    }
  }

  async function handleReject(req: FriendRequestWithSender) {
    try {
      await rejectFriendRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e: any) {
      notify(t("friends.actionFailed"), friendlyErrorBody(e, t));
    }
  }

  // 友達へのDM: 投稿経由と同じ chats/{uid1_uid2} を使う（既存なら再利用）。
  // 1.1 でチャットを全国スコープに移したので、学校未選択でも送れる。
  async function handleMessage(friendId: string) {
    if (!user) return;
    try {
      const chatRoomId = await getOrCreateChat(user.uid, friendId, "");
      router.push(`/(tabs)/messages/${chatRoomId}`);
    } catch (e: any) {
      notify(t("friends.actionFailed"), friendlyErrorBody(e, t));
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

  const chromeH = NAV_HEADER_BASE + insets.top + TAB_BAR_HEIGHT + insets.bottom;
  const cellHeight = Math.max(
    MIN_CELL_H,
    (height - chromeH - CHIPS_H - SELECTOR_H - TIMETABLE_HEADER_H - PEEK_H) / PERIODS_COUNT
  );

  function handleRemove(friendId: string, nickname: string) {
    confirmDialog(
      t("friends.removeTitle"),
      `${nickname}${t("friends.removeConfirm")}`,
      async () => {
        try {
          await removeFriend(friendId);
          if (selectedId === friendId) setSelectedId(null);
        } catch (e: any) {
          notify(t("friends.deleteFailed"), friendlyErrorBody(e, t));
        }
      },
      { cancel: t("common.cancel"), ok: t("common.ok") }
    );
  }

  // ヘッダーは他タブと同じナビゲーションヘッダーに統一（以前はここだけ独自の太字タイトル行だった）。
  // 「+ 追加」は headerRight に置く。
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Text style={styles.addButtonText}>{t("friends.add")}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, styles, t]);

  return (
    <View style={styles.container}>
      <AddFriendModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* 受信箱: 保留中の申請があるときだけ表示 */}
      {requests.length > 0 && (
        <View style={styles.inboxSection}>
          <Text style={styles.inboxTitle}>{t("friends.requestsTitle")}（{requests.length}）</Text>
          {requests.map((req) => (
            <View key={req.id} style={styles.inboxRow}>
              <DefaultAvatar size={30} />
              <Text style={styles.inboxNickname} numberOfLines={1}>
                {req.sender?.nickname ?? t("friends.unknownUser")}
              </Text>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(req)}>
                <Text style={styles.acceptButtonText}>{t("friends.accept")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(req)}>
                <Text style={styles.rejectButtonText}>{t("friends.reject")}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 友達の切り替え: 小さな横並び。多いときは横にスクロール */}
      {orderedAll.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {orderedAll.map((friend) => {
            const selected = friend.id === effectiveId;
            return (
              <TouchableOpacity
                key={friend.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setSelectedId(friend.id)}
                activeOpacity={0.7}
              >
                <DefaultAvatar size={22} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                  {friend.nickname}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
                {selectedFriend.nickname}{t("friends.timetablePrivate")}
              </Text>
            </View>
          ) : (
            <TimeTable sessions={friendSessions ?? []} cellHeight={cellHeight} />
          )}
        </View>
      )}

      <View style={styles.listSection}>
        {orderedAll.length > 0 && <Text style={styles.listTitle}>{t("friends.listTitle")}</Text>}
        {!loading && orderedAll.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("friends.empty")}</Text>
            <Text style={styles.emptySubText}>{t("friends.emptyHint")}</Text>
          </View>
        )}
        {/* 削除は行の長押し → 確認ダイアログ（2026-11-08 準熙: 削除ボタンが大きく目立ちすぎた）。行には「メッセージ」だけ残す */}
        {orderedAll.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendRow, friend.id === effectiveId && styles.friendRowSelected]}
            onPress={() => setSelectedId(friend.id)}
            onLongPress={() => handleRemove(friend.id, friend.nickname)}
            delayLongPress={450}
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
              <TouchableOpacity style={styles.messageButton} onPress={() => handleMessage(friend.id)}>
                <Text style={styles.messageButtonText}>{t("friends.message")}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
        {orderedAll.length > 0 && <Text style={styles.listHint}>{t("friends.longPressHint")}</Text>}
      </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 12,
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

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 12 },

    chipsRow: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card },
    chipsContent: { paddingHorizontal: 10, paddingVertical: 9, gap: 8, alignItems: "center" },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 160,
      paddingLeft: 5, paddingRight: 12, paddingVertical: 4, borderRadius: 999,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background,
    },
    chipSelected: { borderColor: theme.primary, backgroundColor: theme.primary + "1A" },
    chipText: { fontSize: 13, fontWeight: "600", color: theme.textPrimary, flexShrink: 1 },
    chipTextSelected: { color: theme.primary },

    listSection: { paddingTop: 4 },
    listTitle: {
      fontSize: 12, fontWeight: "700", color: theme.textSecondary,
      paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
    },

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
    listHint: { fontSize: 12, color: theme.textSecondary, textAlign: "center", paddingVertical: 14 },
  });
}
