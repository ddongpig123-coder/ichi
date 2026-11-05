import React, { useMemo, type ComponentProps } from "react";
import { View, Text, SectionList, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import type { Theme } from "../../src/theme/themes";
import {
  FORESTS, loungesOfForest, loungeLabel, loungeDescription, forestLabel, forestDescription, type LoungeMeta,
} from "../../src/types/lounge";

// 森の一覧（みんなの森 / 留学生の森）。通常の入口は掲示板タブ上部のセグメントで、
// この画面は /lounge への直リンク用に残している（S4 以前のリンク互換）。
export default function LoungeHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const sections = FORESTS.map((f) => ({
    title: forestLabel(f, language),
    sub: forestDescription(f, language),
    data: loungesOfForest(f.id),
  }));

  function renderItem({ item }: { item: LoungeMeta }) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.push(`/lounge/${item.id}`)}>
        <Ionicons name={item.icon as ComponentProps<typeof Ionicons>["name"]} style={styles.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{loungeLabel(item, language)}</Text>
          <Text style={styles.desc}>{loungeDescription(item, language)}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={<Text style={styles.header}>{t("lounge.bannerSub")}</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{section.title}</Text>
            <Text style={styles.bannerSub}>{section.sub}</Text>
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
    banner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, backgroundColor: theme.primary + "14" },
    bannerTitle: { fontSize: 18, fontWeight: "700", color: theme.primary, marginBottom: 4 },
    bannerSub: { fontSize: 13, color: theme.textSecondary },
    sep: { height: 1, backgroundColor: theme.border },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: theme.card,
      paddingVertical: 18,
      paddingHorizontal: 20,
    },
    icon: { fontSize: 26, color: theme.primary },
    label: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 3 },
    desc: { fontSize: 13, color: theme.textSecondary },
    arrow: { fontSize: 22, color: theme.textSecondary },
  });
}
