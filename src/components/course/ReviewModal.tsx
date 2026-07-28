import { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import { REVIEW_TAGS, type ReviewTag, type Semester } from "../../types/course";
import {
  fetchCourseReviews, setCourseReview, aggregateReviews,
  type CourseLoc, type ReviewAggregate, type CourseReviewWithUid,
} from "../../services/courseService";
import { timeAgo } from "../../i18n/translations";
import StarRating from "./StarRating";
import type { Theme } from "../../theme/themes";

// 講義レビュー モーダル（Phase 2 3週目、4週目の講義詳細でも再利用予定）
// 上部: みんなの評価（平均・件数・タグ集計） / 下部: 自分のレビュー編集（星必須・タグ・自由文）

interface Props {
  visible: boolean;
  loc: CourseLoc | null;
  courseName: string;
  year: number;
  semester: Semester;
  uid: string | null;
  onClose: () => void;
}

const TAG_KEYS = Object.keys(REVIEW_TAGS) as ReviewTag[];

export default function ReviewModal({ visible, loc, courseName, year, semester, uid, onClose }: Props) {
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  const [agg, setAgg] = useState<ReviewAggregate | null>(null);
  const [reviewsText, setReviewsText] = useState<{ text: string; language: string; createdAt: number }[]>([]);

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 集計と「最近のレビュー」リストをまとめて更新（初回ロード・保存後で共用）
  function applyReviews(reviews: CourseReviewWithUid[]) {
    setAgg(aggregateReviews(reviews, uid ?? ""));
    setReviewsText(
      reviews
        .filter((r) => r.text && r.text.trim())
        .sort((x, y) => y.createdAt - x.createdAt)
        .slice(0, 5)
        .map((r) => ({ text: r.text as string, language: r.language, createdAt: r.createdAt }))
    );
  }

  useEffect(() => {
    if (!visible || !loc || !uid) return;
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    fetchCourseReviews(loc)
      .then((reviews) => {
        if (cancelled) return;
        const a = aggregateReviews(reviews, uid);
        applyReviews(reviews);
        // 自分の既存レビューをプリフィル
        if (a.mine) {
          setRating(a.mine.rating);
          setTags(a.mine.tags ?? []);
          setText(a.mine.text ?? "");
        } else {
          setRating(0);
          setTags([]);
          setText("");
        }
      })
      .catch((e) => console.warn("fetch reviews failed:", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, loc?.courseId, uid]);

  function toggleTag(tag: ReviewTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    if (!loc || !uid) return;
    if (rating < 1) {
      setNotice(t("review.ratingRequired"));
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await setCourseReview(loc, uid, {
        rating: rating as 1 | 2 | 3 | 4 | 5,
        tags,
        text: text.trim() ? text.trim() : null,
        language,
        year,
        semester,
      });
      // 保存後に集計・最近のレビューを更新
      const reviews = await fetchCourseReviews(loc);
      applyReviews(reviews);
      setNotice(t("review.saved"));
    } catch (e) {
      console.warn("save review failed:", e);
      setNotice(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>{t("review.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.courseName} numberOfLines={2}>{courseName}</Text>

          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator color={theme.primary} /></View>
          ) : (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              {/* みんなの評価 */}
              <Text style={styles.sectionLabel}>{t("review.aggregate")}</Text>
              {agg && agg.count > 0 ? (
                <>
                  <View style={styles.aggRow}>
                    <StarRating value={agg.average} size={20} />
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
                  {reviewsText.length > 0 && (
                    <>
                      <Text style={[styles.sectionLabel, { marginTop: 14 }]}>{t("review.recentReviews")}</Text>
                      {reviewsText.map((r, i) => (
                        <View key={i} style={styles.reviewItem}>
                          <Text style={styles.reviewText}>{r.text}</Text>
                          <Text style={styles.reviewMeta}>{timeAgo(language, r.createdAt)}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <Text style={styles.noReviews}>{t("review.noReviews")}</Text>
              )}

              {/* 自分のレビュー */}
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>{t("review.yourReview")}</Text>

              <Text style={styles.fieldLabel}>{t("review.ratingLabel")}</Text>
              <StarRating value={rating} onChange={(v) => setRating(v)} size={30} />

              <Text style={styles.fieldLabel}>{t("review.tagsLabel")}</Text>
              <View style={styles.tagWrap}>
                {TAG_KEYS.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.pickTag, on && styles.pickTagOn]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[styles.pickTagText, on && styles.pickTagTextOn]}>
                        {REVIEW_TAGS[tag][language]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.textInput}
                placeholder={t("review.textPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
              />

              {notice && <Text style={styles.notice}>{notice}</Text>}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDim]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{t("common.save")}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    sheet: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "86%",
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 18,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 17, fontWeight: "800", color: theme.textPrimary, flex: 1 },
    close: { fontSize: 18, color: theme.textSecondary, fontWeight: "700" },
    courseName: { fontSize: 14, color: theme.textSecondary, marginTop: 2, marginBottom: 8 },
    loadingBox: { paddingVertical: 40, alignItems: "center" },
    body: { flexGrow: 0 },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: theme.textPrimary, marginBottom: 6 },
    aggRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    aggAvg: { fontSize: 18, fontWeight: "800", color: theme.textPrimary },
    aggCount: { fontSize: 13, color: theme.textSecondary },
    noReviews: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 },
    aggTag: {
      backgroundColor: theme.primary + "14",
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    aggTagText: { fontSize: 12, color: theme.primary, fontWeight: "600" },
    reviewItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border },
    reviewText: { fontSize: 13.5, color: theme.textPrimary, lineHeight: 19 },
    reviewMeta: { fontSize: 11, color: theme.textSecondary, marginTop: 3 },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
    fieldLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 12, marginBottom: 6 },
    pickTag: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: theme.card,
    },
    pickTagOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    pickTagText: { fontSize: 12.5, color: theme.textPrimary },
    pickTagTextOn: { color: "#fff", fontWeight: "600" },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 10,
      marginTop: 14,
      minHeight: 64,
      color: theme.textPrimary,
      backgroundColor: theme.background,
      fontSize: 14,
      textAlignVertical: "top",
    },
    notice: { fontSize: 12.5, color: theme.primary, marginTop: 10, fontWeight: "600" },
    saveBtn: {
      marginTop: 14,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    saveBtnDim: { opacity: 0.6 },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });
}
