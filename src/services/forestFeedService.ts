import { fetchPosts } from "./boardService";
import { fetchLoungePosts } from "./loungeService";
import type { BoardMeta } from "../types/board";
import { loungesOfForest, type ForestId } from "../types/lounge";

// ============================================================
// 掲示板タブのホーム（森ごとの「最近の投稿」ブロック）用の横断取得。
//   みんなの森 / 留学生の森 / 学校の森 それぞれで、所属する板から新しい順に数件ずつ取り、
//   まとめて新しい順に並べ直して先頭 FEED_SIZE 件を返す（BOARD-ACCESS §4-3, 2026-11-06）。
//
// 実装メモ（myPostsService と同じ理由）: collectionGroup ではなく板ごとの並列クエリ。
//   collectionGroup だと {path=**}/posts の規則 + 複合索引（schoolDomain/loungeId × createdAt）が要る。
//   読み取り数は「板数 × PER_SOURCE」（みんな 9・留学生 12・学校 ≈ 27）。ホームを開くたびに
//   取り直さないよう MAX_AGE_MS の間はメモリキャッシュを返す。利用者が増えて読み取り課金が
//   気になったら collectionGroup に切り替える（規則・索引は太熙窓口）。
// ============================================================

export type FeedKind = "board" | "lounge";

export interface FeedItem {
  key: string;            // `${kind}:${boardId}:${id}`（一覧の key・スクラップのキーと同じ規則）
  kind: FeedKind;
  boardId: string;        // 学校掲示板の boardId / 森の loungeId
  boardLabel: string;     // 日本語（正本）
  boardLabelKo: string;
  id: string;
  title: string;
  authorUid: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
}

export const FEED_SIZE = 6;
const PER_SOURCE = 3;
const MAX_AGE_MS = 60_000;

export function feedKey(kind: FeedKind, boardId: string, id: string): string {
  return `${kind}:${boardId}:${id}`;
}

const cache = new Map<string, { at: number; items: FeedItem[] }>();

function fromCache(cacheKey: string, maxAgeMs: number): FeedItem[] | null {
  const hit = cache.get(cacheKey);
  return hit && Date.now() - hit.at < maxAgeMs ? hit.items : null;
}

function merge(lists: FeedItem[][], size: number): FeedItem[] {
  return lists.flat().sort((a, b) => b.createdAt - a.createdAt).slice(0, size);
}

// 森（全国）: その森に属するカテゴリの新着をまとめる
export async function fetchForestFeed(
  forest: ForestId,
  opts: { force?: boolean; size?: number } = {}
): Promise<FeedItem[]> {
  const cacheKey = `forest:${forest}`;
  if (!opts.force) {
    const hit = fromCache(cacheKey, MAX_AGE_MS);
    if (hit) return hit;
  }
  const lists = await Promise.all(
    loungesOfForest(forest).map((l) =>
      fetchLoungePosts(l.id, PER_SOURCE)
        .then((posts) =>
          posts.map<FeedItem>((p) => ({
            key: feedKey("lounge", l.id, p.id),
            kind: "lounge",
            boardId: l.id,
            boardLabel: l.label,
            boardLabelKo: l.labelKo,
            id: p.id,
            title: p.title,
            authorUid: p.authorUid,
            createdAt: p.createdAt,
            likeCount: p.likeCount ?? 0,
            commentCount: p.commentCount ?? 0,
          }))
        )
        // 1 つの板が失敗しても残りは出す
        .catch(() => [] as FeedItem[])
    )
  );
  const items = merge(lists, opts.size ?? FEED_SIZE);
  cache.set(cacheKey, { at: Date.now(), items });
  return items;
}

// 学校の森: 自分の学校の掲示板（公式 + 学生がつくった板）の新着をまとめる
export async function fetchSchoolFeed(
  schoolDomain: string,
  boards: BoardMeta[],
  opts: { force?: boolean; size?: number } = {}
): Promise<FeedItem[]> {
  const cacheKey = `school:${schoolDomain}`;
  if (!opts.force) {
    const hit = fromCache(cacheKey, MAX_AGE_MS);
    if (hit) return hit;
  }
  const lists = await Promise.all(
    boards.map((b) =>
      fetchPosts(schoolDomain, b.id, PER_SOURCE)
        .then((r) =>
          r.posts.map<FeedItem>((p) => ({
            key: feedKey("board", b.id, p.id),
            kind: "board",
            boardId: b.id,
            boardLabel: b.label,
            boardLabelKo: b.labelKo ?? b.label,
            id: p.id,
            title: p.title,
            authorUid: p.authorUid,
            createdAt: p.createdAt,
            likeCount: p.likeCount ?? 0,
            commentCount: p.commentCount ?? 0,
          }))
        )
        .catch(() => [] as FeedItem[])
    )
  );
  const items = merge(lists, opts.size ?? FEED_SIZE);
  cache.set(cacheKey, { at: Date.now(), items });
  return items;
}

// 投稿・削除のあとなど、次に開いたときに必ず取り直したいときに呼ぶ
export function invalidateFeedCache(): void {
  cache.clear();
}
