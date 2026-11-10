import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import type { ReportReason, ReportSnapshot, ReportTargetType } from "../types/moderation";

// 通報を reports コレクションに記録する。
// ルール上、読み取りは全面禁止（運営がコンソール / Admin SDK で確認）。
// 作成時に reporterUid == 本人 が強制される（firestore.rules）。
export interface CreateReportParams {
  targetType: ReportTargetType;
  targetPath: string; // 対象ドキュメントの完全パス
  targetAuthorUid: string; // 被通報者の uid
  reason: ReportReason;
  detail?: string | null;
}

// 通報時点の内容の写し（運営の確認用・証拠保全。MODERATION「本文は残す」）。
// 運営が通報文書だけで「通報された時点の原文」を確認できるようにする。通報者が今読めている文書をそのまま写すだけなので、
// 通報者に見えていないものは入らない。サイズはルールの通報上限に収まるよう切り詰める。
const SNAPSHOT_TITLE_MAX = 100;
const SNAPSHOT_BODY_MAX = 2000;

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  return Array.from(v).slice(0, max).join("");
}

async function takeSnapshot(targetPath: string): Promise<ReportSnapshot | null> {
  try {
    const snap = await getDoc(doc(db, targetPath));
    if (!snap.exists()) return null;
    const d = snap.data();
    // 投稿 = title/body、コメント = body、メッセージ・講義レビュー = text
    const title = clip(d.title, SNAPSHOT_TITLE_MAX);
    const body = clip(d.body ?? d.text, SNAPSHOT_BODY_MAX);
    if (!title && !body) return null;
    return { title, body };
  } catch {
    // 写しが取れなくても通報そのものは止めない
    return null;
  }
}

export async function createReport(
  reporterUid: string,
  params: CreateReportParams
): Promise<void> {
  const snapshot = await takeSnapshot(params.targetPath);
  await addDoc(collection(db, "reports"), {
    reporterUid,
    targetType: params.targetType,
    targetPath: params.targetPath,
    targetAuthorUid: params.targetAuthorUid,
    reason: params.reason,
    detail: params.detail?.trim() || null,
    snapshot,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
