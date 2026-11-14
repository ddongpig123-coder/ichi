import React, { useEffect, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { usePinnedBoards } from "../../src/hooks/usePinnedBoards";
import type { Theme } from "../../src/theme/themes";
import {
  FORESTS, loungesOfForest, loungeLabel, loungeDescription, forestLabel, forestDescription,
  type ForestId, type LoungeMeta,
} from "../../src/types/lounge";

const PIN_COLOR = "#E0A500"; // お気に入り（金）。学校の森と同じ

// 森の板一覧。掲示板タブのホーム（森ごとの新着ブロック）の「すべて見る」から
// /lounge?forest=minna|ryugakusei で来る。forest 無し（旧リンク）なら両方の森を出す。
// 一覧にアイコンは出さない（2026-11-06 準熙）。
// 2026-11-14 準熙: 学校の森（app/(tabs)/boards/school.tsx）と同じ形に揃えた —
//   最上段にベスト投稿 → よく使う掲示板（★） → 掲示板（自由 → 質問 → 森ごとの板）。
// ★ は学校の森と同じ保存先（usePinnedBoards）に "lounge:<id>" で入れる（学校の板 id と混ざらない）。
const pinKey = (id: string) => `lounge:${id}`;

export default function LoungeHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isPinned, toggle, ready: pinReady } = usePinnedBoards();
  const params = useLocalSearchParams<{ forest?: string }>();
  const forestParam = typeof params.forest === "string" ? (params.forest as ForestId) : undefined;
  const forests = FORESTS.filter((f) => !forestParam || f.id === forestParam);
  const single = forests.length === 1 ? forests[0] : undefined;

  useEffect(() => {
    navigation.setOptions({ title: single ? forestLabel(single, language) : t("lounge.screenTitle") });
  }, [navigation, single, language, t]);

  const sections = useMemo(() => {
    const all = forests.flatMap((f) => loungesOfForest(f.id));
    const pinned = all.filter((l) => isPinned(pinKey(l.id)));
    return [
      ...(pinned.length > 0 ? [{ key: "pinned", title: t("boards.pinnedSection"), sub: null as string | null, data: pinned }] : []),
      ...forests.map((f) => ({
        key: f.id,
        // 1つの森だけのときは見出し「掲示板」、旧リンク（両方）のときは森の名前
        title: single ? t("boards.official") : forestLabel(f, language),
        sub: single ? null : forestDescription(f, language),
        data: loungesOfForest(f.id).filter((l) => !isPinned(pinKey(l.id))),
      })),
    ];
  }, [forests, single, isPinned, language, t]);

  function renderItem({ item }: { item: LoungeMeta }) {
    const pinned = isPinned(pinKey(item.id));
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.push(`/lounge/${item.id}`)}>
        <View style={styles.rowContent}>
          <Text style={styles.label}>{loungeLabel(item, language)}</Text>
          <Text style={styles.desc}>{loungeDescription(item, language)}</Text>
        </View>
        <TouchableOpacity
          style={styles.pinBtn}
          onPress={() => toggle(pinKey(item.id))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Ionicons name={pinned ? "star" : "star-outline"} size={20} color={pinned ? PIN_COLOR : theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (!pinReady) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
        ListHeaderComponent={
          single ? (
            <>
              <TouchableOpacity
                style={styles.bestBanner}
                onPress={() => router.push({ pathname: "/lounge/best", params: { forest: single.id } })}
              >
                <View>
                  <Text style={styles.bestTitle}>{t("boards.bestTitle")}</Text>
                  <Text style={styles.bestSub}>{t("boards.bestSub")}</Text>
                </View>
                <Text style={styles.bestArrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.sectionSep} />
            </>
          ) : (
            <Text style={styles.header}>{t("lounge.bannerSub")}</Text>
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.sub ? <Text style={styles.sectionSub}>{section.sub}</Text> : null}
          </View>
        )}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { fontSize: 13, color: theme.textSecondary, paddingHorizontal: 20, paddingVertical: 12 },
    // ↓ 学校の森（school.tsx）と同じ寸法
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
    sectionSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    sectionSep: { height: 8, backgroundColor: theme.background },
    sep: { height: 1, backgroundColor: theme.border },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingVertical: 16,
      paddingLeft: 20,
      paddingRight: 12,
    },
    rowContent: { flex: 1 },
    label: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 4 },
    desc: { fontSize: 13, color: theme.textSecondary },
    pinBtn: { padding: 8 },
  });
}
