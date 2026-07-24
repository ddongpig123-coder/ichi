import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import type { Course, Semester } from "../types/course";
import { queryGram, matchesQuery, normalizeForSearch } from "../utils/ngram";

// ============================================================
// 講義マスターの検索層
// Firestore パス: schools/{schoolDomain}/departments/{deptId}/courses/{courseId}
// firestore.rules: read は isSignedIn() のみ。update/delete は禁止（クロール投入は Admin SDK）。
//
// 検索方式: nameGrams(講義名2-gram) の array-contains で候補を引き、クライアントで
// 「講義名/教員名にキーワードを含むか」+ 年度・学期で最終フィルタする（中間一致対応）。
// ※ 純粋な教員名だけの検索は候補(講義名gram)に乗らないため実データでは弱い。
//   教員名検索を強化するなら適載時に teacherGrams を足す（今は講義名中心のUX）。
// ============================================================

// 20学部・20,022件を Firestore に適載済み（2026-07-22）。実データ検索を使う。
export const COURSE_DATA_LOADED = true;

export const COURSE_SEARCH_LIMIT = 50;
// array-contains の候補上限。よく出る2-gramでも年度・学期フィルタ前に十分拾えるよう広め。
const CANDIDATE_LIMIT = 300;

export interface CourseSearchParams {
  schoolDomain: string;
  deptId: string;
  keyword: string;
  year: number;
  semester: Semester;
}

function coursesRef(schoolDomain: string, deptId: string) {
  return collection(db, "schools", schoolDomain, "departments", deptId, "courses");
}

// 講義名・教員名のどちらかにキーワードを含む講義を返す（部分一致）。
export async function searchCourses(params: CourseSearchParams): Promise<Course[]> {
  const keyword = params.keyword.trim();
  if (!keyword) return [];

  const gram = queryGram(keyword);
  if (!gram) return []; // 正規化後に空

  // 講義名gramで候補を絞り込み、年度・学期・全文含有はクライアントで判定する
  // （array-contains + 等価フィルタの複合インデックスを増やさないため）。
  const q = query(
    coursesRef(params.schoolDomain, params.deptId),
    where("nameGrams", "array-contains", gram),
    limit(CANDIDATE_LIMIT)
  );
  const snap = await getDocs(q);
  const normKeyword = normalizeForSearch(keyword);

  return snap.docs
    .map((d) => ({ ...(d.data() as Course), id: d.id }))
    .filter((c) => c.year === params.year && c.semester === params.semester)
    .filter(
      (c) =>
        matchesQuery(c.name, keyword) ||
        normalizeForSearch(c.teacher).includes(normKeyword)
    )
    .slice(0, COURSE_SEARCH_LIMIT);
}
