import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { scrapKey, type ScrapItem } from "../types/scrap";

// ============================================================
// スクラップ（投稿のブックマーク）の実データ層。
// Firestore: users/{uid}/scraps/{scrapId}（firestore.rules: 本人のみ read/write）
// ============================================================

function scrapsCol(uid: string) {
  return collection(db, "users", uid, "scraps");
}

export async function isScrapped(uid: string, key: string): Promise<boolean> {
  const snap = await getDoc(doc(scrapsCol(uid), key));
  return snap.exists();
}

export async function addScrap(uid: string, item: Omit<ScrapItem, "key" | "createdAt">): Promise<ScrapItem> {
  const full: ScrapItem = {
    ...item,
    key: scrapKey(item.kind, item.boardId, item.postId),
    createdAt: Date.now(),
  };
  await setDoc(doc(scrapsCol(uid), full.key), full);
  return full;
}

export async function removeScrap(uid: string, key: string): Promise<void> {
  await deleteDoc(doc(scrapsCol(uid), key));
}

// 新しい順。件数は多くても数十なので一括取得でよい
export async function fetchScraps(uid: string): Promise<ScrapItem[]> {
  const snap = await getDocs(query(scrapsCol(uid), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => d.data() as ScrapItem);
}
