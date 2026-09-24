import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SectionList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { usePinnedBoards } from "../../../src/hooks/usePinnedBoards";
import { useBoards } from "../../../src/hooks/useBoards";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { useNotifications } from "../../../src/contexts/NotificationsContext";
import SchoolPrompt from "../../../src/components/common/SchoolPrompt";
import type { Theme } from "../../../src/theme/themes";
import { boardLabel, boardDescription, type BoardMeta } from "../../../src/types/board";

export default function BoardsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { schoolDomain, schoolReady } = useAuth();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { pinned, isPinned, toggle, ready: pinReady } = usePinnedBoards();
  const { newCommentCount } = useNotifications();
  const { officialBoards, departmentBoards, userBoards, loading } = useBoards();

  // 学校掲示板は学校スコープ。学校未選択(schoolDomain=null)ユーザーには
  // 掲示板の代わりに「学校を選択」導線を出す（ラウンジは全国なので使える）。§5
  const noSchool = schoolReady && !schoolDomain;

  const pinnedBoards = [...officialBoards, ...departmentBoards, ...userBoards].filter((b) =>
    isPinned(b.id)
  );

  const sections = [
    ...(pinnedBoards.length > 0 ? [{ title: t("boards.pinnedSection"), data: pinnedBoards }] : []),
    { title: t("boards.official"), data: officialBoards.filter((b) => !isPinned(b.id)) },
    ...(departmentBoards.length > 0
      ? [{ title: t("boards.department"), data: departmentBoards.filter((b) => !isPinned(b.id)) }]
      : []),
    ...(userBoards.length > 0
      ? [{ title: t("boards.custom"), data: userBoards.filter((b) => !isPinned(b.id)) }]
      : []),
  ];

  function renderBoard({ item }: { item: BoardMeta }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/(tabs)/boards/${item.id}`)}
      >
        <View style={styles.rowContent}>
          <Text style={styles.label}>{boardLabel(item, language)}</Text>
          <Text style={styles.desc}>{boardDescription(item, language)}</Text>
        </View>
        <TouchableOpacity
          style={styles.pinBtn}
          onPress={() => toggle(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.pinIcon}>{isPinned(item.id) ? "⭐" : "☆"}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (!pinReady || loading || !schoolReady) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} /></View>;
  }

  // 学校未選択: ラウンジ導線だけ残し、学校掲示板は「学校を選択」プロンプトに置き換える
  if (noSchool) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.loungeBanner} onPress={() => router.push("/lounge")}>
          <View>
            <Text style={styles.loungeTitle}>{t("boards.loungeTitle")}</Text>
            <Text style={styles.loungeSub}>{t("boards.loungeSub")}</Text>
          </View>
          <Text style={styles.bestArrow}>›</Text>
        </TouchableOpacity>
        <SchoolPrompt />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
        ListHeaderComponent={
          <>
            <TouchableOpacity style={styles.loungeBanner} onPress={() => router.push("/lounge")}>
              <View>
                <Text style={styles.loungeTitle}>{t("boards.loungeTitle")}</Text>
                <Text style={styles.loungeSub}>{t("boards.loungeSub")}</Text>
              </View>
              <Text style={styles.bestArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.sectionSep} />
            <TouchableOpacity style={styles.bestBanner} onPress={() => router.push("/(tabs)/boards/best")}>
              <View>
                <Text style={styles.bestTitle}>{t("boards.bestTitle")}</Text>
                <Text style={styles.bestSub}>{t("boards.bestSub")}</Text>
              </View>
              <Text style={styles.bestArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.sectionSep} />
            <TouchableOpacity style={styles.bestBanner} onPress={() => router.push("/(tabs)/boards/my-posts")}>
              <View>
                <View style={styles.myPostsTitleRow}>
                  <Text style={styles.bestTitle}>{t("myPosts.title")}</Text>
                  {/* 自分の投稿に新しいコメントが付いたら赤丸 */}
                  {newCommentCount > 0 && <View style={styles.dot} />}
                </View>
                <Text style={styles.bestSub}>{t("myPosts.sub")}</Text>
              </View>
              <Text style={styles.bestArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.sectionSep} />
          </>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(tabs)/boards/create")}>
            <Text style={styles.createBtnText}>{t("boards.createButton")}</Text>
          </TouchableOpacity>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={renderBoard}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    myPostsTitleRow: { flexDirection: "row", alignItems: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E2574C", marginLeft: 6 },
    bestBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.card,
      padding: 20,
    },
    bestTitle: { fontSize: 16, fontWeight: "700", color: theme.accent, marginBottom: 2 },
    bestSub: { fontSize: 13, color: theme.textSecondary },
    bestArrow: { fontSize: 22, color: theme.textSecondary },
    loungeBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.primary + "14",
      padding: 20,
    },
    loungeTitle: { fontSize: 16, fontWeight: "700", color: theme.primary, marginBottom: 2 },
    loungeSub: { fontSize: 13, color: theme.textSecondary, maxWidth: 260 },
    sectionHeader: { backgroundColor: theme.background, paddingHorizontal: 16, paddingVertical: 8 },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: theme.textSecondary, letterSpacing: 0.5 },
    sectionSep: { height: 8, backgroundColor: theme.background },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingVertical: 16,
      paddingLeft: 20,
      paddingRight: 12,
    },
    rowContent: { flex: 1 },
    sep: { height: 1, backgroundColor: theme.border },
    label: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 4 },
    desc: { fontSize: 13, color: theme.textSecondary },
    pinBtn: { padding: 8 },
    pinIcon: { fontSize: 18 },
    createBtn: {
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.primary,
      borderStyle: "dashed",
      alignItems: "center",
    },
    createBtnText: { color: theme.primary, fontWeight: "700", fontSize: 15 },
  });
}
