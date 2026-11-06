import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SectionList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePinnedBoards } from "../../../src/hooks/usePinnedBoards";
import { useBoards } from "../../../src/hooks/useBoards";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import SchoolPrompt from "../../../src/components/common/SchoolPrompt";
import type { Theme } from "../../../src/theme/themes";
import { boardLabel, boardDescription, type BoardMeta } from "../../../src/types/board";

const PIN_COLOR = "#E0A500"; // お気に入り（金）

// 学校の森 — 自分の大学の掲示板一覧（よく使う / 公式 / 学生がつくった掲示板）。
// 掲示板タブのホーム（森ごとの新着ブロック）から「すべて見る」で来る。
// 学校未選択(schoolDomain=null)ユーザーには「学校を選択」導線を出す（§5）。
export default function SchoolBoardsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { schoolDomain, schoolReady } = useAuth();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isPinned, toggle, ready: pinReady } = usePinnedBoards();
  const { officialBoards, userBoards, loading } = useBoards();

  const pinnedBoards = [...officialBoards, ...userBoards].filter((b) => isPinned(b.id));

  const sections = [
    ...(pinnedBoards.length > 0 ? [{ title: t("boards.pinnedSection"), data: pinnedBoards }] : []),
    { title: t("boards.official"), data: officialBoards.filter((b) => !isPinned(b.id)) },
    ...(userBoards.length > 0
      ? [{ title: t("boards.custom"), data: userBoards.filter((b) => !isPinned(b.id)) }]
      : []),
  ];

  function renderBoard({ item }: { item: BoardMeta }) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.push(`/(tabs)/boards/${item.id}`)}>
        <View style={styles.rowContent}>
          <Text style={styles.label}>{boardLabel(item, language)}</Text>
          <Text style={styles.desc}>{boardDescription(item, language)}</Text>
        </View>
        <TouchableOpacity
          style={styles.pinBtn}
          onPress={() => toggle(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isPinned(item.id) ? "star" : "star-outline"}
            size={20}
            color={isPinned(item.id) ? PIN_COLOR : theme.textSecondary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (!pinReady || loading || !schoolReady) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} /></View>;
  }

  if (!schoolDomain) {
    return (
      <View style={styles.container}>
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
            <TouchableOpacity style={styles.bestBanner} onPress={() => router.push("/(tabs)/boards/best")}>
              <View>
                <Text style={styles.bestTitle}>{t("boards.bestTitle")}</Text>
                <Text style={styles.bestSub}>{t("boards.bestSub")}</Text>
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
