import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { auth } from "../../src/config/firebase";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { signOut, isSchoolVerified } from "../../src/services/authService";
import { getUserProfile, updateAcademicInfo } from "../../src/services/userService";
import { THEME_IDS, THEMES, type Theme } from "../../src/theme/themes";
import type { AcademicInfo, UserProfile } from "../../src/types/user";

const EMPTY_ACADEMIC: AcademicInfo = {
  department: "",
  grade: "",
  gpa: "",
  earnedCredits: "",
  requiredCredits: "",
  courseCount: "",
};

// 은행 잔액 숨기기 스타일: 기본은 ●●●● 로 가리고, 누르면 표시/숨김 토글
function SecretValue({
  value,
  visible,
  onToggle,
  styles,
  emptyLabel,
}: {
  value: string;
  visible: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof makeStyles>;
  emptyLabel: string;
}) {
  return (
    <TouchableOpacity style={styles.secretRow} onPress={onToggle}>
      <Text style={styles.value}>{visible ? (value || emptyLabel) : "●●●●"}</Text>
      <Text style={styles.eyeIcon}>{visible ? "🙈" : "👁"}</Text>
    </TouchableOpacity>
  );
}

// 익명 사용자는 Firestore 문서가 없어 profile이 null일 수 있으므로
// 저장 시 로컬 상태용 최소 프로필을 만들어 화면에 즉시 반영한다
function stubProfile(uid: string): UserProfile {
  return {
    uid, email: "", nickname: "", photoURL: null, friendIds: [], createdAt: Date.now(),
    verificationLevel: 0, language: "ja", schoolDomain: null, department: null,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, themeId, setThemeId } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [academicInput, setAcademicInput] = useState<AcademicInfo>(EMPTY_ACADEMIC);
  const [editingAcademic, setEditingAcademic] = useState(false);
  const [showGpa, setShowGpa] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  // 画面フォーカス毎に再取得する。
  // linkWithCredential(アカウント連携)はuidが変わらず onAuthStateChanged が
  // 再発火しないため、useEffect([user]) だけでは登録直後の状態変化を拾えない。
  // 逆に初回マウント時は auth.currentUser がまだnullのことがあるため、
  // コンテキストのuser(認証初期化完了で更新される)を依存に入れて両方カバーする。
  useFocusEffect(
    useCallback(() => {
      const current = auth.currentUser ?? user;
      setIsGuest(current?.isAnonymous ?? true);
      if (!current) {
        setProfile(null);
        return;
      }
      getUserProfile(current.uid).then((p) => {
        setProfile(p);
        setAcademicInput(p?.academic ?? EMPTY_ACADEMIC);
      });
    }, [user])
  );

  async function handleSaveAcademic() {
    if (!user) return;
    try {
      await updateAcademicInfo(user.uid, academicInput);
      setProfile((p) => ({ ...(p ?? stubProfile(user.uid)), academic: academicInput }));
      setEditingAcademic(false);
    } catch (e: any) {
      Alert.alert(t("common.saveFailed"), e.message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContainer}>
      {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={styles.avatar} /> : null}

      <Text style={styles.label}>{t("account.nickname")}</Text>
      <Text style={styles.value}>{profile?.nickname || t("common.guest")}</Text>

      {/* アカウント状態 — ゲストには登録を促し、登録済みなら管理画面へ */}
      <TouchableOpacity style={styles.accountRow} onPress={() => router.push("/account")}>
        {isGuest ? (
          <>
            <Text style={styles.accountRowText}>{t("account.guestBadge")}</Text>
            <Text style={styles.accountRowAction}>{t("account.goRegister")}</Text>
          </>
        ) : (
          <>
            <Text style={styles.accountRowText}>
              {t("account.registeredBadge")}
              {isSchoolVerified(auth.currentUser) ? ` ・ ${t("account.verifiedBadge")}` : ""}
            </Text>
            <Text style={styles.accountRowAction}>{t("account.goManage")}</Text>
          </>
        )}
      </TouchableOpacity>

      {profile?.email ? (
        <>
          <Text style={styles.label}>{t("account.email")}</Text>
          <Text style={styles.value}>{profile.email}</Text>
        </>
      ) : null}

      {/* 学業情報 — 본인만 볼 수 있는 정보. GPA/単位는 기본 숨김, 탭하면 표시 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("profile.academicInfo")}</Text>
        <TouchableOpacity onPress={() => (editingAcademic ? handleSaveAcademic() : setEditingAcademic(true))}>
          <Text style={styles.editText}>{editingAcademic ? t("common.save") : t("common.edit")}</Text>
        </TouchableOpacity>
      </View>

      {editingAcademic ? (
        <>
          <Text style={styles.label}>{t("profile.department")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("profile.departmentPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={academicInput.department}
            onChangeText={(v) => setAcademicInput((a) => ({ ...a, department: v }))}
          />
          <Text style={styles.label}>{t("profile.grade")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("profile.gradePlaceholder")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={academicInput.grade}
            onChangeText={(v) => setAcademicInput((a) => ({ ...a, grade: v }))}
          />
          <Text style={styles.label}>GPA</Text>
          <TextInput
            style={styles.input}
            placeholder={t("profile.gpaPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={academicInput.gpa}
            onChangeText={(v) => setAcademicInput((a) => ({ ...a, gpa: v }))}
          />
          <Text style={styles.label}>{t("profile.creditsLabel")}</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t("profile.earnedPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={academicInput.earnedCredits}
              onChangeText={(v) => setAcademicInput((a) => ({ ...a, earnedCredits: v }))}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t("profile.requiredPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={academicInput.requiredCredits}
              onChangeText={(v) => setAcademicInput((a) => ({ ...a, requiredCredits: v }))}
            />
          </View>
          <Text style={styles.label}>{t("profile.courseCount")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("profile.courseCountPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={academicInput.courseCount}
            onChangeText={(v) => setAcademicInput((a) => ({ ...a, courseCount: v }))}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>{t("profile.departmentGrade")}</Text>
          <Text style={styles.value}>
            {profile?.academic?.department || profile?.academic?.grade
              ? `${profile?.academic?.department ?? ""}${profile?.academic?.grade ? ` ${profile.academic.grade}${t("profile.gradeSuffix")}` : ""}`.trim()
              : t("common.notSet")}
          </Text>
          <Text style={styles.label}>GPA</Text>
          <SecretValue
            value={profile?.academic?.gpa ?? ""}
            visible={showGpa}
            onToggle={() => setShowGpa((v) => !v)}
            styles={styles}
            emptyLabel={t("common.notSet")}
          />
          <Text style={styles.label}>{t("profile.earnedCredits")}</Text>
          <SecretValue
            value={
              profile?.academic?.earnedCredits
                ? `${profile.academic.earnedCredits}${profile.academic.requiredCredits ? ` / ${profile.academic.requiredCredits}` : ""}${t("profile.creditsSuffix")}`
                : ""
            }
            visible={showCredits}
            onToggle={() => setShowCredits((v) => !v)}
            styles={styles}
            emptyLabel={t("common.notSet")}
          />
          <Text style={styles.label}>{t("profile.courseCount")}</Text>
          <Text style={styles.value}>
            {profile?.academic?.courseCount
              ? `${profile.academic.courseCount}${t("profile.courseSuffix")}`
              : t("common.notSet")}
          </Text>
        </>
      )}

      {/* テーマ選択 — 즉시 적용 + AsyncStorage 저장 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("profile.themeSection")}</Text>
      </View>
      <View style={styles.themeGrid}>
        {THEME_IDS.map((id) => {
          const th = THEMES[id];
          const selected = id === themeId;
          return (
            <TouchableOpacity
              key={id}
              style={[
                styles.themeCard,
                { backgroundColor: th.background, borderColor: selected ? theme.primary : theme.border },
                selected && styles.themeCardSelected,
              ]}
              onPress={() => setThemeId(id)}
            >
              <View style={styles.themeSwatchRow}>
                <View style={[styles.themeSwatch, { backgroundColor: th.primary }]} />
                <View style={[styles.themeSwatch, { backgroundColor: th.accent }]} />
                <View style={[styles.themeSwatch, { backgroundColor: th.card, borderWidth: 1, borderColor: th.border }]} />
              </View>
              <Text style={[styles.themeLabel, { color: th.textPrimary }]}>
                {th.label}{selected ? " ✓" : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 設定 — ブロックリスト管理・表示言語 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("profile.settingsSection")}</Text>
      </View>
      <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/blocked-users")}>
        <Text style={styles.settingText}>{t("profile.blockList")}</Text>
        <Text style={styles.settingArrow}>›</Text>
      </TouchableOpacity>
      {/* 표시 언어 토글 — 온보딩 이후에도 한/일 전환 가능하게 (AsyncStorage 저장) */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setLanguage(language === "ja" ? "ko" : "ja")}
      >
        <Text style={styles.settingText}>{t("profile.languageRow")}</Text>
        <Text style={styles.settingText}>{language === "ja" ? "日本語" : "한국어"}</Text>
      </TouchableOpacity>

      {/* 로그인 기능은 나중에 다시 붙일 예정 — 이메일 계정일 때만 로그아웃 노출 */}
      {user && !user.isAnonymous ? (
        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
          <Text style={styles.signOutText}>{t("account.logout")}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

// 테마가 바뀌면 색이 함께 바뀌도록 StyleSheet를 테마 함수로 생성
function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    formContainer: { padding: 20, gap: 10 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      backgroundColor: theme.card,
    },
    avatar: { width: 72, height: 72, borderRadius: 36, alignSelf: "center", marginBottom: 8 },
    label: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
    value: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingTop: 16,
    },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    editText: { fontSize: 13, fontWeight: "700", color: theme.primary },
    secretRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    eyeIcon: { fontSize: 14 },
    row: { flexDirection: "row", gap: 8 },
    themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    themeCard: {
      width: "30%",
      minWidth: 96,
      borderWidth: 2,
      borderRadius: 12,
      padding: 10,
      gap: 8,
    },
    themeCardSelected: { borderWidth: 2 },
    themeSwatchRow: { flexDirection: "row", gap: 4 },
    themeSwatch: { width: 16, height: 16, borderRadius: 8 },
    themeLabel: { fontSize: 12, fontWeight: "700" },
    signOutBtn: { marginTop: 20, alignItems: "center", paddingVertical: 10 },
    signOutText: { color: theme.accent, fontWeight: "600" },
    accountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.primary + "1A",
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 12,
    },
    accountRowText: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    accountRowAction: { fontSize: 13, fontWeight: "700", color: theme.primary },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginTop: 8,
    },
    settingText: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    settingArrow: { fontSize: 20, color: theme.textSecondary },
  });
}
