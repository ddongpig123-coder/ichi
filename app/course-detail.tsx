import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import { useBlock } from "../src/contexts/BlockContext";
import {
  fetchCourse, fetchCourseReviews, aggregateReviews, deleteCourseReview,
  type CourseLoc, type CourseReviewWithUid, type ReviewAggregate,
} from "../src/services/courseService";
import { REVIEW_TAGS, type Course, type ReviewTag, type Semester } from "../src/types/course";
import { timeAgo } from "../src/i18n/translations";
import StarRating from "../src/components/course/StarRating";
import ReviewModal from "../src/components/course/ReviewModal";
import ModerationMenu from "../src/components/common/ModerationMenu";
import type { Theme } from "../src/theme/themes";

// ============================================================
// 講義詳細（Phase 2 4週目）
// シラバス情報 + 平均評価・タグ集計 + レビュー一覧（各レビューに通報メニュー）。
// courses 축(実校スコープ)。3週目の ReviewModal / StarRating / 集計を再利用。
// ============================================================

export default function CourseDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { isBlocked } = useBlock();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{
    schoolDomain?: string; deptId?: string; courseId?: string; year?: string; semester?: string;
  }>();
  const schoolDomain = params.schoolDomain ?? "";
  const deptId = params.deptId ?? "";
  const courseId = params.courseId ?? "";
  const year = Number(params.year) || new Date().getFullYear();
  const semester: Semester = params.semester === "秋" ? "秋" : "春";
  const loc: CourseLoc = { schoolDomain, deptId, courseId };

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [reviews, setReviews] = useState<CourseReviewWithUid[]>([]);
  const [agg, setAgg] = useState<ReviewAggregate | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [menuReview, setMenuReview] = useState<CourseReviewWithUid | null>(null);

  const loadReviews = useCallback(async () => {
    if (!user) return;
    const list = await fetchCourseReviews(loc).catch(() => []);
    setReviews(list);
    setAgg(aggregateReviews(list, user.uid));
  }, [user, schoolDomain, deptId, courseId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCourse(schoolDomain, deptId, courseId).catch(() => null),
      user ? fetchCourseReviews(loc).catch(() => []) : Promise.resolve([]),
    ])
      .then(([c, list]) => {
        if (cancelled) return;
        setCourse(c);
        setReviews(list);
        setAgg(user ? aggregateReviews(list, user.uid) : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, schoolDomain, deptId, courseId]);

  const visibleReviews = useMemo(
    () => reviews.filter((r) => !isBlocked(r.uid)),
    [reviews, isBlocked]
  );
  const hasMine = !!agg?.mine;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("courseDetail.title")}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : !course ? (
        <View style={styles.center}><Text style={styles.dim}>{t("courseDetail.notFound")}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.courseName}>{course.name}</Text>

          {/* シラバス情報 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("courseDetail.syllabus")}</Text>
            <Text style={styles.metaLine}>{course.teacher}</Text>
            <Text style={styles.metaLine}>
              {course.day}{course.period}{t("timetable.periodSuffix")}
              {course.campus ? ` · ${course.campus}` : ""}
              {course.credits !== null ? ` · ${course.credits}${t("courseSearch.credits")}` : ""}
              {` · ${course.year} ${course.semester}`}
            </Text>
            {course.courseNumber ? (
              <Text style={styles.metaDim}>{t("courseDetail.courseNumber")}: {course.courseNumber}</Text>
            ) : null}
            {course.sourceUrl ? (
              <TouchableOpacity onPress={() => Linking.openURL(course.sourceUrl as string)}>
                <Text style={styles.link}>{t("courseDetail.openSyllabus")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 平均評価 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("review.aggregate")}</Text>
            {agg && agg.count > 0 ? (
              <>
                <View style={styles.aggRow}>
                  <StarRating value={agg.average} size={22} />
                  <Text style={styles.aggAvg}>{agg.average.toFixed(1)}</Text>
                  <Text style={styles.aggCount}>{agg.count}{t("review.countSuffix")}</Text>
                </View>
                {Object.keys(agg.tagCounts).length > 0 && (
                  <View style={styles.tagWrap}>
                    {(Object.entries(agg.tagCounts) as [ReviewTag, number][])
                      .sort((a, b) => b[1] - a[1])
                      .map(([tag, n]) => (
                        <View key={tag} style={styles.aggTag}>
                          <Text style={styles.aggTagText}>{REVIEW_TAGS[tag][language]} {n}</Text>
                        </View>
                      ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.dim}>{t("review.noReviews")}</Text>
            )}
            <TouchableOpacity style={styles.writeBtn} onPress={() => setReviewOpen(true)}>
              <Text style={styles.writeBtnText}>
                {hasMine ? t("courseDetail.editReview") : t("courseDetail.writeReview")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* レビュー一覧 */}
          {visibleReviews.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("courseDetail.reviewsHeader")}</Text>
              {visibleReviews
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((r) => (
                  <View key={r.uid} style={styles.reviewItem}>
                    <View style={styles.reviewHead}>
                      <StarRating value={r.rating} size={14} />
                      <Text style={styles.reviewTime}>{timeAgo(language, r.createdAt)}</Text>
                      <TouchableOpacity
                        onPress={() => setMenuReview(r)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.moreDots}>⋯</Text>
                      </TouchableOpacity>
                    </View>
                    {r.tags && r.tags.length > 0 && (
                      <View style={styles.tagWrap}>
                        {r.tags.map((tag) => (
                          <View key={tag} style={styles.miniTag}>
                            <Text style={styles.miniTagText}>{REVIEW_TAGS[tag][language]}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
                  </View>
                ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* 自分のレビュー編集（3週目のモーダルを再利用） */}
      <ReviewModal
        visible={reviewOpen}
        loc={course ? loc : null}
        courseName={course?.name ?? ""}
        year={year}
        semester={semester}
        uid={user?.uid ?? null}
        onClose={() => {
          setReviewOpen(false);
          loadReviews();
        }}
      />

      {/* レビュー通報（共通 ModerationMenu を再利用） */}
      <ModerationMenu
        visible={menuReview !== null}
        onClose={() => setMenuReview(null)}
        targetType="review"
        targetPath={menuReview ? `schools/${schoolDomain}/departments/${deptId}/courses/${courseId}/reviews/${menuReview.uid}` : ""}
        targetAuthorUid={menuReview?.uid ?? ""}
        onBlocked={() => setMenuReview(null)}
        onDelete={async () => {
          if (!user || !menuReview || menuReview.uid !== user.uid) return;
          await deleteCourseReview(loc, user.uid);
          setMenuReview(null);
          loadReviews();
        }}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 30, color: theme.primary, lineHeight: 32, width: 28 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary, flex: 1, textAlign: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
    dim: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
    body: { padding: 16, gap: 12 },
    courseName: { fontSize: 20, fontWeight: "800", color: theme.textPrimary },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    cardTitle: { fontSize: 13, fontWeight: "700", color: theme.textPrimary, marginBottom: 2 },
    metaLine: { fontSize: 14, color: theme.textPrimary },
    metaDim: { fontSize: 12.5, color: theme.textSecondary },
    link: { fontSize: 13.5, color: theme.primary, fontWeight: "600", marginTop: 4 },
    aggRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    aggAvg: { fontSize: 18, fontWeight: "800", color: theme.textPrimary },
    aggCount: { fontSize: 13, color: theme.textSecondary },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    aggTag: { backgroundColor: theme.primary + "14", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    aggTagText: { fontSize: 12, color: theme.primary, fontWeight: "600" },
    writeBtn: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    writeBtnText: { color: theme.primary, fontSize: 14, fontWeight: "700" },
    reviewItem: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border, gap: 4 },
    reviewHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    reviewTime: { fontSize: 11.5, color: theme.textSecondary, flex: 1 },
    moreDots: { fontSize: 18, color: theme.textSecondary, fontWeight: "700" },
    miniTag: { backgroundColor: theme.background, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    miniTagText: { fontSize: 11.5, color: theme.textSecondary },
    reviewText: { fontSize: 14, color: theme.textPrimary, lineHeight: 20, marginTop: 2 },
  });
}
