import { Stack } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { HeaderBackButton } from "../../src/components/common/ScreenHeader";
import { useI18n } from "../../src/contexts/I18nContext";

// post/_layout と同じく、戻るは実際の前画面へ（グループ初期画面へ飛ばさない）
function BackButton() {
  return <HeaderBackButton fallback="/(tabs)/boards" />;
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
