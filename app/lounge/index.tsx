import React, { useEffect, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import type { Theme } from "../../src/theme/themes";
import {
  FORESTS, loungesOfForest, loungeLabel, loungeDescription, forestLabel, forestDescription,
  type ForestId, type LoungeMeta,
} from "../../src/types/lounge";

// 森の板一覧。掲示板タブのホーム（森ごとの新着ブロック）の「すべて見る」から
// /lounge?forest=minna|ryugakusei で来る。forest 無し（旧リンク）なら両方の森を出す。
// 一覧にアイコンは出さない（2026-11-06 準熙）。
export default function LoungeHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const params = useLocalSearchParams<{ forest?: string }>();
  const forestParam = typeof params.forest === "string" ? (params.forest as ForestId) : undefined;
  const forests = FORESTS.filter((f) => !forestParam || f.id === forestParam);
  const single = forests.length === 1 ? forests[0] : undefined;

  useEffect(() => {
    navigation.setOptions({ title: single ? forestLabel(single, language) : t("lounge.screenTitle") });
  }, [navigation, single, language, t]);

  const sections = forests.map((f) => ({
    title: forestLabel(f, language),
    sub: forestDescription(f, language),
    data: loungesOfForest(f.id),
  }));

  function renderItem({ item }: { item: LoungeMeta }) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.push(`/lounge/${item.id}`)}>
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
        ListHeaderComponent={single ? null : <Text style={styles.header}>{t("lounge.bannerSub")}</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.banner}>
            {!single && <Text style={styles.bannerTitle}>{section.title}</Text>}
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
    banner: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
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
    label: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 3 },
    desc: { fontSize: 13, color: theme.textSecondary },
    arrow: { fontSize: 22, color: theme.textSecondary },
  });
}
