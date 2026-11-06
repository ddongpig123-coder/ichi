import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================
// 「コメントした投稿」の記録（端末ローカル・AsyncStorage）。
//
// サーバ側で「自分のコメントが付いた投稿」を横断検索するには、comments の
// collectionGroup 規則 + 索引が要る（{path=**}/comments）。1.1 ではそこまでせず、
// この端末でコメントしたときに投稿の最小情報を書き留めておく方式にする。
// → 機種変更・再インストールでは消える（画面にその旨を表示）。サーバ化は 1.2 以降。
// ============================================================

const STORAGE_KEY = "ichi:commentedPosts";
const MAX_ITEMS = 100;

export interface CommentedPost {
  key: string;            // `${kind}:${boardId}:${postId}`
  kind: "board" | "lounge";
  boardId: string;        // 学校掲示板の boardId / 森の loungeId
  postId: string;
  schoolDomain: string | null;
  title: string;
  boardLabel: string;
  boardLabelKo: string;
  at: number;             // 最後にコメントした時刻（ms）
}

export async function loadCommentedPosts(): Promise<CommentedPost[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CommentedPost[]) : [];
  } catch (e) {
    console.warn("commentedPosts load failed:", e);
    return [];
  }
}

// 同じ投稿に何度コメントしても 1 件。最新を先頭に、MAX_ITEMS で切る
export async function recordCommentedPost(item: Omit<CommentedPost, "key" | "at">): Promise<void> {
  const key = `${item.kind}:${item.boardId}:${item.postId}`;
  try {
    const prev = await loadCommentedPosts();
    const next = [{ ...item, key, at: Date.now() }, ...prev.filter((p) => p.key !== key)].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("commentedPosts save failed:", e);
  }
}
