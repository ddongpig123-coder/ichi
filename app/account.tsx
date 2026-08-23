import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useI18n } from "../src/contexts/I18nContext";
import {
  linkAnonymousWithEmail,
  linkAnonymousWithMicrosoft,
  linkAnonymousWithSocial,
  signInWithEmail,
  signInWithMicrosoft,
  signInWithSocial,
  signOut,
  isUniversityEmail,
  isSchoolVerified,
  sendSchoolVerificationEmail,
  reloadAndCheckEmailVerified,
  MICROSOFT_WEB_ONLY_ERROR,
  SOCIAL_WEB_ONLY_ERROR,
  type SocialProviderId,
} from "../src/services/authService";
import { auth } from "../src/config/firebase";
import { updateMicrosoftAccountInfo } from "../src/services/userService";

// Alert.alert は react-native-web では何も表示されない(no-op)ため、
// Webでは window.alert / window.confirm にフォールバックする
function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  labels: { cancel: string; ok: string }
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: labels.cancel, style: "cancel" },
      { text: labels.ok, style: "destructive", onPress: onConfirm },
    ]);
  }
}

// アカウント登録・ログイン画面
// ゲスト(匿名)ユーザー: メール登録(=アカウント連携。uidを維持しデータが残る) or 既存アカウントへログイン
// 登録済みユーザー: アカウント情報表示 + ログアウト
export default function AccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  // 学校認証バッジ表示。auth.currentUser基準（reload後の最新状態を反映するためローカルstate）
  const [verified, setVerified] = useState(() => isSchoolVerified(auth.currentUser));

  const isGuest = user?.isAnonymous ?? true;
  const isUniEmail = !!user?.email && isUniversityEmail(user.email);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)");
  }

  async function handleRegister() {
    if (!nickname.trim()) return notify(t("account.inputError"), t("account.errNickname"));
    if (!email.trim()) return notify(t("account.inputError"), t("account.errEmail"));
    if (password.length < 6) return notify(t("account.inputError"), t("account.errPasswordLength"));
    if (password !== passwordConfirm) return notify(t("account.inputError"), t("account.errPasswordMismatch"));

    setBusy(true);
    try {
      await linkAnonymousWithEmail(email.trim(), password, nickname.trim());
      // 大学メールなら所有確認の認証メールを自動送信（失敗しても登録は成立）
      if (isUniversityEmail(email.trim())) {
        sendSchoolVerificationEmail().catch(() => {});
      }
      notify(t("account.registerDone"), t("account.registerDoneMessage"));
      goBack();
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use" || e.code === "auth/credential-already-in-use") {
        notify(t("account.errCannotRegister"), t("account.errEmailInUse"));
      } else if (e.code === "auth/invalid-email") {
        notify(t("account.errCannotRegister"), t("account.errInvalidEmail"));
      } else {
        notify(t("account.errRegisterFailed"), e.message ?? String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) return notify(t("account.inputError"), t("account.errLoginInput"));
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      notify(t("account.loginDone"), t("account.welcomeBack"));
      goBack();
    } catch (e: any) {
      notify(t("account.errLoginFailed"), t("account.errLoginCheck"));
    } finally {
      setBusy(false);
    }
  }

  // Microsoft(大学アカウント)連携 — Web専用。ネイティブ対応はPhase 1bで別途。
  async function handleMicrosoft() {
    setBusy(true);
    try {
      if (mode === "register") {
        const u = await linkAnonymousWithMicrosoft();
        const msEmail = u.email ?? "";
        const isUni = isUniversityEmail(msEmail);
        await updateMicrosoftAccountInfo(
          u.uid,
          msEmail,
          u.displayName?.trim() || t("common.guest"),
          isUni ? msEmail.split("@")[1] : null
        );
        notify(
          t("account.registerDone"),
          isUni ? t("account.msRegisterDoneUni") : t("account.msRegisterDoneNonUni")
        );
      } else {
        await signInWithMicrosoft();
        notify(t("account.loginDone"), t("account.welcomeBack"));
      }
      goBack();
    } catch (e: any) {
      if (e.message === MICROSOFT_WEB_ONLY_ERROR) {
        notify(t("account.msPreparingTitle"), t("account.msWebOnly"));
      } else if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") {
        notify(t("account.errCannotRegister"), t("account.errMsInUse"));
      } else if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        // ユーザーが自分で閉じた場合は何も表示しない
      } else if (e.code === "auth/popup-blocked") {
        notify(t("account.errPopupBlocked"), t("account.errPopupBlockedMessage"));
      } else {
        notify(t("account.errFailed"), e.message ?? String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  // Google / X(Twitter) / LINE 連携 — Web専用（Microsoftと同じ）。
  // 各プロバイダの Firebase コンソール有効化 + 外部アプリ登録が前提（authService 参照）。
  async function handleSocial(id: SocialProviderId) {
    setBusy(true);
    try {
      if (mode === "register") {
        const u = await linkAnonymousWithSocial(id);
        const em = u.email ?? "";
        const isUni = isUniversityEmail(em);
        await updateMicrosoftAccountInfo(
          u.uid,
          em,
          u.displayName?.trim() || t("common.guest"),
          isUni ? em.split("@")[1] : null
        );
        notify(t("account.registerDone"), t("account.registerDoneMessage"));
      } else {
        await signInWithSocial(id);
        notify(t("account.loginDone"), t("account.welcomeBack"));
      }
      goBack();
    } catch (e: any) {
      if (e.message === SOCIAL_WEB_ONLY_ERROR) {
        notify(t("account.msPreparingTitle"), t("account.msWebOnly"));
      } else if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") {
        notify(t("account.errCannotRegister"), t("account.errMsInUse"));
      } else if (e.code === "auth/account-exists-with-different-credential") {
        notify(t("account.errCannotRegister"), t("account.errSocialDiffCred"));
      } else if (e.code === "auth/operation-not-allowed" || e.code === "auth/configuration-not-found") {
        notify(t("account.errFailed"), t("account.errProviderNotEnabled"));
      } else if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        // ユーザーが自分で閉じた場合は何も表示しない
      } else if (e.code === "auth/popup-blocked") {
        notify(t("account.errPopupBlocked"), t("account.errPopupBlockedMessage"));
      } else {
        notify(t("account.errFailed"), e.message ?? String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  // 登録/ログイン両モードで使う ソーシャルボタン群（Google / X / LINE）。
  function renderSocialButtons() {
    const suffix = mode === "register" ? "Register" : "Login";
    return (
      <>
        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton, busy && styles.buttonDisabled]}
          onPress={() => handleSocial("google.com")}
          disabled={busy}
        >
          <Text style={styles.socialButtonText}>{t(`account.google${suffix}` as any)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.socialButton, styles.xButton, busy && styles.buttonDisabled]}
          onPress={() => handleSocial("twitter.com")}
          disabled={busy}
        >
          <Text style={styles.xButtonText}>{t(`account.x${suffix}` as any)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.socialButton, styles.lineButton, busy && styles.buttonDisabled]}
          onPress={() => handleSocial("oidc.line")}
          disabled={busy}
        >
          <Text style={styles.lineButtonText}>{t(`account.line${suffix}` as any)}</Text>
        </TouchableOpacity>
      </>
    );
  }

  async function handleSendVerification() {
    setBusy(true);
    try {
      await sendSchoolVerificationEmail();
      notify(t("account.verificationSent"), t("account.verificationSentMessage"));
    } catch (e: any) {
      notify(t("account.sendFailed"), e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckVerification() {
    setBusy(true);
    try {
      await reloadAndCheckEmailVerified();
      const ok = isSchoolVerified(auth.currentUser);
      setVerified(ok);
      if (ok) notify(t("account.verifiedNow"));
      else notify(t("account.notVerifiedYet"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    confirmDialog(
      t("account.logout"),
      t("account.logoutConfirm"),
      async () => {
        await signOut(); // 直後にAuthContextが匿名で自動再ログインする
        goBack();
      },
      { cancel: t("common.cancel"), ok: t("common.ok") }
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isGuest ? (
          // ── 登録済みユーザー ──
          <>
            <Text style={styles.title}>{t("account.title")}</Text>
            <Text style={styles.label}>{t("account.email")}</Text>
            <Text style={styles.value}>{user?.email ?? "-"}</Text>

            {/* 学校メール認証 — 大学メール(.ac.jp等)のみ対象。M365連携済みなら認証済み扱い */}
            {isUniEmail && verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ {t("account.verifiedBadge")}</Text>
              </View>
            )}
            {isUniEmail && !verified && (
              <>
                <Text style={styles.label}>{t("account.verifySection")}</Text>
                <Text style={styles.description}>{t("account.verifyDescription")}</Text>
                <View style={styles.verifyButtonRow}>
                  <TouchableOpacity
                    style={[styles.verifyButton, busy && styles.buttonDisabled]}
                    onPress={handleSendVerification}
                    disabled={busy}
                  >
                    <Text style={styles.verifyButtonText}>{t("account.sendVerification")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.verifyButtonSecondary, busy && styles.buttonDisabled]}
                    onPress={handleCheckVerification}
                    disabled={busy}
                  >
                    <Text style={styles.verifyButtonSecondaryText}>
                      {t("account.checkVerification")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
              <Text style={styles.dangerButtonText}>{t("account.logout")}</Text>
            </TouchableOpacity>
          </>
        ) : mode === "register" ? (
          // ── ゲスト: 新規登録（アカウント連携） ──
          <>
            <Text style={styles.title}>{t("account.registerTitle")}</Text>
            <Text style={styles.description}>{t("account.registerDescription")}</Text>

            <Text style={styles.label}>{t("account.nickname")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("account.nicknamePlaceholder")}
              placeholderTextColor="#aaa"
              value={nickname}
              onChangeText={setNickname}
            />
            <Text style={styles.label}>{t("account.email")}</Text>
            <TextInput
              style={styles.input}
              placeholder="example@meiji.ac.jp"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>{t("account.password")}</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Text style={styles.label}>{t("account.passwordConfirm")}</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
            />

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? t("account.registering") : t("account.register")}
              </Text>
            </TouchableOpacity>

            <Text style={styles.dividerText}>{t("account.or")}</Text>
            <TouchableOpacity
              style={[styles.microsoftButton, busy && styles.buttonDisabled]}
              onPress={handleMicrosoft}
              disabled={busy}
            >
              <Text style={styles.microsoftButtonText}>{t("account.microsoftRegister")}</Text>
            </TouchableOpacity>
            {renderSocialButtons()}

            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.switchText}>{t("account.toLogin")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ── ゲスト: 既存アカウントへログイン ──
          <>
            <Text style={styles.title}>{t("account.login")}</Text>
            <Text style={styles.warningText}>{t("account.loginWarning")}</Text>

            <Text style={styles.label}>{t("account.email")}</Text>
            <TextInput
              style={styles.input}
              placeholder="example@meiji.ac.jp"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>{t("account.passwordLabel")}</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? t("account.loggingIn") : t("account.login")}
              </Text>
            </TouchableOpacity>

            <Text style={styles.dividerText}>{t("account.or")}</Text>
            <TouchableOpacity
              style={[styles.microsoftButton, busy && styles.buttonDisabled]}
              onPress={handleMicrosoft}
              disabled={busy}
            >
              <Text style={styles.microsoftButtonText}>{t("account.microsoftLogin")}</Text>
            </TouchableOpacity>
            {renderSocialButtons()}

            <TouchableOpacity onPress={() => setMode("register")}>
              <Text style={styles.switchText}>{t("account.toRegister")}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  backButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    zIndex: 1,
  },
  backIcon: { fontSize: 18, color: "#333" },
  content: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 40 },

  title: { fontSize: 20, fontWeight: "700", color: "#1A1A2E", marginBottom: 12 },
  description: { fontSize: 13, color: "#666", lineHeight: 19, marginBottom: 16 },
  warningText: { fontSize: 12, color: "#E2574C", lineHeight: 18, marginBottom: 16 },

  label: { fontSize: 12, color: "#888", marginTop: 12, marginBottom: 4 },
  value: { fontSize: 15, color: "#1A1A2E", fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D8E8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },

  primaryButton: {
    backgroundColor: "#2F6AD9",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: 0.5 },

  dangerButton: {
    backgroundColor: "#E2574C",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 32,
  },
  dangerButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  switchText: {
    color: "#2F6AD9",
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
    textDecorationLine: "underline",
  },

  dividerText: { textAlign: "center", color: "#999", fontSize: 12, marginVertical: 12 },

  verifiedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F5E9",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  verifiedBadgeText: { color: "#2E7D32", fontSize: 13, fontWeight: "700" },
  verifyButtonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  verifyButton: {
    flex: 1,
    backgroundColor: "#2F6AD9",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  verifyButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  verifyButtonSecondary: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2F6AD9",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  verifyButtonSecondaryText: { color: "#2F6AD9", fontSize: 13, fontWeight: "700" },
  microsoftButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2F2F2F",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  microsoftButtonText: { color: "#2F2F2F", fontSize: 14, fontWeight: "700" },

  socialButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  socialButtonText: { color: "#2F2F2F", fontSize: 14, fontWeight: "700" },
  googleButton: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DADCE0" },
  xButton: { backgroundColor: "#000" },
  xButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  lineButton: { backgroundColor: "#06C755" },
  lineButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
