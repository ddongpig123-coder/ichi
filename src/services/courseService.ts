import { collection, getDocs, limit, orderBy, query, startAt, endAt } from "firebase/firestore";
import { db } from "../config/firebase";
import type { Course, Semester } from "../types/course";
import { MOCK_COURSES } from "../data/mockCourses";

// ============================================================
// 講義マスターの検索層
// Firestore パス: schools/{schoolDomain}/departments/{deptId}/courses/{courseId}
// firestore.rules: read は isSignedIn() のみ。update/delete は禁止（クロール投入は Admin SDK）。
// ============================================================

// クロール済みデータ（20学部・20,022件）の Firestore 適載が済んだら true にする。
// false の間は src/data/mockCourses.ts を返す（UI開発用）。
// 適載手順は scripts/README.md「2. Firestore 적재」参照。
export const COURSE_DATA_LOADED = false;

export const COURSE_SEARCH_LIMIT = 50;

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

// 講義名・教員名のどちらかにキーワードを含む講義を返す。
//
// 注意（既知の制約）: Firestore は部分一致検索を持たないため、実データ経路は
// 講義名の【前方一致】のみ（startAt/endAt）。「マーケティング」は当たるが
// 「企画」では当たらない。モック経路は件数が少ないので includes() で部分一致する。
// → 中間一致が必要になったら n-gram フィールドを適載時に持たせるか、外部検索
//    （Algolia等）が要る。11月の講義一覧UXまでに判断すること。
export async function searchCourses(params: CourseSearchParams): Promise<Course[]> {
  const keyword = params.keyword.trim();
  if (!keyword) return [];

  if (!COURSE_DATA_LOADED) return searchMock(params, keyword);

  const q = query(
    coursesRef(params.schoolDomain, params.deptId),
    orderBy("name"),
    startAt(keyword),
    endAt(keyword + ""),
    limit(COURSE_SEARCH_LIMIT)
  );
  const snap = await getDocs(q);
  const courses = snap.docs.map((d) => ({ ...(d.data() as Course), id: d.id }));
  // 年度・学期の絞り込みはクライアント側で行う（複合インデックスを増やさないため。
  // 1学部1学期あたり高々1,400件で、前方一致後の母数はさらに小さい）。
  return courses.filter((c) => c.year === params.year && c.semester === params.semester);
}

function searchMock(params: CourseSearchParams, keyword: string): Course[] {
  const all = MOCK_COURSES[params.deptId] ?? [];
  const lower = keyword.toLowerCase();
  return all
    .filter((c) => c.year === params.year && c.semester === params.semester)
    .filter(
      (c) => c.name.toLowerCase().includes(lower) || c.teacher.toLowerCase().includes(lower)
    )
    .slice(0, COURSE_SEARCH_LIMIT);
}
