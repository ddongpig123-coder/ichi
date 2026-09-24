import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { OFFICIAL_BOARDS, type BoardMeta } from "../types/board";
import { LOUNGES } from "../types/lounge";
import { fetchCustomBoards } from "./boardService";

// ============================================================
// 「自分が書いた投稿」の横断取得。
// 学校掲示板 schools/{sd}/boards/{boardId}/posts と
// 留学生ラウンジ lounges/{loungeId}/posts の両方を対象にする。
//
// 実装メモ: collectionGroup ではなく板ごとの並列クエリにしている。
//   - collectionGroup は専用インデックス + ルール追加（{path=**}/posts）が必要
//   - ここは authorUid の等価フィルタのみなので複合インデックス不要
// 並び替え（createdAt降順）はクライアント側で行う（orderBy を足すと複合索引が要る）。
// ============================================================

export interface MyPostItem {
  id: string;
  kind: "board" | "lounge";
  boardId: string;
  boardLabel: string;   // 日本語（正本）
  boardLabelKo: string; // 韓国語
  title: string;
  commentCount: number;
  likeCount: number;
  createdAt: number;
}

// 投稿を一意に指すキー（既読コメント数の保存キーに使う）
export function myPostKey(kind: "board" | "lounge", boardId: string, postId: string): string {
  return `${kind}:${boardId}:${postId}`;
}

function toMs(v: any): number {
  if (!v) return Date.now();
  if (typeof v === "number") return v;
  return typeof v.toMillis === "function" ? v.toMillis() : Date.now();
}

const PER_BOARD = 50;

export async function fetchMyPosts(
  schoolDomain: string | null,
  uid: string
): Promise<MyPostItem[]> {
  const items: MyPostItem[] = [];

  // 学校掲示板（学校未選択のユーザーはスキップ。ラウンジのみ表示される）
  const boardTasks: Promise<void>[] = [];
  if (schoolDomain) {
    const custom = await fetchCustomBoards(schoolDomain).catch(() => [] as BoardMeta[]);
    const boards: BoardMeta[] = [...OFFICIAL_BOARDS, ...custom];
    for (const b of boards) {
      boardTasks.push(
        (async () => {
          const col = collection(db, "schools", schoolDomain, "boards", b.id, "posts");
          const snap = await getDocs(
            query(col, where("authorUid", "==", uid), limit(PER_BOARD))
          ).catch(() => null);
          snap?.docs.forEach((d) => {
            const data = d.data() as any;
            if (data.deleted) return;
            items.push({
              id: d.id,
              kind: "board",
              boardId: b.id,
              boardLabel: b.label,
              boardLabelKo: b.labelKo ?? b.label,
              title: data.title ?? "",
              commentCount: (data.commentCount ?? 0) as number,
              likeCount: (data.likeCount ?? 0) as number,
              createdAt: toMs(data.createdAt),
            });
          });
        })()
      );
    }
  }

  // 留学生ラウンジ（全国スコープ。学校未選択でも対象）
  for (const l of LOUNGES) {
    boardTasks.push(
      (async () => {
        const col = collection(db, "lounges", l.id, "posts");
        const snap = await getDocs(
          query(col, where("authorUid", "==", uid), limit(PER_BOARD))
        ).catch(() => null);
        snap?.docs.forEach((d) => {
          const data = d.data() as any;
          if (data.deleted) return;
          items.push({
            id: d.id,
            kind: "lounge",
            boardId: l.id,
            boardLabel: l.label,
            boardLabelKo: l.labelKo,
            title: data.title ?? "",
            commentCount: (data.commentCount ?? 0) as number,
            likeCount: (data.likeCount ?? 0) as number,
            createdAt: toMs(data.createdAt),
          });
        });
      })()
    );
  }

  await Promise.all(boardTasks);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}
