import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/contexts/ThemeContext";
import type { Theme } from "../src/theme/themes";
import { useI18n } from "../src/contexts/I18nContext";
import { useAuth } from "../src/contexts/AuthContext";
import { completeOnboarding, updateSchoolSelection } from "../src/services/userService";
import { SCHOOLS } from "../src/data/schools";
import type { UserLanguage } from "../src/types/user";

export const ONBOARDED_KEY = "ichi:onboarded";

// オンボーディング: 規約同意 → 言語選択 → 学校選択 → 利用開始（ゲストのまま）
// Penmark式の低い参入障壁: アカウント登録は要求しない。
// mode="school" で開くと「学校選択のみ」モード（規約同意済みユーザーが後から学校を選ぶ。
// 規約・言語ステップをスキップし、agreedTermsAt も再記録しない）。
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, language, setLanguage } = useI18n();
  const { user, refreshSchoolDomain } = useAuth();

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const schoolOnly = mode === "school";

  const [step, setStep] = useState<1 | 2 | 3>(schoolOnly ? 3 : 1);
  const [schoolDomain, setSchoolDomain] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function handleStart() {
    if (schoolDomain === undefined) return;
    setBusy(true);
    try {
      if (user) {
        if (schoolOnly) {
          // 規約同意済み。学校のみ更新（agreedTermsAt は最初の同意日時を保持）。
          await updateSchoolSelection(user.uid, schoolDomain).catch((e) =>
            console.warn("school update failed:", e)
          );
        } else {
          // 初回: 同意日時・言語・学校をusersに記録（ゲストuidでも可）。
          // 失敗してもローカルフラグで先へ進める（次回起動時の自己修復に任せる）。
          await completeOnboarding(user.uid, language, schoolDomain).catch((e) =>
            console.warn("onboarding save failed:", e)
          );
        }
        // 保存した学校を AuthContext に即反映（掲示板などが reload なしで実校スコープを使えるように）
        await refreshSchoolDomain().catch(() => {});
      }
      if (schoolOnly) {
        // 元の画面（掲示板等）へ戻る。学校が入ったので導線UIが実校スコープに切り替わる。
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
      } else {
        await AsyncStorage.setItem(ONBOARDED_KEY, "1");
        router.replace("/(tabs)");
      }
    } finally {
      setBusy(false);
    }
  }

  function selectLanguage(lang: UserLanguage) {
    setLanguage(lang);
    setStep(3);
  }

  // 左上の戻る。ステップ間は前のステップへ、学校のみモードは呼び出し元へ戻る。
  function handleBack() {
    if (schoolOnly) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
      return;
    }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setStep(1); return; }
    // step 1（初回起動の規約ステップ）は前がないので、戻れる場合のみ戻る。
    if (router.canGoBack()) router.back();
  }

  // 初回起動の規約ステップ（前がない）以外は戻るを表示。
  const showBack = schoolOnly || step > 1 || router.canGoBack();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {showBack && (
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.appName}>ichi</Text>

        {step === 1 && (
          <>
            <Text style={styles.title}>{t("onboarding.termsTitle")}</Text>
            <View style={styles.termsBox}>
              <Text style={styles.termsText}>{t("onboarding.termsSummary")}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/terms")}>
              <Text style={styles.linkText}>{t("onboarding.readTerms")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/privacy")}>
              <Text style={styles.linkText}>{t("onboarding.readPrivacy")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
              <Text style={styles.primaryButtonText}>{t("onboarding.agree")}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>{t("onboarding.languageTitle")}</Text>
            <Text style={styles.subtitle}>{t("onboarding.languageSubtitle")}</Text>
            <TouchableOpacity
              style={[styles.choiceButton, language === "ja" && styles.choiceButtonActive]}
              onPress={() => selectLanguage("ja")}
            >
              <Text style={styles.choiceText}>日本語</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choiceButton, language === "ko" && styles.choiceButtonActive]}
              onPress={() => selectLanguage("ko")}
            >
              <Text style={styles.choiceText}>한국어</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>{t("onboarding.schoolTitle")}</Text>
            <Text style={styles.subtitle}>{t("onboarding.schoolSubtitle")}</Text>
            {SCHOOLS.map((school) => (
              <TouchableOpacity
                key={school.domain}
                style={[styles.choiceButton, schoolDomain === school.domain && styles.choiceButtonActive]}
                onPress={() => setSchoolDomain(school.domain)}
              >
                <Text style={styles.choiceText}>
                  {language === "ko" ? school.nameKo : school.nameJa}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.choiceButton, schoolDomain === null && styles.choiceButtonActive]}
              onPress={() => setSchoolDomain(null)}
            >
              <Text style={styles.choiceText}>{t("onboarding.schoolOther")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (schoolDomain === undefined || busy) && styles.buttonDisabled,
              ]}
              onPress={handleStart}
              disabled={schoolDomain === undefined || busy}
            >
              <Text style={styles.primaryButtonText}>{t("onboarding.start")}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ステップインジケーター（学校のみモードは単一ステップなので非表示） */}
        {!schoolOnly && (
          <View style={styles.dots}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={[styles.dot, step === s && styles.dotActive]} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    topBar: { height: 44, justifyContent: "center", paddingHorizontal: 12 },
    backIcon: { fontSize: 32, color: theme.primary, lineHeight: 34, width: 30 },
    content: { paddingHorizontal: 28, paddingBottom: 40 },
    appName: {
      fontSize: 34,
      fontWeight: "800",
      color: theme.primary,
      textAlign: "center",
      marginBottom: 28,
    },
    title: { fontSize: 20, fontWeight: "700", color: theme.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 13, color: theme.textSecondary, marginBottom: 20, lineHeight: 19 },

    termsBox: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      marginBottom: 14,
    },
    termsText: { fontSize: 13, color: theme.textPrimary, lineHeight: 20 },
    linkText: {
      color: theme.primary,
      fontSize: 13,
      textDecorationLine: "underline",
      marginBottom: 10,
    },

    choiceButton: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    choiceButtonActive: { borderColor: theme.primary, borderWidth: 2 },
    choiceText: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },

    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 20,
    },
    primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    buttonDisabled: { opacity: 0.4 },

    dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 28 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    dotActive: { backgroundColor: theme.primary },
  });
}
