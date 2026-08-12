import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "../config/firebase";

// アプリ内お問い合わせ。書き込み専用の inquiries コレクションに保存し、
// 運営が Firebase コンソール / Admin SDK で確認する（firestore.rules 参照）。
// contact は返信先メール等（任意）。schoolDomain 等の文脈も一緒に残す。
export async function submitInquiry(
  uid: string,
  message: string,
  opts?: { contact?: string | null; schoolDomain?: string | null }
): Promise<void> {
  await addDoc(collection(db, "inquiries"), {
    uid,
    message: message.trim(),
    contact: opts?.contact?.trim() || null,
    schoolDomain: opts?.schoolDomain ?? null,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  });
}
