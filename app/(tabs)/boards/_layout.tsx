import { Stack } from "expo-router";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { useNotifications } from "../../../src/contexts/NotificationsContext";

// ホーム右上: 検索 + 自分の活動（自分の投稿にコメントが付いたら赤丸）
function HomeHeaderRight() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { newCommentCount } = useNotifications();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/boards/search")}
        style={{ padding: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t("boards.searchTitle")}
      >
        <Ionicons name="search" size={22} color={theme.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/boards/activity")}
        style={{ padding: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t("boards.activityTitle")}
      >
        <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
        {newCommentCount > 0 && (
          <View
            style={{
              position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4,
              backgroundColor: theme.danger,
            }}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function BoardsLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textPrimary,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("tabs.boards"), headerRight: () => <HomeHeaderRight /> }} />
      <Stack.Screen name="school" options={{ title: t("boards.schoolForest") }} />
      <Stack.Screen name="[boardId]" options={{ title: "" }} />
      <Stack.Screen name="search" options={{ title: t("boards.searchTitle") }} />
      <Stack.Screen name="best" options={{ title: t("boards.bestScreenTitle") }} />
      <Stack.Screen name="activity" options={{ title: t("boards.activityTitle") }} />
      <Stack.Screen name="my-posts" options={{ title: t("myPosts.title") }} />
      <Stack.Screen name="commented" options={{ title: t("boards.commentedTitle") }} />
      <Stack.Screen name="scraps" options={{ title: t("boards.scrapsTitle") }} />
      <Stack.Screen name="create" options={{ title: t("boards.createScreenTitle") }} />
    </Stack>
  );
}
