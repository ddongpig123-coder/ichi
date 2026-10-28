import React, { useMemo, type ComponentProps } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import type { Theme } from "../../src/theme/themes";
import { LOUNGES, loungeLabel, loungeDescription, type LoungeMeta } from "../../src/types/lounge";

// 全国の留学生が学校の枠を越えて交流するラウンジ。カテゴリ一覧。
export default function LoungeHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  function renderItem({ item }: { item: LoungeMeta }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/lounge/${item.id}`)}
      >
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
      <FlatList
        data={LOUNGES}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{t("boards.loungeTitle")}</Text>
            <Text style={styles.bannerSub}>{t("lounge.bannerSub")}</Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    banner: { padding: 20, backgroundColor: theme.primary + "14" },
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
