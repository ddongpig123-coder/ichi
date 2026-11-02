import type { Course } from "../types/course";

// ============================================================
// 講義コード（kougicd）— 分反を見分ける唯一の値
//
// 共通外国語などは、同じ講義名・教員・曜限・キャンパス・科目ナンバーの講義が
// 2〜4件並ぶ。これは重複ではなく**分反（クラス）**で、シラバス検索の一覧に
// 出ている項目のうち違うのは詳細ページの kougicd だけ
// （2026-11-02 に公開シラバスで実測。所属・学期・キャンパス・科目ナンバーは全部同じ）。
//
// ⚠️ 科目ナンバー（courseNumber）では区別できない。分反どうしで同じ値になる。
//    docs/COLLAB-DATA-TAEHUI.md §4-6 は「科目ナンバーで区別できる」前提だったが誤り。
// ============================================================

// sourceUrl の例:
//   https://www.oh-o.meiji.ac.jp/syllabus/syllabusView?syllabusYear=2026&syllabusType=0&kougicd=81E00120
function fromSourceUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  const m = sourceUrl.match(/[?&]kougicd=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// 既存データ（2026-07 適載の 20,022 件）には lectureCode フィールドが無いので、
// その場合は sourceUrl から取り出す。次回のクロールからはフィールドに入る。
export function lectureCodeOf(course: Course): string | null {
  return course.lectureCode ?? fromSourceUrl(course.sourceUrl);
}
