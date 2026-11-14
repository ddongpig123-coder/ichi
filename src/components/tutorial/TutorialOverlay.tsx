import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import type { TranslationKey } from "../../i18n/translations";
import type { Theme } from "../../theme/themes";
import { setTutorialStage, useTutorialStage } from "../../services/tutorialStore";
import { shareInvite } from "../../services/friendInvite";
import { canReadTimetableImage } from "../../services/timetableOcrService";
import { getCurrentAcademicYear, getCurrentSemester } from "../../data/semesterTimetables";
import { hasDepartmentData } from "../../data/departments";
import { notify } from "../../utils/dialog";
import AddFriendModal from "../friends/AddFriendModal";

// はじめの設定 + 使い方ツアーのポップアップ（2026-11-14 準熙）。src/services/tutorialStore.ts 参照。
// タブ画面（app/(tabs)/_layout.tsx）の上に重ねて出す。RN の Modal は使わない —
// 講義検索などスタック画面へ移ったときに、その画面の上にまで出てしまうため。
// タブの中に置いた半透明の板なら、スタック画面が上に来れば隠れ、戻ってくると続きが出る。

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface TourCard {
  icon: IconName;
  where: TranslationKey; // どこにある機能か（「ホーム」「掲示板タブ」など）
  title: TranslationKey;
  body: TranslationKey;
  action?: { label: TranslationKey; go: () => void };
}

export default function TutorialOverlay() {
  const stage = useTutorialStage();
  const router = useRouter();
  const { user, schoolDomain } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [tourIndex, setTourIndex] = useState(0);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const visible = stage === "timetable" || stage === "friends" || stage === "tour";

  // 出るたび・カードが変わるたびに軽くフェードイン（ポップアップらしく）
  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [visible, stage, tourIndex, fade]);

  // ツアーに入り直したら 1 枚目から
  useEffect(() => {
    if (stage === "tour") setTourIndex(0);
  }, [stage]);

  // 使い方ツアー。卒業要件は学部データのある学校だけ、アカウント登録はゲストだけ
  const tour: TourCard[] = useMemo(() => {
    const cards: TourCard[] = [
      { icon: "calendar-outline", where: "tutorial.whereHome", title: "tutorial.tourTimetableTitle", body: "tutorial.tourTimetableBody" },
    ];
    if (hasDepartmentData(schoolDomain)) {
      cards.push({ icon: "school-outline", where: "tutorial.whereHomeGrad", title: "tutorial.tourGradTitle", body: "tutorial.tourGradBody" });
    }
    cards.push(
      { icon: "chatbubbles-outline", where: "tutorial.whereBoards", title: "tutorial.tourBoardsTitle", body: "tutorial.tourBoardsBody" },
      { icon: "people-outline", where: "tutorial.whereFriends", title: "tutorial.tourFriendsTitle", body: "tutorial.tourFriendsBody" },
    );
    if (user?.isAnonymous) {
      cards.push({
        icon: "shield-checkmark-outline", where: "tutorial.whereProfile", title: "tutorial.tourAccountTitle", body: "tutorial.tourAccountBody",
        action: { label: "tutorial.tourAccountButton", go: () => { setTutorialStage("done"); router.push("/account"); } },
      });
    }
    return cards;
  }, [schoolDomain, user?.isAnonymous, router]);

  if (!visible) return null;

  const year = getCurrentAcademicYear();
  const semester = getCurrentSemester();

  // ── はじめの設定: 進み具合（① 学校 ✓ → ② 時間割 → ③ 友達）
  const setupStep = stage === "timetable" ? 2 : 3;
  const setupProgress = (
    <View style={styles.progressRow}>
      {(["tutorial.stepSchool", "tutorial.stepTimetable", "tutorial.stepFriends"] as TranslationKey[]).map((k, i) => {
        const n = i + 1;
        const done = n < setupStep;
        const on = n === setupStep;
        return (
          <React.Fragment key={k}>
            {i > 0 && <View style={[styles.progressLine, (done || on) && styles.progressLineOn]} />}
            <View style={styles.progressItem}>
              <View style={[styles.progressDot, done && styles.progressDotDone, on && styles.progressDotOn]}>
                {done ? <Ionicons name="checkmark" size={13} color="#fff" /> : <Text style={[styles.progressNum, on && styles.progressNumOn]}>{n}</Text>}
              </View>
              <Text style={[styles.progressLabel, on && styles.progressLabelOn]}>{t(k)}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );

  function skipAll() {
    setTutorialStage("done");
  }

  async function sendInvite() {
    if (!user || sharing) return;
    setSharing(true);
    try {
      const r = await shareInvite(user.uid, t("friends.inviteMessage"));
      if (r === "copied") notify(t("friends.inviteCopied"));
      else if (r === "failed") { notify(t("friends.inviteFailed")); return; }
      setTutorialStage("tour");
    } finally {
      setSharing(false);
    }
  }

  let card: React.ReactNode;
  if (stage === "timetable") {
    card = (
      <>
        {setupProgress}
        <Icon name="calendar-outline" styles={styles} theme={theme} />
        <Text style={styles.title}>{t("tutorial.timetableTitle")}</Text>
        <Text style={styles.body}>{t(canReadTimetableImage ? "tutorial.timetableBodyOcr" : "tutorial.timetableBody")}</Text>
        {/* スクショ読み取り（RELEASE-PLAN N1）。写真選択の部品が無い旧バイナリ（1.0.0）では出さない */}
        {canReadTimetableImage ? (
          <>
            <PrimaryButton
              label={t("tutorial.timetableOcr")}
              icon="image-outline"
              styles={styles}
              onPress={() => {
                setTutorialStage("friends");
                router.push(`/timetable-import?year=${year}&semester=${semester}`);
              }}
            />
            <SecondaryButton
              label={t("tutorial.timetableSearch")}
              icon="search-outline"
              styles={styles}
              theme={theme}
              onPress={() => {
                setTutorialStage("friends");
                router.push(`/course-search?year=${year}&semester=${semester}`);
              }}
            />
          </>
        ) : (
          <PrimaryButton
            label={t("tutorial.timetableSearch")}
            icon="search-outline"
            styles={styles}
            onPress={() => {
              setTutorialStage("friends");
              router.push(`/course-search?year=${year}&semester=${semester}`);
            }}
          />
        )}
        <SecondaryButton
          label={t("tutorial.timetableWizard")}
          icon="sparkles-outline"
          styles={styles}
          theme={theme}
          onPress={() => {
            setTutorialStage("friends");
            router.push(`/timetable-wizard?year=${year}&semester=${semester}`);
          }}
        />
        <LaterButton label={t("tutorial.later")} styles={styles} onPress={() => setTutorialStage("friends")} />
      </>
    );
  } else if (stage === "friends") {
    card = (
      <>
        {setupProgress}
        <Icon name="people-outline" styles={styles} theme={theme} />
        <Text style={styles.title}>{t("tutorial.friendsTitle")}</Text>
        <Text style={styles.body}>{t("tutorial.friendsBody")}</Text>
        <PrimaryButton label={t("tutorial.friendsInvite")} icon="link-outline" styles={styles} busy={sharing} onPress={sendInvite} />
        <SecondaryButton
          label={t("tutorial.friendsSearch")}
          icon="mail-outline"
          styles={styles}
          theme={theme}
          onPress={() => setAddFriendOpen(true)}
        />
        <LaterButton label={t("tutorial.later")} styles={styles} onPress={() => setTutorialStage("tour")} />
      </>
    );
  } else {
    const c = tour[Math.min(tourIndex, tour.length - 1)];
    const last = tourIndex >= tour.length - 1;
    card = (
      <>
        <Text style={styles.tourLabel}>{t("tutorial.tourLabel")}</Text>
        <Icon name={c.icon} styles={styles} theme={theme} />
        <View style={styles.wherePill}>
          <Text style={styles.whereText}>{t(c.where)}</Text>
        </View>
        <Text style={styles.title}>{t(c.title)}</Text>
        <Text style={styles.body}>{t(c.body)}</Text>
        <View style={styles.dots}>
          {tour.map((_, i) => <View key={i} style={[styles.dot, i === tourIndex && styles.dotOn]} />)}
        </View>
        {c.action ? (
          <>
            <PrimaryButton label={t(c.action.label)} styles={styles} onPress={c.action.go} />
            <LaterButton label={t("tutorial.start")} styles={styles} onPress={skipAll} />
          </>
        ) : (
          <View style={styles.navRow}>
            {tourIndex > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => setTourIndex((i) => i - 1)}>
                <Text style={styles.backText}>{t("tutorial.back")}</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => (last ? skipAll() : setTourIndex((i) => i + 1))}
            >
              <Text style={styles.nextText}>{last ? t("tutorial.start") : t("tutorial.next")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.cardWrap, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
        <ScrollView contentContainerStyle={styles.card} bounces={false}>
          <View style={styles.topRow}>
            <Text style={styles.topLabel}>{stage === "tour" ? `${tourIndex + 1} / ${tour.length}` : t("tutorial.setupLabel")}</Text>
            <TouchableOpacity onPress={skipAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
              <Text style={styles.skip}>{t("tutorial.skip")}</Text>
            </TouchableOpacity>
          </View>
          {card}
        </ScrollView>
      </Animated.View>
      <AddFriendModal
        visible={addFriendOpen}
        onClose={() => {
          setAddFriendOpen(false);
          setTutorialStage("tour");
        }}
      />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Icon({ name, styles, theme }: { name: IconName; styles: Styles; theme: Theme }) {
  return (
    <View style={styles.iconCircle}>
      <Ionicons name={name} size={34} color={theme.primary} />
    </View>
  );
}

function PrimaryButton({ label, icon, onPress, styles, busy }: { label: string; icon?: IconName; onPress: () => void; styles: Styles; busy?: boolean }) {
  return (
    <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={onPress} disabled={busy} accessibilityRole="button">
      {icon ? <Ionicons name={icon} size={17} color="#fff" /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, icon, onPress, styles, theme }: { label: string; icon?: IconName; onPress: () => void; styles: Styles; theme: Theme }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress} accessibilityRole="button">
      {icon ? <Ionicons name={icon} size={17} color={theme.primary} /> : null}
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function LaterButton({ label, onPress, styles }: { label: string; onPress: () => void; styles: Styles }) {
  return (
    <TouchableOpacity style={styles.laterBtn} onPress={onPress} accessibilityRole="button">
      <Text style={styles.laterText}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      zIndex: 100,
    },
    cardWrap: { width: "100%", maxWidth: 380, maxHeight: "88%", borderRadius: 22, backgroundColor: theme.card, overflow: "hidden" },
    card: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20, alignItems: "center" },
    topRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    topLabel: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
    skip: { fontSize: 13, fontWeight: "700", color: theme.textSecondary },
    progressRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
    progressItem: { alignItems: "center", width: 58 },
    progressLine: { width: 26, height: 2, backgroundColor: theme.border, marginTop: 11 },
    progressLineOn: { backgroundColor: theme.primary },
    progressDot: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.border,
      justifyContent: "center", alignItems: "center", backgroundColor: theme.card,
    },
    progressDotOn: { borderColor: theme.primary },
    progressDotDone: { borderColor: theme.primary, backgroundColor: theme.primary },
    progressNum: { fontSize: 12, fontWeight: "800", color: theme.textSecondary },
    progressNumOn: { color: theme.primary },
    progressLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 4, fontWeight: "600" },
    progressLabelOn: { color: theme.primary, fontWeight: "800" },
    iconCircle: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: theme.primary + "18",
      justifyContent: "center", alignItems: "center", marginBottom: 14,
    },
    tourLabel: { fontSize: 12, fontWeight: "800", color: theme.primary, marginBottom: 12, letterSpacing: 0.5 },
    wherePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: theme.background, marginBottom: 8 },
    whereText: { fontSize: 11, fontWeight: "700", color: theme.textSecondary },
    title: { fontSize: 19, fontWeight: "800", color: theme.textPrimary, textAlign: "center", marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 21, color: theme.textSecondary, textAlign: "center", marginBottom: 18 },
    primaryBtn: {
      width: "100%", flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
      backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, marginBottom: 10,
    },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    secondaryBtn: {
      width: "100%", flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
      backgroundColor: theme.card, borderRadius: 12, borderWidth: 1.5, borderColor: theme.primary, paddingVertical: 13, marginBottom: 6,
    },
    secondaryText: { color: theme.primary, fontSize: 15, fontWeight: "800" },
    laterBtn: { paddingVertical: 10, paddingHorizontal: 20 },
    laterText: { color: theme.textSecondary, fontSize: 14, fontWeight: "700" },
    dots: { flexDirection: "row", gap: 6, marginBottom: 16 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.border },
    dotOn: { width: 18, backgroundColor: theme.primary },
    navRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10 },
    backBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12, backgroundColor: theme.background },
    backText: { color: theme.textSecondary, fontSize: 15, fontWeight: "800" },
    nextBtn: { flex: 2, paddingVertical: 14, alignItems: "center", borderRadius: 12, backgroundColor: theme.primary },
    nextText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
}
