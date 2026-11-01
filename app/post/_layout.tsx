import { Stack } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { HeaderBackButton } from "../../src/components/common/ScreenHeader";
import { useI18n } from "../../src/contexts/I18nContext";

// 기본 헤더 백버튼은 부모 그룹 (tabs)의 초기 화면(홈)으로 이동해버리므로
// 실제 이전 화면(보던 게시판)으로 돌아가도록 router.back()을 사용한다
function BackButton() {
  return <HeaderBackButton fallback="/(tabs)/boards" />;
}

export default function PostLayout() {
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
      <Stack.Screen name="[boardId]/[postId]" options={{ title: t("post.screenTitle") }} />
      <Stack.Screen name="[boardId]/write" options={{ title: t("post.writeScreenTitle") }} />
    </Stack>
  );
}
