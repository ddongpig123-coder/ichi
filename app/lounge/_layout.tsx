import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, Text } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";

// post/_layout と同じく、戻るは実際の前画面へ（グループ初期画面へ飛ばさない）
function BackButton() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/boards"))}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingRight: 8 }}
    >
      <Text style={{ fontSize: 28, color: theme.primary, lineHeight: 30 }}>‹</Text>
    </TouchableOpacity>
  );
}

export default function LoungeLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <BackButton />,
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("lounge.screenTitle") }} />
      <Stack.Screen name="[loungeId]/index" options={{ title: "" }} />
      <Stack.Screen name="[loungeId]/write" options={{ title: t("post.writeScreenTitle") }} />
      <Stack.Screen name="[loungeId]/[postId]" options={{ title: t("post.screenTitle") }} />
    </Stack>
  );
}
