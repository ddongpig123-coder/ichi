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
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { searchPosts } from "../../../src/services/boardService";
import type { Theme } from "../../../src/theme/themes";
import type { Post } from "../../../src/types/board";

type SearchResult = Post & { boardLabel: string };

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "たった今";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${Math.floor(diff / 86400000)}日前`;
}

export default function SearchScreen() {
  const { schoolDomain } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleSearch() {
    if (!keyword.trim() || !schoolDomain) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    const res = await searchPosts(schoolDomain, keyword);
    setResults(res);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="キーワードを入力..."
          placeholderTextColor={theme.textSecondary}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>検索</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            searched ? (
              <View style={styles.center}>
                <Text style={styles.empty}>「{keyword}」の結果が見つかりません</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/post/${item.boardId}/${item.id}`)}
            >
              <View style={styles.boardTag}>
                <Text style={styles.boardTagText}>{item.boardLabel}</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>匿名</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>{timeAgo(item.createdAt)}</Text>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>💬 {item.commentCount}</Text>
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
