import {
  addDoc, collection, doc, getDoc, getDocs, limit, query, setDoc, where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Course, CourseReview, ReviewTag, Semester } from "../types/course";
import type { Day, Period } from "../types/timetable";
import type { UserLanguage } from "../types/user";
import { makeBigrams, queryGram, matchesQuery, normalizeForSearch } from "../utils/ngram";

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

// 講義詳細画面用: 単一講義ドキュメントを取得（Phase 2 4週目）。
export async function fetchCourse(
  schoolDomain: string, deptId: string, courseId: string
): Promise<Course | null> {
  const snap = await getDoc(doc(db, "schools", schoolDomain, "departments", deptId, "courses", courseId));
  return snap.exists() ? ({ ...(snap.data() as Course), id: snap.id }) : null;
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

// ── クラウドソーシング（ユーザー登録講義 + 実在確認） ────────────
// 公式クロールに無い講義をユーザーが登録(verified:false)し、他ユーザーの
// 「確認」がしきい値に達したら verified 相当としてクライアントが扱う。
// courses は update 禁止なので、確認は confirms サブコレクション(create)で行う。
export const CROWD_CONFIRM_THRESHOLD = 3;

export interface CourseContribution {
  name: string;
  teacher: string;
  day: Day;
  period: Period;
}

// ユーザー登録講義を courses に追加する（verified:false 固定・rules強制）。
// nameGrams は検索の要なので必ず付与（クローラーと同じ makeBigrams）。
export async function contributeCourse(
  params: { schoolDomain: string; deptId: string; year: number; semester: Semester; uid: string },
  data: CourseContribution
): Promise<string> {
  const ref = await addDoc(coursesRef(params.schoolDomain, params.deptId), {
    name: data.name,
    teacher: data.teacher,
    day: data.day,
    period: data.period,
    semester: params.semester,
    year: params.year,
    campus: null,
    courseNumber: null,
    credits: null,
    sourceUrl: null,
    addedBy: params.uid,
    verified: false,
    nameGrams: makeBigrams(data.name),
    createdAt: Date.now(),
  });
  return ref.id;
}

function confirmDoc(schoolDomain: string, deptId: string, courseId: string, uid: string) {
  return doc(db, "schools", schoolDomain, "departments", deptId, "courses", courseId, "confirms", uid);
}

export interface ConfirmState {
  count: number;
  mine: boolean;
  verifiedByCrowd: boolean; // count >= しきい値
}

export async function fetchConfirmState(
  schoolDomain: string, deptId: string, courseId: string, myUid: string
): Promise<ConfirmState> {
  const col = collection(db, "schools", schoolDomain, "departments", deptId, "courses", courseId, "confirms");
  const snap = await getDocs(col);
  const count = snap.size;
  const mine = snap.docs.some((d) => d.id === myUid);
  return { count, mine, verifiedByCrowd: count >= CROWD_CONFIRM_THRESHOLD };
}

// 「1人1回」はドキュメントID=uidで構造強制。既に確認済みなら何もしない。
export async function confirmCourse(
  schoolDomain: string, deptId: string, courseId: string, uid: string
): Promise<void> {
  const ref = confirmDoc(schoolDomain, deptId, courseId, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  await setDoc(ref, { uid, createdAt: Date.now() });
}

// ── 講義レビュー（Phase 2 3週目） ──────────────────────────────
// パス: schools/{schoolDomain}/departments/{deptId}/courses/{courseId}/reviews/{uid}
// ドキュメントID = uid で「1人1講義1レビュー」を構造強制（rulesで rating 1〜5 検証済み）。
// 構造化評価（rating + tags、言語中立）と自由テキスト（language付き）を分離保存。
export interface CourseLoc {
  schoolDomain: string;
  deptId: string;
  courseId: string;
}

export interface ReviewInput {
  rating: 1 | 2 | 3 | 4 | 5;
  tags: ReviewTag[];
  text: string | null;
  language: UserLanguage;
  year: number;
  semester: Semester;
}

export interface CourseReviewWithUid extends CourseReview {
  uid: string;
}

function reviewsRef(loc: CourseLoc) {
  return collection(db, "schools", loc.schoolDomain, "departments", loc.deptId, "courses", loc.courseId, "reviews");
}
function reviewDoc(loc: CourseLoc, uid: string) {
  return doc(db, "schools", loc.schoolDomain, "departments", loc.deptId, "courses", loc.courseId, "reviews", uid);
}

// 自分のレビューを作成/更新（docID=uidなので上書き=更新）。createdAtは既存を維持。
export async function setCourseReview(loc: CourseLoc, uid: string, input: ReviewInput): Promise<void> {
  const ref = reviewDoc(loc, uid);
  const existing = await getDoc(ref);
  const now = Date.now();
  await setDoc(ref, {
    rating: input.rating,
    tags: input.tags,
    text: input.text,
    language: input.language,
    year: input.year,
    semester: input.semester,
    createdAt: existing.exists() ? (existing.data().createdAt ?? now) : now,
    updatedAt: existing.exists() ? now : null,
  });
}

export async function fetchCourseReviews(loc: CourseLoc): Promise<CourseReviewWithUid[]> {
  const snap = await getDocs(reviewsRef(loc));
  return snap.docs.map((d) => ({ ...(d.data() as CourseReview), uid: d.id }));
}

export interface ReviewAggregate {
  count: number;
  average: number; // レビューなしは 0
  tagCounts: Partial<Record<ReviewTag, number>>;
  mine: CourseReviewWithUid | null;
}

// 集計はクライアントで（レビュー件数は多くないため全件取得→平均・タグ集計）。
export function aggregateReviews(reviews: CourseReviewWithUid[], myUid: string): ReviewAggregate {
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const tagCounts: Partial<Record<ReviewTag, number>> = {};
  for (const r of reviews) {
    for (const tag of r.tags ?? []) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }
  const mine = reviews.find((r) => r.uid === myUid) ?? null;
  return { count, average, tagCounts, mine };
}
