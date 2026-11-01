import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { useI18n } from "../../../src/contexts/I18nContext";
import { timeAgo } from "../../../src/i18n/translations";
import { searchPosts } from "../../../src/services/boardService";
import { searchLoungePosts } from "../../../src/services/loungeService";
import { friendlyErrorBody } from "../../../src/utils/writeError";
import type { Theme } from "../../../src/theme/themes";
import { BOARDS, boardLabel } from "../../../src/types/board";
import { LOUNGES, loungeLabel } from "../../../src/types/lounge";

// 学校掲示板と森（全国）の結果を同じ形にそろえる
interface SearchResult {
  key: string;
  href: string;
  label: string;
  title: string;
  createdAt: number;
  commentCount: number;
}

export default function SearchScreen() {
  const { schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // 学校を選んでいない人も森は検索できる（以前は学校未選択だと押しても何も起きなかった）
  async function handleSearch() {
    if (!keyword.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const [boardPosts, loungePosts] = await Promise.all([
        schoolDomain ? searchPosts(schoolDomain, keyword) : Promise.resolve([]),
        searchLoungePosts(keyword),
      ]);
      const merged: SearchResult[] = [
        ...boardPosts.map((p) => {
          const meta = BOARDS.find((b) => b.id === p.boardId);
          return {
            key: `b/${p.boardId}/${p.id}`,
            href: `/post/${p.boardId}/${p.id}`,
            label: meta ? boardLabel(meta, language) : p.boardLabel,
            title: p.title,
            createdAt: p.createdAt,
            commentCount: p.commentCount ?? 0,
          };
        }),
        ...loungePosts.map((p) => {
          const meta = LOUNGES.find((l) => l.id === p.loungeId);
          return {
            key: `l/${p.loungeId}/${p.id}`,
            href: `/lounge/${p.loungeId}/${p.id}`,
            label: meta ? loungeLabel(meta, language) : "",
            title: p.title,
            createdAt: p.createdAt,
            commentCount: p.commentCount ?? 0,
          };
        }),
      ];
      setResults(merged.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      setResults([]);
      setError(friendlyErrorBody(e, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t("boards.searchPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>{t("boards.searchTitle")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            searched ? (
              <View style={styles.center}>
                <Text style={styles.empty}>{error ?? `「${keyword}」${t("boards.noResultsSuffix")}`}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(item.href as any)}
            >
              <View style={styles.boardTag}>
                <Text style={styles.boardTagText}>{item.label}</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{t("boards.anonymous")}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>{timeAgo(language, item.createdAt)}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}><Ionicons name="chatbubble-outline" size={12} color={theme.textSecondary} /> {item.commentCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    searchBar: {
      flexDirection: "row",
      padding: 12,
      gap: 8,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    input: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.background,
      paddingHorizontal: 12,
      fontSize: 15,
      color: theme.textPrimary,
    },
    searchBtn: {
      height: 40,
      paddingHorizontal: 16,
      backgroundColor: theme.primary,
      borderRadius: 8,
      justifyContent: "center",
    },
    searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    sep: { height: 1, backgroundColor: theme.border },
    row: { backgroundColor: theme.card, padding: 16 },
    boardTag: {
      alignSelf: "flex-start",
      backgroundColor: theme.primary + "1A",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginBottom: 6,
    },
    boardTagText: { fontSize: 11, color: theme.primary, fontWeight: "600" },
    title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 },
    meta: { flexDirection: "row", gap: 6 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    empty: { color: theme.textSecondary, fontSize: 14 },
  });
}
