// 認証レベル（firestore.rules と1:1対応。クライアントからの昇格は不可）
// 0 = 未認証（ゲスト/メール登録のみ）
// 1 = 学校アカウント認証済み（Microsoft ~.ac.jp）
// 2 = 将来の拡張用（学生証確認など）
export type VerificationLevel = 0 | 1 | 2;

// アプリ表示言語（i18n・Phase 1で使用）
export type UserLanguage = "ja" | "ko";

// 学業情報（本人のプロフィールタブのみ表示、他人には非公開）
export interface AcademicInfo {
  department: string;      // 学部・学科 (例: 経済学部)
  grade: string;           // 学年 (例: 2)
  gpa: string;             // GPA (숨김 처리 대상)
  earnedCredits: string;   // 取得単位 (숨김 처리 대상)
  requiredCredits: string; // 卒業必要単位
  courseCount: string;     // 今学期の履修科目数
}

export interface UserProfile {
  uid: string;
  email: string;
  nickname: string;
  photoURL: string | null;
  friendIds: string[];
  createdAt: number;
  academic?: AcademicInfo;

  // ── Phase 0 追加フィールド ──────────────────────────
  // 認証レベル。作成時は必ず0。昇格はCloud Functionsのみ（規칙で強制済み）。
  verificationLevel: VerificationLevel;
  // アプリ表示言語（オンボーディングで選択）
  language: UserLanguage;
  // 所属学校ドメイン（例: "meiji.ac.jp"）。ゲストは学校選択で設定。
  schoolDomain: string | null;
  // 所属学部（先輩時間割の「学部公開」判定・講義検索の既定学部に使用）
  // ※ AcademicInfo.department は表示用の自由記述、こちらは判定用の正規値
  department: string | null;

  // 友達リストの表示順（本人のみが読む設定値。friendships が関係の実体）
  frequentFriendIds?: string[]; // よく会う友達（最大6人・ホーム画面表示）
  friendListOrder?: string[];   // その他の友達の並び順
}
