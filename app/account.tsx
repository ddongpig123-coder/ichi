import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { linkAnonymousWithEmail, signInWithEmail, signOut } from "../src/services/authService";

// アカウント登録・ログイン画面
// ゲスト(匿名)ユーザー: メール登録(=アカウント連携。uidを維持しデータが残る) or 既存アカウントへログイン
// 登録済みユーザー: アカウント情報表示 + ログアウト
export default function AccountScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const isGuest = user?.isAnonymous ?? true;

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)");
  }

  async function handleRegister() {
    if (!nickname.trim()) return Alert.alert("入力エラー", "ニックネームを入力してください");
    if (!email.trim()) return Alert.alert("入力エラー", "メールアドレスを入力してください");
    if (password.length < 6) return Alert.alert("入力エラー", "パスワードは6文字以上で入力してください");
    if (password !== passwordConfirm) return Alert.alert("入力エラー", "パスワードが一致しません");

    setBusy(true);
    try {
      await linkAnonymousWithEmail(email.trim(), password, nickname.trim());
      Alert.alert("登録完了", "アカウントを登録しました。時間割や友達のデータはそのまま引き継がれます。");
      goBack();
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use" || e.code === "auth/credential-already-in-use") {
        Alert.alert("登録できません", "このメールアドレスは既に登録されています。ログインをお試しください。");
      } else if (e.code === "auth/invalid-email") {
        Alert.alert("登録できません", "メールアドレスの形式が正しくありません。");
      } else {
        Alert.alert("登録に失敗しました", e.message ?? String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) return Alert.alert("入力エラー", "メールアドレスとパスワードを入力してください");
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      Alert.alert("ログイン完了", "おかえりなさい。");
      goBack();
    } catch (e: any) {
      Alert.alert("ログインに失敗しました", "メールアドレスまたはパスワードをご確認ください。");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          await signOut(); // 直後にAuthContextが匿名で自動再ログインする
          goBack();
        },
      },
    ]);
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
            <Text style={styles.title}>アカウント</Text>
            <Text style={styles.label}>メールアドレス</Text>
            <Text style={styles.value}>{user?.email ?? "-"}</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
              <Text style={styles.dangerButtonText}>ログアウト</Text>
            </TouchableOpacity>
          </>
        ) : mode === "register" ? (
          // ── ゲスト: 新規登録（アカウント連携） ──
          <>
            <Text style={styles.title}>アカウント登録</Text>
            <Text style={styles.description}>
              登録すると、機種変更やアプリ再インストール後もデータを引き継げます。
              いま使っている時間割・友達はそのまま残ります。
            </Text>

            <Text style={styles.label}>ニックネーム</Text>
            <TextInput
              style={styles.input}
              placeholder="例: たろう"
              placeholderTextColor="#aaa"
              value={nickname}
              onChangeText={setNickname}
            />
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              style={styles.input}
              placeholder="example@meiji.ac.jp"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>パスワード（6文字以上）</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Text style={styles.label}>パスワード（確認）</Text>
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
              <Text style={styles.primaryButtonText}>{busy ? "登録中…" : "登録する"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.switchText}>既にアカウントをお持ちの方はこちら（ログイン）</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ── ゲスト: 既存アカウントへログイン ──
          <>
            <Text style={styles.title}>ログイン</Text>
            <Text style={styles.warningText}>
              ※ ログインすると、ゲストとして作成した現在のデータ（時間割など）には
              アクセスできなくなります。
            </Text>

            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              style={styles.input}
              placeholder="example@meiji.ac.jp"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>パスワード</Text>
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
              <Text style={styles.primaryButtonText}>{busy ? "ログイン中…" : "ログイン"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode("register")}>
              <Text style={styles.switchText}>新規登録はこちら</Text>
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
});
