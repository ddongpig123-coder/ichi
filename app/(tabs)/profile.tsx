import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { schoolNameByDomain } from "../../src/data/schools";
import { departmentName, departmentsForSchool } from "../../src/data/departments";
import { gradeFromAdmissionYear, getCurrentAcademicYear } from "../../src/data/semesterTimetables";
import { NICKNAME_MAX } from "../../src/data/limits";
import { auth } from "../../src/config/firebase";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import { signOut, isSchoolVerified } from "../../src/services/authService";
import {
  clearServerPrivateAcademic,
  getUserProfile,
  updateAdmissionYear,
  updateDepartment,
  updateNickname,
} from "../../src/services/userService";
import {
  EMPTY_PRIVATE_ACADEMIC,
  hasPrivateAcademic,
  loadPrivateAcademic,
  savePrivateAcademic,
  type PrivateAcademic,
} from "../../src/services/gradRecordService";
import { isOperator } from "../../src/services/contentQueueService";
import { findBannedWords } from "../../src/utils/contentFilter";
import { displayNickname, isGuestNickname } from "../../src/utils/nickname";
import { notify } from "../../src/utils/dialog";
import { friendlyErrorBody } from "../../src/utils/writeError";
import { THEME_IDS, THEMES, themeLabel, type Theme } from "../../src/theme/themes";
import type { UserProfile } from "../../src/types/user";

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
      <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} style={styles.eyeIcon} />
    </TouchableOpacity>
  );
}

// 익명 사용자는 Firestore 문서가 없어 profile이 null일 수 있으므로
// 저장 시 로컬 상태용 최소 프로필을 만들어 화면에 즉시 반영한다
function stubProfile(uid: string): UserProfile {
  return {
    uid, email: "", nickname: "", photoURL: null, friendIds: [], createdAt: Date.now(),
    verificationLevel: 0, language: "ja", schoolDomain: null, department: null, admissionYear: null,
  };
}

// 入力チェック。問題があればエラー文のキーを返す（null = OK）。空欄は「未設定」として許す。
type FieldErrors = Partial<Record<"admissionYear" | "gpa" | "credits", string>>;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, schoolDomain } = useAuth();
  const { theme, themeId, setThemeId } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  // 運営アカウント（operators/{uid} 登録済み）のときだけコンテンツ管理メニューを出す
  const [operator, setOperator] = useState(false);

  // ニックネーム（その場で編集）
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  // 学業情報: 学部・入学年度はサーバー、GPA・単位は端末だけ（CREDIT-TRACKING §6-2）
  const [editingAcademic, setEditingAcademic] = useState(false);
  const [deptInput, setDeptInput] = useState("");
  const [admissionYearInput, setAdmissionYearInput] = useState(""); // 入学年度（学年はここから計算）
  const [privateAcademic, setPrivateAcademic] = useState<PrivateAcademic>(EMPTY_PRIVATE_ACADEMIC);
  const [privateInput, setPrivateInput] = useState<PrivateAcademic>(EMPTY_PRIVATE_ACADEMIC);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [showGpa, setShowGpa] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  // 学部の候補（講義データがある学校だけ。それ以外は自由入力）
  const departments = useMemo(
    () => departmentsForSchool(schoolDomain).filter((d) => Number(d.id) < 80), // 81〜は学部間共通の区分
    [schoolDomain]
  );

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
        setOperator(false);
        return;
      }
      isOperator(current.uid).then(setOperator);
      Promise.all([getUserProfile(current.uid), loadPrivateAcademic(current.uid)])
        .then(async ([p, local]) => {
          setProfile(p);
          setDeptInput(p?.academic?.department ?? "");
          setAdmissionYearInput(p?.admissionYear ? String(p.admissionYear) : "");
          // 旧版がサーバーに置いた成績が残っていれば、端末へ移してからサーバー側を消す（1回きり）
          const legacy = p?.academic;
          let priv = local;
          if (!priv && hasPrivateAcademic(legacy)) {
            priv = {
              gpa: legacy?.gpa ?? "",
              earnedCredits: legacy?.earnedCredits ?? "",
              requiredCredits: legacy?.requiredCredits ?? "",
              courseCount: legacy?.courseCount ?? "",
            };
            await savePrivateAcademic(current.uid, priv);
          }
          if (hasPrivateAcademic(legacy) || legacy?.grade) {
            clearServerPrivateAcademic(current.uid).catch((e) => console.warn("legacy academic cleanup failed:", e));
          }
          setPrivateAcademic(priv ?? EMPTY_PRIVATE_ACADEMIC);
          setPrivateInput(priv ?? EMPTY_PRIVATE_ACADEMIC);
        })
        // アカウント削除直後は「削除済み → 匿名で再ログイン」の間だけ認証が切れた状態になり、
        // ここの読み取りが permission-denied で落ちる。catch が無いと未処理 Promise 拒否として
        // 赤いエラー画面が出る。再ログインで user が変わればこの effect は再実行されるので、
        // 警告だけ残して握りつぶす。
        .catch((e) => console.warn("profile load failed:", e));
    }, [user])
  );

  // ── ニックネーム ─────────────────────────────────────
  function startEditNickname() {
    setNicknameInput(isGuestNickname(profile?.nickname) ? "" : (profile?.nickname ?? ""));
    setEditingNickname(true);
  }

  async function handleSaveNickname() {
    if (!user || savingNickname) return;
    const name = nicknameInput.trim();
    if (!name) return notify(t("account.errNickname"));
    const hits = findBannedWords(name);
    if (hits.length) return notify(t("profile.nicknameBanned"), hits.map((w) => `「${w}」`).join(" "));
    setSavingNickname(true);
    try {
      await updateNickname(user.uid, name);
      setProfile((p) => ({ ...(p ?? stubProfile(user.uid)), nickname: name }));
      setEditingNickname(false);
    } catch (e: any) {
      notify(t("common.saveFailed"), friendlyErrorBody(e, t));
    } finally {
      setSavingNickname(false);
    }
  }

  // ── 学業情報 ─────────────────────────────────────────
  function validateAcademic(): { errors: FieldErrors; admissionYear: number | null } {
    const errors: FieldErrors = {};
    const thisYear = getCurrentAcademicYear();
    const minYear = thisYear - 10;
    const maxYear = thisYear + 1; // 4月入学前（3月）に入れる人がいる
    let admissionYear: number | null = null;
    const y = admissionYearInput.trim();
    if (y) {
      const n = Number(y);
      if (!/^\d{4}$/.test(y) || n < minYear || n > maxYear) {
        errors.admissionYear = `${t("profile.errAdmissionYear")} (${minYear}〜${maxYear})`;
      } else {
        admissionYear = n;
      }
    }
    const gpa = privateInput.gpa.trim();
    if (gpa && !(/^\d(\.\d{1,2})?$/.test(gpa) && Number(gpa) <= 4.5)) {
      errors.gpa = t("profile.errGpa");
    }
    const credit = (v: string) => !v.trim() || (/^\d{1,3}$/.test(v.trim()) && Number(v) <= 300);
    if (!credit(privateInput.earnedCredits) || !credit(privateInput.requiredCredits) || !credit(privateInput.courseCount)) {
      errors.credits = t("profile.errCredits");
    }
    return { errors, admissionYear };
  }

  async function handleSaveAcademic() {
    if (!user || savingAcademic) return;
    const { errors, admissionYear } = validateAcademic();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const priv: PrivateAcademic = {
      gpa: privateInput.gpa.trim(),
      earnedCredits: privateInput.earnedCredits.trim(),
      requiredCredits: privateInput.requiredCredits.trim(),
      courseCount: privateInput.courseCount.trim(),
    };
    setSavingAcademic(true);
    try {
      await updateDepartment(user.uid, deptInput);
      await updateAdmissionYear(user.uid, admissionYear);
      await savePrivateAcademic(user.uid, priv);
      setProfile((p) => ({
        ...(p ?? stubProfile(user.uid)),
        academic: { ...(p?.academic ?? { grade: "", gpa: "", earnedCredits: "", requiredCredits: "", courseCount: "" }), department: deptInput.trim() },
        admissionYear,
      }));
      setPrivateAcademic(priv);
      setEditingAcademic(false);
    } catch (e: any) {
      notify(t("common.saveFailed"), friendlyErrorBody(e, t));
    } finally {
      setSavingAcademic(false);
    }
  }

  function cancelEditAcademic() {
    setDeptInput(profile?.academic?.department ?? "");
    setAdmissionYearInput(profile?.admissionYear ? String(profile.admissionYear) : "");
    setPrivateInput(privateAcademic);
    setFieldErrors({});
    setEditingAcademic(false);
  }

  // 表示用の学部名（候補から選んだものは今の言語で）
  const savedDept = profile?.academic?.department ?? "";
  const deptMatch = departments.find((d) => d.nameJa === savedDept || d.nameKo === savedDept || d.id === savedDept);
  const deptLabel = deptMatch ? departmentName(deptMatch, language) : savedDept;
  const gradeLabel = profile?.admissionYear
    ? `${gradeFromAdmissionYear(profile.admissionYear)}${t("profile.gradeSuffix")}`
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
      {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={styles.avatar} /> : null}

      <Text style={styles.label}>{t("account.nickname")}</Text>
      {editingNickname ? (
        <>
          <View style={styles.inlineEditRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder={t("account.nicknamePlaceholder")}
              placeholderTextColor={theme.textSecondary}
              maxLength={NICKNAME_MAX}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveNickname}
            />
            <TouchableOpacity
              style={[styles.smallButton, (!nicknameInput.trim() || savingNickname) && styles.disabled]}
              onPress={handleSaveNickname}
              disabled={!nicknameInput.trim() || savingNickname}
            >
              <Text style={styles.smallButtonText}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inlineMetaRow}>
            <Text style={styles.hint}>{t("profile.nicknameHint")}</Text>
            <Text style={styles.hint}>{nicknameInput.length}/{NICKNAME_MAX}</Text>
          </View>
          <TouchableOpacity onPress={() => setEditingNickname(false)} hitSlop={8}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.valueEditRow} onPress={startEditNickname} activeOpacity={0.6}>
          <Text style={styles.value}>{displayNickname(profile?.nickname, t("common.guest"))}</Text>
          <Ionicons name="pencil" size={14} color={theme.primary} />
          <Text style={styles.editInline}>{t("common.edit")}</Text>
        </TouchableOpacity>
      )}

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
        {editingAcademic ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={cancelEditAcademic} hitSlop={8}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveAcademic} disabled={savingAcademic} hitSlop={8}>
              <Text style={[styles.editText, savingAcademic && styles.disabled]}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingAcademic(true)} hitSlop={8}>
            <Text style={styles.editText}>{t("common.edit")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {editingAcademic ? (
        <>
          <Text style={styles.label}>{t("profile.department")}</Text>
          {departments.length ? (
            <View style={styles.chipWrap}>
              {departments.map((d) => {
                const on = d.nameJa === deptInput;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setDeptInput(on ? "" : d.nameJa)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{departmentName(d, language)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder={t("profile.departmentPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={deptInput}
              onChangeText={setDeptInput}
              maxLength={40}
            />
          )}
          <Text style={styles.label}>{t("profile.admissionYear")}</Text>
          <TextInput
            style={[styles.input, fieldErrors.admissionYear && styles.inputError]}
            placeholder={t("profile.admissionYearPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            maxLength={4}
            value={admissionYearInput}
            onChangeText={setAdmissionYearInput}
          />
          {fieldErrors.admissionYear ? (
            <Text style={styles.errorText}>{fieldErrors.admissionYear}</Text>
          ) : (
            <Text style={styles.hint}>{t("profile.gradeAutoHint")}</Text>
          )}

          <View style={styles.privateBox}>
            <View style={styles.privateHeader}>
              <Ionicons name="phone-portrait-outline" size={14} color={theme.textSecondary} />
              <Text style={styles.hint}>{t("profile.privateLocalNote")}</Text>
            </View>
            <Text style={styles.label}>GPA</Text>
            <TextInput
              style={[styles.input, fieldErrors.gpa && styles.inputError]}
              placeholder={t("profile.gpaPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              maxLength={4}
              value={privateInput.gpa}
              onChangeText={(v) => setPrivateInput((a) => ({ ...a, gpa: v }))}
            />
            {fieldErrors.gpa ? <Text style={styles.errorText}>{fieldErrors.gpa}</Text> : null}
            <Text style={styles.label}>{t("profile.creditsLabel")}</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }, fieldErrors.credits && styles.inputError]}
                placeholder={t("profile.earnedPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={3}
                value={privateInput.earnedCredits}
                onChangeText={(v) => setPrivateInput((a) => ({ ...a, earnedCredits: v }))}
              />
              <TextInput
                style={[styles.input, { flex: 1 }, fieldErrors.credits && styles.inputError]}
                placeholder={t("profile.requiredPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={3}
                value={privateInput.requiredCredits}
                onChangeText={(v) => setPrivateInput((a) => ({ ...a, requiredCredits: v }))}
              />
            </View>
            <Text style={styles.label}>{t("profile.courseCount")}</Text>
            <TextInput
              style={[styles.input, fieldErrors.credits && styles.inputError]}
              placeholder={t("profile.courseCountPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={3}
              value={privateInput.courseCount}
              onChangeText={(v) => setPrivateInput((a) => ({ ...a, courseCount: v }))}
            />
            {fieldErrors.credits ? <Text style={styles.errorText}>{fieldErrors.credits}</Text> : null}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>{t("profile.departmentGrade")}</Text>
          <Text style={styles.value}>
            {deptLabel || gradeLabel ? [deptLabel, gradeLabel].filter(Boolean).join(" ") : t("common.notSet")}
          </Text>
          <Text style={styles.label}>{t("profile.admissionYear")}</Text>
          <Text style={styles.value}>
            {profile?.admissionYear ? String(profile.admissionYear) : t("common.notSet")}
          </Text>
          <Text style={styles.label}>GPA</Text>
          <SecretValue
            value={privateAcademic.gpa}
            visible={showGpa}
            onToggle={() => setShowGpa((v) => !v)}
            styles={styles}
            emptyLabel={t("common.notSet")}
          />
          <Text style={styles.label}>{t("profile.earnedCredits")}</Text>
          <SecretValue
            value={
              privateAcademic.earnedCredits
                ? `${privateAcademic.earnedCredits}${privateAcademic.requiredCredits ? ` / ${privateAcademic.requiredCredits}` : ""}${t("profile.creditsSuffix")}`
                : ""
            }
            visible={showCredits}
            onToggle={() => setShowCredits((v) => !v)}
            styles={styles}
            emptyLabel={t("common.notSet")}
          />
          <Text style={styles.label}>{t("profile.courseCount")}</Text>
          <Text style={styles.value}>
            {privateAcademic.courseCount
              ? `${privateAcademic.courseCount}${t("profile.courseSuffix")}`
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
                {themeLabel(th, language)}{selected ? " ✓" : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 設定 — ブロックリスト管理・表示言語 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("profile.settingsSection")}</Text>
      </View>
      {/* 学校の変更（1.1 / docs/BOARD-ACCESS.md §3-3 Q2）
          クールダウンなし。これが無いと、学校を選び間違えた人は再インストールしか
          手段がなく、匿名 uid が変わってデータが消えてしまう。
          画面は onboarding の mode=school（規約・言語ステップを飛ばす）を再利用する。 */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => router.push("/onboarding?mode=school")}
      >
        <Text style={styles.settingText}>{t("school.changeLabel")}</Text>
        <View style={styles.settingValueRow}>
          <Text style={styles.settingText}>
            {schoolNameByDomain(schoolDomain, language) ?? t("school.notSelected")}
          </Text>
          <Text style={styles.settingArrow}>›</Text>
        </View>
      </TouchableOpacity>
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
      {/* お問い合わせ — アプリ内フォーム（inquiries に保存） */}
      <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/contact")}>
        <Text style={styles.settingText}>{t("profile.contact")}</Text>
        <Text style={styles.settingArrow}>›</Text>
      </TouchableOpacity>
      {/* 規約・方針 — 同意したあとも読み返せるように（オンボーディング以外に入口が無かった） */}
      <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/terms")}>
        <Text style={styles.settingText}>{t("legal.termsTitle")}</Text>
        <Text style={styles.settingArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/privacy")}>
        <Text style={styles.settingText}>{t("legal.privacyTitle")}</Text>
        <Text style={styles.settingArrow}>›</Text>
      </TouchableOpacity>
      {/* コンテンツ管理 — 運営アカウントのみ（docs/CONTENT-OPS.md §9） */}
      {operator ? (
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/admin")}>
          <Text style={styles.settingText}>{t("admin.menu")}</Text>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      ) : null}

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
    inputError: { borderColor: theme.accent },
    errorText: { fontSize: 12, color: theme.accent },
    hint: { fontSize: 12, color: theme.textSecondary, flexShrink: 1 },
    avatar: { width: 72, height: 72, borderRadius: 36, alignSelf: "center", marginBottom: 8 },
    label: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
    value: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    valueEditRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    editInline: { fontSize: 12, fontWeight: "700", color: theme.primary },
    inlineEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    inlineMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    smallButton: { backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
    smallButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    cancelText: { fontSize: 13, fontWeight: "600", color: theme.textSecondary },
    disabled: { opacity: 0.4 },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingTop: 16,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 18 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    editText: { fontSize: 13, fontWeight: "700", color: theme.primary },
    secretRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    eyeIcon: { fontSize: 16, color: theme.textSecondary },
    row: { flexDirection: "row", gap: 8 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { fontSize: 12.5, fontWeight: "700", color: theme.textSecondary },
    chipTextOn: { color: "#fff" },
    privateBox: {
      marginTop: 12,
      padding: 12,
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
    },
    privateHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
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
    // 現在値と矢印を並べる行（学校のように「値＋遷移」がある設定）
    settingValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  });
}
