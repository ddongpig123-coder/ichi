import { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import ReorderableList, {
  useReorderableDrag,
  reorderItems,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import DefaultAvatar from "../src/components/common/DefaultAvatar";
import { useFriends, type Friend } from "../src/contexts/FriendsContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";

// ── 자주 찾는 친구 행 ──────────────────────────────────────
function FrequentItem({
  item,
  index,
  total,
  onDemote,
}: {
  item: Friend;
  index: number;
  total: number;
  onDemote: (id: string) => void;
}) {
  const drag = useReorderableDrag();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable style={styles.row} onLongPress={drag}>
      <View style={styles.dragHandle}>
        <Text style={styles.dragIcon}>≡</Text>
      </View>
      <Text style={styles.rankBadge}>{index + 1}</Text>
      <DefaultAvatar size={36} />
      <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
      <TouchableOpacity style={styles.demoteButton} onPress={() => onDemote(item.id)}>
        <Text style={styles.demoteButtonText}>{t("friends.demote")}</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

// ── 일반 친구 행 ────────────────────────────────────────────
function NonFrequentItem({
  item,
  index,
  isFull,
  onPromote,
}: {
  item: Friend;
  index: number;
  isFull: boolean;
  onPromote: (id: string) => void;
}) {
  const drag = useReorderableDrag();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable style={styles.row} onLongPress={drag}>
      <View style={styles.dragHandle}>
        <Text style={styles.dragIcon}>≡</Text>
      </View>
      <Text style={styles.rankBadge}>{index + 1}</Text>
      <DefaultAvatar size={36} />
      <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
      <TouchableOpacity
        style={[styles.promoteButton, isFull && styles.promoteButtonDisabled]}
        onPress={() => onPromote(item.id)}
        disabled={isFull}
      >
        <Text style={styles.promoteButtonText}>
          {isFull ? t("friends.promoteFull") : t("friends.promote")}
        </Text>
      </TouchableOpacity>
    </Pressable>
  );
}

// ── 메인 화면 ───────────────────────────────────────────────
export default function FriendSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { frequent, nonFrequent, frequentIds, promote, demote, reorderFrequent, reorderNonFrequent } = useFriends();

  function handleFrequentReorder({ from, to }: ReorderableListReorderEvent) {
    reorderFrequent(reorderItems(frequentIds, from, to));
  }

  function handleNonFrequentReorder({ from, to }: ReorderableListReorderEvent) {
    reorderNonFrequent(reorderItems(nonFrequent.map((f) => f.id), from, to));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("friends.settingsTitle")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* よく使う友達 */}
        <Text style={styles.sectionLabel}>{t("friends.frequentSection")} ({frequent.length}/6)</Text>
        <Text style={styles.hint}>{t("friends.dragHint")}</Text>

        {frequent.length === 0 ? (
          <Text style={styles.emptyText}>{t("friends.frequentEmpty")}</Text>
        ) : (
          <View style={styles.listWrapper}>
            <ReorderableList
              data={frequent}
              keyExtractor={(item) => item.id}
              onReorder={handleFrequentReorder}
              renderItem={({ item, index }) => (
                <FrequentItem
                  item={item}
                  index={index}
                  total={frequent.length}
                  onDemote={demote}
                />
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* その他の友達 */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t("friends.otherSection")}</Text>
        <Text style={styles.hint}>{t("friends.dragHint")}</Text>

        {nonFrequent.length === 0 ? (
          <Text style={styles.emptyText}>{t("friends.otherEmpty")}</Text>
        ) : (
          <View style={styles.listWrapper}>
            <ReorderableList
              data={nonFrequent}
              keyExtractor={(item) => item.id}
              onReorder={handleNonFrequentReorder}
              renderItem={({ item, index }) => (
                <NonFrequentItem
                  item={item}
                  index={index}
                  isFull={frequentIds.length >= 6}
                  onPromote={promote}
                />
              )}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingTop: 52,
      paddingBottom: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 10,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 18, color: theme.textPrimary },
    headerTitle: { fontSize: 16, fontWeight: "700", color: theme.textPrimary },

    scrollContent: { padding: 16, paddingBottom: 40 },

    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textSecondary,
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    hint: { fontSize: 11, color: theme.textSecondary, marginBottom: 10 },
    emptyText: {
      fontSize: 13,
      color: theme.textSecondary,
      paddingVertical: 12,
      textAlign: "center",
    },
    listWrapper: {
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    dragHandle: {
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    dragIcon: { fontSize: 16, color: theme.textSecondary },
    rankBadge: {
      width: 20,
      fontSize: 12,
      fontWeight: "700",
      color: theme.primary,
      textAlign: "center",
    },
    nickname: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: theme.textPrimary,
    },

    demoteButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.background,
    },
    demoteButtonText: { fontSize: 12, fontWeight: "700", color: theme.accent },

    promoteButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.primary,
    },
    promoteButtonDisabled: { backgroundColor: theme.textSecondary },
    promoteButtonText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  });
}
