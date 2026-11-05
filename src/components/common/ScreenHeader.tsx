import { useMemo, type ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { Theme } from "../../theme/themes";

// 戻るボタン（全画面共通の形）。ネイティブヘッダーの headerLeft にもそのまま使う。
// 直リンクで開いて戻り先が無いときは fallback へ差し替える。
export function HeaderBackButton({ fallback = "/(tabs)", onPress }: { fallback?: Href; onPress?: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  return (
    <TouchableOpacity
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback)))}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingRight: 6 }}
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
    >
      <Ionicons name="chevron-back" size={26} color={theme.primary} />
    </TouchableOpacity>
  );
}

// 独自ヘッダーを持つスタック画面の共通ヘッダー。
// 上端の safe area（ノッチ・ダイナミックアイランド）はここで確保するので、
// 画面側のコンテナでは insets.top を足さないこと（二重になる）。
export default function ScreenHeader({
  title,
  fallback,
  onBack,
  right,
}: {
  title?: string;
  fallback?: Href;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <HeaderBackButton fallback={fallback} onPress={onBack} />
        <Text style={styles.title} numberOfLines={1}>{title ?? ""}</Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: theme.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    row: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      gap: 4,
    },
    title: { flex: 1, fontSize: 17, fontWeight: "700", color: theme.textPrimary },
    right: { marginLeft: 8 },
  });
}
