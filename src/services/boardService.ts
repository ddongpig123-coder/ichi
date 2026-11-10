import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  increment,
  updateDoc,
  writeBatch,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { toggleLikeDoc } from "./likeToggle";
import {
  buildPostIndex,
  commitPostWithIndex,
  fetchByIndexHits,
  schoolPostIndexCol,
  schoolPostIndexDoc,
  searchPostIndex,
} from "./postIndexService";
import type { BoardId, BoardMeta, Post, Comment } from "../types/board";

// Extract school domain from email (e.g. "user@foo.ac.jp" → "foo.ac.jp")
export function schoolDomainFromEmail(email: string): string {
  return email.split("@")[1] ?? "unknown";
}

function postsCol(schoolDomain: string, boardId: BoardId) {
  return collection(db, "schools", schoolDomain, "boards", boardId, "posts");
}

function commentsCol(schoolDomain: string, boardId: BoardId, postId: string) {
  return collection(
    db,
    "schools",
    schoolDomain,
    "boards",
    boardId,
    "posts",
    postId,
    "comments"
  );
}

function toMs(val: Timestamp | number | undefined): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return val.toMillis();
}

// ── Posts ──────────────────────────────────────────────

export async function createPost(
  schoolDomain: string,
  boardId: BoardId,
  authorUid: string,
  title: string,
  body: string,
  tag: string | null = null
): Promise<string> {
  // 本体と検索索引を1つのバッチで書く（片方だけ残ることがない）。
  const ref = doc(postsCol(schoolDomain, boardId));
  await commitPostWithIndex(
    ref,
    {
      boardId,
      schoolDomain,
      title,
      body,
      authorUid,
      commentCount: 0,
      createdAt: serverTimestamp(),
      ...(tag ? { tag } : {}),
    },
    schoolPostIndexDoc(schoolDomain, ref.id),
    buildPostIndex(boardId, authorUid, title, body)
  );
  return ref.id;
}

export async function fetchPosts(
  schoolDomain: string,
  boardId: BoardId,
  pageSize = 20,
  after?: QueryDocumentSnapshot<DocumentData>
): Promise<{
  posts: Post[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const q = after
    ? query(postsCol(schoolDomain, boardId), orderBy("createdAt", "desc"), startAfter(after), limit(pageSize))
    : query(postsCol(schoolDomain, boardId), orderBy("createdAt", "desc"), limit(pageSize));

  const snap = await getDocs(q);
  // 削除済みはクライアントで除外する。既存ドキュメントには deleted フィールドが
  // 無く、Firestore の where("deleted","!=",true) はフィールド欠落を拾えないため。
  // ページあたりの表示件数は削除ぶん減るが、lastDoc は取得した最後のドキュメントを
  // そのまま返すのでページングはずれない。
  const posts: Post[] = snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Post, "id">),
      createdAt: toMs(d.data().createdAt),
    }))
    .filter((p) => !p.deleted);
  // hasMore は「取得した生ドキュメント数 == pageSize」で判定する。posts.length は
  // 削除ぶん減るので次ページ有無の判定には使えない。
  return {
    posts,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchPost(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<Post | null> {
  const snap = await getDoc(doc(postsCol(schoolDomain, boardId), postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Post, "id">), createdAt: toMs(snap.data().createdAt) };
}

// ── Comments ───────────────────────────────────────────

// parentId を渡すと返信（대댓글）。parentId はスレッド root（トップレベル）の id。
// mentionUid は返信先の人の uid（表示は @匿名N、通知にも使える）。
export async function createComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  authorUid: string,
  body: string,
  parentId: string | null = null,
  mentionUid: string | null = null
): Promise<void> {
  // コメント文書とカウンター +1 を 1 つのバッチで書く（docs/SECURITY-1.1.md §7）。
  // id をクライアント側で先に作り、投稿文書に lastCommentId として載せることで、
  // ルールが existsAfter(comments/lastCommentId) で「このバッチで本当にコメントが増えたか」を
  // 確かめられる（#50 で締める。以前は誰でも commentCount だけを +1 し続けられた）。
  const commentRef = doc(commentsCol(schoolDomain, boardId, postId));
  const batch = writeBatch(db);
  batch.set(commentRef, {
    postId,
    body,
    authorUid,
    parentId,
    mentionUid,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
  // 返信もコメント数に含める
  batch.update(doc(postsCol(schoolDomain, boardId), postId), {
    commentCount: increment(1),
    lastCommentId: commentRef.id,
  });
  await batch.commit();
}

// ── 削除（ソフトデリート） ──────────────────────────────
// MODERATION.md §1: hard delete せず deleted フラグを立て、記録は6ヶ月保存する。
// firestore.rules の canUpdatePost() / comments の update が本人更新を許可済みなので
// ルール変更は不要。本文は残す（開示請求時に内容の特定が必要なため）。
export async function softDeletePost(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<void> {
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    deleted: true,
    deletedAt: Date.now(),
  });
}

export async function softDeleteComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentId: string
): Promise<void> {
  // 削除フラグとカウンター -1 を 1 つのトランザクションで書く（createComment と同じ理由）。
  // lastCommentId に消したコメントの id を載せ、ルールが getAfter(...).data.deleted == true で
  // 「本当に削除されたコメントの分か」を確かめられるようにする。
  // 古いデータで commentCount が既に 0 のときはカウンターを触らない（0 未満にしない）。
  const postRef = doc(postsCol(schoolDomain, boardId), postId);
  const commentRef = doc(commentsCol(schoolDomain, boardId, postId), commentId);
  await runTransaction(db, async (tx) => {
    const post = await tx.get(postRef);
    const count = (post.data()?.commentCount as number | undefined) ?? 0;
    tx.update(commentRef, { deleted: true, deletedAt: Date.now() });
    if (count > 0) {
      tx.update(postRef, { commentCount: increment(-1), lastCommentId: commentId });
    }
  });
}

// ── ベストアンサー（質問掲示板の 知恵袋化） ───────────────
// 質問の作成者が回答(コメント)の1つを「ベストアンサー」に選ぶ。選ぶと解決済みに。
// 作成者本人の update なので firestore.rules の canUpdatePost() で許可済み（ルール変更不要）。
export async function setBestComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentId: string
): Promise<void> {
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    bestCommentId: commentId,
    resolved: true,
  });
}

// ベストアンサー解除（受付中に戻す）。
export async function clearBestComment(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<void> {
  await updateDoc(doc(postsCol(schoolDomain, boardId), postId), {
    bestCommentId: null,
    resolved: false,
  });
}

// 閲覧数 +1（詳細を開いた時）。他ユーザーも実行するため firestore.rules の canUpdatePost に
// viewCount 単独更新を許可するブランチを追加済み（ルール再デプロイが必要＝太希窓口）。
// 成功したかを返す。ルール未デプロイ環境では失敗しうるため、呼び出し側は
// 成功時だけ表示を+1する（画面だけ増えて再読込で戻る食い違いを防ぐ）。
export async function incrementViewCount(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<boolean> {
  try {
    await updateDoc(doc(postsCol(schoolDomain, boardId), postId), { viewCount: increment(1) });
    return true;
  } catch {
    return false;
  }
}

function likesCol(schoolDomain: string, boardId: BoardId, postId: string) {
  return collection(db, "schools", schoolDomain, "boards", boardId, "posts", postId, "likes");
}

export async function toggleLike(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(likesCol(schoolDomain, boardId, postId), uid);
  const postRef = doc(postsCol(schoolDomain, boardId), postId);
  return toggleLikeDoc(likeRef, postRef, uid);
}

export async function checkLiked(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(doc(likesCol(schoolDomain, boardId, postId), uid));
  return snap.exists();
}

// ── Dynamic boards ─────────────────────────────────────

function boardMetasCol(schoolDomain: string) {
  return collection(db, "schools", schoolDomain, "boardMetas");
}

export async function fetchCustomBoards(schoolDomain: string): Promise<BoardMeta[]> {
  const snap = await getDocs(query(boardMetasCol(schoolDomain), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BoardMeta, "id">),
    createdAt: toMs((d.data() as any).createdAt),
  }));
}

export async function createBoard(
  schoolDomain: string,
  label: string,
  description: string,
  category: BoardMeta["category"],
  createdBy: string
): Promise<string> {
  const ref = await addDoc(boardMetasCol(schoolDomain), {
    label,
    description,
    category,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function fetchBestPosts(
  schoolDomain: string,
  topN = 20,
  boards?: BoardMeta[]
): Promise<(Post & { boardLabel: string })[]> {
  const { OFFICIAL_BOARDS } = await import("../types/board");
  const allBoards: BoardMeta[] = boards ?? [
    ...OFFICIAL_BOARDS,
    ...(await fetchCustomBoards(schoolDomain)),
  ];
  const all: (Post & { boardLabel: string })[] = [];

  await Promise.all(
    allBoards.map(async (board) => {
      const q = query(postsCol(schoolDomain, board.id), orderBy("likeCount", "desc"), limit(topN));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.deleted) return;
        all.push({
          id: d.id,
          ...(data as Omit<Post, "id">),
          likeCount: (data.likeCount ?? 0) as number,
          createdAt: toMs(data.createdAt),
          boardLabel: board.label,
        });
      });
    })
  );

  return all
    .filter((p) => p.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, topN);
}

// 検索用の正規化（全角/半角・大文字小文字の違いを無視）。森の検索と共通。
export function normalizeForSearch(text: string | null | undefined): string {
  return (text ?? "").normalize("NFKC").toLowerCase();
}

// ⚠️ 各掲示板の最新 pageSize 件だけをクライアントで絞り込む簡易検索。
//    件数が増えたら（目安: 1板 300件超）講義検索と同じ n-gram 索引（nameGrams）方式に移すこと。
//    索引フィールドの追加は types / firestore.rules の変更を伴う（太熙 窓口）。
export async function searchPosts(
  schoolDomain: string,
  keyword: string,
  pageSize = 100,
  boards?: BoardMeta[]
): Promise<(Post & { boardLabel: string })[]> {
  const { OFFICIAL_BOARDS } = await import("../types/board");
  const allBoards: BoardMeta[] = boards ?? [
    ...OFFICIAL_BOARDS,
    ...(await fetchCustomBoards(schoolDomain)),
  ];
  const kw = normalizeForSearch(keyword.trim());
  if (!kw) return [];

  const labelOf = new Map(allBoards.map((b) => [b.id as string, b.label]));
  // postId で重複排除する（索引ヒットと最新走査は重なる）
  const found = new Map<string, Post & { boardLabel: string }>();
  // 2-gram は候補を絞るだけなので、キーワードを実際に含むかの最終判定はここで行う。
  const take = (boardId: string, id: string, data: DocumentData) => {
    const label = labelOf.get(boardId);
    if (!label || data.deleted) return null;
    if (
      !normalizeForSearch(data.title).includes(kw) &&
      !normalizeForSearch(data.body).includes(kw)
    ) {
      return null;
    }
    if (!found.has(id)) {
      found.set(id, {
        id,
        ...(data as Omit<Post, "id">),
        createdAt: toMs(data.createdAt),
        boardLabel: label,
      });
    }
    return null;
  };

  await Promise.all([
    // ① 検索索引。学校ぶんは1コレクションなので掲示板をまたいで1クエリ。
    //    最新N件より古い投稿も、本文（冒頭）の一致も拾える。
    //
    //    失敗しても②の結果は返す。索引の規則がまだ配備されていない端末では
    //    ここが permission-denied になるが、それで検索全体が落ちてはいけない。
    (async () => {
      try {
        const hits = await searchPostIndex(schoolPostIndexCol(schoolDomain), keyword);
        if (!hits) return;
        await fetchByIndexHits(
          hits,
          (boardId) => (labelOf.has(boardId) ? postsCol(schoolDomain, boardId as BoardId) : null),
          take
        );
      } catch (e) {
        console.warn("post index search failed (falling back to recent scan):", e);
      }
    })(),
    // ② 各掲示板の最新 pageSize 件の走査。索引を持たない投稿（索引導入前・補充前）と、
    //    2-gramにならない1文字検索のために残す。
    ...allBoards.map(async (board) => {
      const snap = await getDocs(
        query(postsCol(schoolDomain, board.id), orderBy("createdAt", "desc"), limit(pageSize))
      );
      snap.docs.forEach((d) => take(board.id, d.id, d.data()));
    }),
  ]);

  return [...found.values()].sort((a, b) => b.createdAt - a.createdAt);
}

// 単一掲示板内検索の「候補」を取得（各掲示板ヘッダーの🔍から）。
// 最近の投稿を最大 max 件取得するだけ。キーワード絞り込みは画面側でクライアント実行する
// （入力ごとに即時フィルタするため、キー入力毎の Firestore 再読み込みを避ける）。
// Firestore は全文検索が無いため、この「最近N件を1回取得 + クライアント絞り込み」が定番。
export async function fetchBoardSearchCandidates(
  schoolDomain: string,
  boardId: BoardId,
  max = 200
): Promise<Post[]> {
  const q = query(postsCol(schoolDomain, boardId), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">), createdAt: toMs(d.data().createdAt) }))
    .filter((p) => !p.deleted);
}

export async function fetchComments(
  schoolDomain: string,
  boardId: BoardId,
  postId: string
): Promise<Comment[]> {
  const q = query(
    commentsCol(schoolDomain, boardId, postId),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Comment, "id">),
    createdAt: toMs(d.data().createdAt),
    likeCount: (d.data().likeCount ?? 0) as number, // 旧データにフィールドが無い場合の既定
    parentId: (d.data().parentId ?? null) as string | null,
    mentionUid: (d.data().mentionUid ?? null) as string | null,
  }));
}

// ── コメント/返信のいいね（posts の likes と同じ構造） ──────
function commentLikesCol(schoolDomain: string, boardId: BoardId, postId: string, commentId: string) {
  return collection(db, "schools", schoolDomain, "boards", boardId, "posts", postId, "comments", commentId, "likes");
}

// 1コメントのいいねトグル。likeCount は他ユーザーも更新できる（rules: canUpdateComment）。
export async function toggleCommentLike(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentId: string,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeRef = doc(commentLikesCol(schoolDomain, boardId, postId, commentId), uid);
  const commentRef = doc(commentsCol(schoolDomain, boardId, postId), commentId);
  return toggleLikeDoc(likeRef, commentRef, uid);
}

// この投稿で自分がいいね済みのコメントID集合（コメント表示時に一括取得）。
export async function fetchLikedCommentIds(
  schoolDomain: string,
  boardId: BoardId,
  postId: string,
  commentIds: string[],
  uid: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  await Promise.all(
    commentIds.map(async (cid) => {
      const snap = await getDoc(doc(commentLikesCol(schoolDomain, boardId, postId, cid), uid));
      if (snap.exists()) liked.add(cid);
    })
  );
  return liked;
}
