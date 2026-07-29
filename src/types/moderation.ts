// 通報・ブロックのデータモデル。
// firestore.rules の reports / users/{uid}/blocks と 1:1 で対応させること。
// 詳細な運用設計は docs/MODERATION.md を参照。

export type ReportTargetType = "post" | "comment" | "message" | "user" | "review";

export type ReportReason =
  | "spam"
  | "abuse"
  | "defamation"
  | "privacy"
  | "illegal"
  | "other";

export type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";

// reports/{reportId}
export interface Report {
  reporterUid: string; // 通報者（本人名義のみ作成可能・ルールで強制）
  targetType: ReportTargetType;
  targetPath: string; // 対象ドキュメントの完全パス（調査用）
  targetAuthorUid: string; // 被通報者
  reason: ReportReason;
  detail: string | null; // 自由記述（任意）
  status: ReportStatus;
  createdAt: number;
}

// 通報理由の表示ラベル（UI文字列は日本語のみ）
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "スパム・宣伝" },
  { value: "abuse", label: "誹謗中傷・嫌がらせ" },
  { value: "defamation", label: "名誉毀損" },
  { value: "privacy", label: "プライバシー侵害" },
  { value: "illegal", label: "違法・不適切な内容" },
  { value: "other", label: "その他" },
];

// users/{uid}/blocks/{blockedUid}
export interface BlockedUser {
  blockedUid: string;
  createdAt: number;
}
