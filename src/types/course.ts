import type { Day, Period } from "./timetable";
import type { UserLanguage } from "./user";

// ============================================================
// 講義マスターデータ + 講義レビューの型定義
// Firestore パス（firestore.rules と1:1対応）:
//   schools/{schoolDomain}/departments/{deptId}/courses/{courseId}
//   schools/{schoolDomain}/departments/{deptId}/courses/{courseId}/reviews/{reviewerUid}
// ============================================================

export type Semester = "春" | "秋";

// データ出所:
//  "official"      = シラバスクローラーがAdmin SDKで投入（verified: true）
//  それ以外(uid)   = ユーザー登録（verified: false で作成、N人確認で昇格）
export type CourseSource = "official" | string;

export interface Course {
  id: string;
  name: string;             // 講義名（例: マーケティング企画Ａ）
  teacher: string;          // 教員名
  day: Day;
  period: Period;
  semester: Semester;
  year: number;             // 開講年度（例: 2026）
  campus: string | null;    // キャンパス（例: 駿河台）
  courseNumber: string | null; // 科目ナンバー（例: (CO)CMM311J）
  credits: number | null;   // 単位数
  sourceUrl: string | null; // シラバス詳細ページURL
  addedBy: CourseSource;
  verified: boolean;        // クライアント作成時はfalse固定（rulesで強制）
  // 部分一致検索用の講義名2-gram配列。Firestoreは前方一致しかできないため、
  // array-contains でクエリ語の1-gramを引き当て → クライアントで全文含有を再判定する。
  // 生成規則は src/utils/ngram.ts の makeBigrams（クローラー load-firestore.mjs と同一実装）。
  nameGrams: string[];
  createdAt: number;
  // ※ confirmCount(クラウドソーシング確認数)はフィールドではなく confirms サブコレクションで管理。
  //   courses を update: false のまま保てる（Blaze不要）。CourseConfirm を参照。
}

// クラウドソーシング確認（同じ講義を実在確認したユーザー）。
// パス: schools/{schoolDomain}/departments/{deptId}/courses/{courseId}/confirms/{uid}
// ドキュメントID = uid で「1人1回」を構造強制。confirms の件数が N 以上なら
// クライアント側で verified 相当として扱う（courses.verified の昇格は行わない）。
export interface CourseConfirm {
  uid: string;
  createdAt: number;
}

// ── 講義レビュー ────────────────────────────────────────
// 設計方針: 構造化評価（言語中立）+ 自由テキスト（言語別）を分離。
// 言語圏拡張（ko→zh→…）の際、構造化部分はそのまま資産として引き継がれる。

// タグは言語中立のキーで保存し、表示時に各言語へ変換する
export const REVIEW_TAGS = {
  easyCredit:       { ja: "単位が取りやすい",     ko: "학점 따기 쉬움" },
  attendanceStrict: { ja: "出席確認あり",         ko: "출석 확인 있음" },
  noAttendance:     { ja: "出席確認なし",         ko: "출석 확인 없음" },
  heavyHomework:    { ja: "課題が多い",           ko: "과제 많음" },
  testBased:        { ja: "テスト重視",           ko: "시험 위주" },
  reportBased:      { ja: "レポート重視",         ko: "리포트 위주" },
  intlFriendly:     { ja: "留学生に優しい",       ko: "유학생 친화적" },
  japaneseHard:     { ja: "日本語レベル高め",     ko: "일본어 난이도 높음" },
} as const;

export type ReviewTag = keyof typeof REVIEW_TAGS;

export interface CourseReview {
  // ドキュメントID = 投稿者uid（1人1講義1レビューを構造で強制）
  rating: 1 | 2 | 3 | 4 | 5; // 総合評価（rulesで1〜5を検証済み）
  tags: ReviewTag[];          // 構造化タグ（言語中立）
  text: string | null;        // 自由テキスト（任意）
  language: UserLanguage;     // 自由テキストの言語（フィルタ表示用）
  year: number;               // 履修年度
  semester: Semester;
  createdAt: number;
  updatedAt: number | null;
}
