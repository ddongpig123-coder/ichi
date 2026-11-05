import {
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../config/firebase";

// いいねの切り替え（投稿・コメント、学校掲示板・森で共通）。
// いいね文書（likes/{uid}）とカウンター（likeCount）を1つのバッチで書く。
// 以前は2回に分けて書いていたため、間で失敗すると「いいね済みなのに数が増えていない」
// 状態が残った。バッチなら両方成功か両方失敗のどちらかになる。
export async function toggleLikeDoc(
  likeRef: DocumentReference,
  targetRef: DocumentReference,
  uid: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeSnap = await getDoc(likeRef);
  const liked = !likeSnap.exists();
  const batch = writeBatch(db);
  if (liked) batch.set(likeRef, { uid, createdAt: serverTimestamp() });
  else batch.delete(likeRef);
  batch.update(targetRef, { likeCount: increment(liked ? 1 : -1) });
  await batch.commit();
  const updated = await getDoc(targetRef);
  return { liked, likeCount: Math.max(0, (updated.data()?.likeCount ?? 0) as number) };
}
