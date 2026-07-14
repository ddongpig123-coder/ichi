import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import type { ReportReason, ReportTargetType } from "../types/moderation";

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

export async function createReport(
  reporterUid: string,
  params: CreateReportParams
): Promise<void> {
  await addDoc(collection(db, "reports"), {
    reporterUid,
    targetType: params.targetType,
    targetPath: params.targetPath,
    targetAuthorUid: params.targetAuthorUid,
    reason: params.reason,
    detail: params.detail?.trim() || null,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
