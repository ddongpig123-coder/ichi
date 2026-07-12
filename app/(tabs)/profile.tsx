import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { signOut } from "../../src/services/authService";
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
}: {
  value: string;
  visible: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity style={styles.secretRow} onPress={onToggle}>
      <Text style={styles.value}>{visible ? (value || "未設定") : "●●●●"}</Text>
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
  const { user } = useAuth();
  const { theme, themeId, setThemeId } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [academicInput, setAcademicInput] = useState<AcademicInfo>(EMPTY_ACADEMIC);
  const [editingAcademic, setEditingAcademic] = useState(false);
  const [showGpa, setShowGpa] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    // 익명 사용자는 문서가 없을 수 있음 (최초 저장 시 자동 생성됨)
    getUserProfile(user.uid).then((p) => {
      setProfile(p);
      setAcademicInput(p?.academic ?? EMPTY_ACADEMIC);
    });
  }, [user]);

  async function handleSaveAcademic() {
    if (!user) return;
    try {
      await updateAcademicInfo(user.uid, academicInput);
      setProfile((p) => ({ ...(p ?? stubProfile(user.uid)), academic: academicInput }));
      setEditingAcademic(false);
    } catch (e: any) {
      Alert.alert("保存に失敗しました", e.message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContainer}>
      {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={styles.avatar} /> : null}

      <Text style={styles.label}>ニックネーム</Text>
      <Text style={styles.value}>{profile?.nickname || "ゲスト"}</Text>

      {profile?.email ? (
        <>
          <Text style={styles.label}>メールアドレス</Text>
          <Text style={styles.value}>{profile.email}</Text>
        </>
      ) : null}

      {/* 学業情報 — 본인만 볼 수 있는 정보. GPA/単位는 기본 숨김, 탭하면 표시 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>🔒 学業情報</Text>
        <TouchableOpacity onPress={() => (editingAcademic ? handleSaveAcademic() : setEditingAcademic(true))}>
          <Text style={styles.editText}>{editingAcademic ? "保存" : "編集"}</Text>
        </TouchableOpacity>
      </View>

      {editingAcademic ? (
        <>
          <Text style={styles.label}>学部・学科</Text>
          <TextInput
            style={styles.input}
            placeholder="例: 経済学部"
            placeholderTextColor={theme.textSecondary}
            value={academicInput.department}
            onChangeText={(t) => setAcademicInput((a) => ({ ...a, department: t }))}
          />
          <Text style={styles.label}>学年</Text>
          <TextInput
            style={styles.input}
            placeholder="例: 2"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={academicInput.grade}
            onChangeText={(t) => setAcademicInput((a) => ({ ...a, grade: t }))}
          />
          <Text style={styles.label}>GPA</Text>
          <TextInput
            style={styles.input}
            placeholder="例: 3.42"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={academicInput.gpa}
            onChangeText={(t) => setAcademicInput((a) => ({ ...a, gpa: t }))}
          />
          <Text style={styles.label}>取得単位 / 卒業必要単位</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="例: 68"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={academicInput.earnedCredits}
              onChangeText={(t) => setAcademicInput((a) => ({ ...a, earnedCredits: t }))}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="例: 124"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={academicInput.requiredCredits}
              onChangeText={(t) => setAcademicInput((a) => ({ ...a, requiredCredits: t }))}
            />
          </View>
          <Text style={styles.label}>今学期の履修科目数</Text>
          <TextInput
            style={styles.input}
            placeholder="例: 12"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={academicInput.courseCount}
            onChangeText={(t) => setAcademicInput((a) => ({ ...a, courseCount: t }))}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>学部・学科 / 学年</Text>
          <Text style={styles.value}>
            {profile?.academic?.department || profile?.academic?.grade
              ? `${profile?.academic?.department ?? ""}${profile?.academic?.grade ? ` ${profile.academic.grade}年` : ""}`.trim()
              : "未設定"}
          </Text>
          <Text style={styles.label}>GPA</Text>
          <SecretValue
            value={profile?.academic?.gpa ?? ""}
            visible={showGpa}
            onToggle={() => setShowGpa((v) => !v)}
            styles={styles}
          />
          <Text style={styles.label}>取得単位</Text>
          <SecretValue
            value={
              profile?.academic?.earnedCredits
                ? `${profile.academic.earnedCredits}${profile.academic.requiredCredits ? ` / ${profile.academic.requiredCredits}` : ""}単位`
                : ""
            }
            visible={showCredits}
            onToggle={() => setShowCredits((v) => !v)}
            styles={styles}
          />
          <Text style={styles.label}>今学期の履修科目数</Text>
          <Text style={styles.value}>
            {profile?.academic?.courseCount ? `${profile.academic.courseCount}科目` : "未設定"}
          </Text>
        </>
      )}

      {/* テーマ選択 — 즉시 적용 + AsyncStorage 저장 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>🎨 テーマ</Text>
      </View>
      <View style={styles.themeGrid}>
        {THEME_IDS.map((id) => {
          const t = THEMES[id];
          const selected = id === themeId;
          return (
            <TouchableOpacity
              key={id}
              style={[
                styles.themeCard,
                { backgroundColor: t.background, borderColor: selected ? theme.primary : theme.border },
                selected && styles.themeCardSelected,
              ]}
              onPress={() => setThemeId(id)}
            >
              <View style={styles.themeSwatchRow}>
                <View style={[styles.themeSwatch, { backgroundColor: t.primary }]} />
                <View style={[styles.themeSwatch, { backgroundColor: t.accent }]} />
                <View style={[styles.themeSwatch, { backgroundColor: t.card, borderWidth: 1, borderColor: t.border }]} />
              </View>
              <Text style={[styles.themeLabel, { color: t.textPrimary }]}>
                {t.label}{selected ? " ✓" : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 로그인 기능은 나중에 다시 붙일 예정 — 이메일 계정일 때만 로그아웃 노출 */}
      {user && !user.isAnonymous ? (
        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
          <Text style={styles.signOutText}>ログアウト</Text>
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
  });
}
