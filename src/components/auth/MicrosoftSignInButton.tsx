import React, { useEffect, useState } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useMicrosoftAuth, signInWithMicrosoftToken, isUniversityEmail } from "../../services/authService";

export default function MicrosoftSignInButton() {
  const router = useRouter();
  const { request, response, promptAsync } = useMicrosoftAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (response?.type === "success") {
      handleSuccess(response.params.code);
    } else if (response?.type === "error") {
      Alert.alert("認証エラー", response.error?.message ?? "不明なエラーが発生しました");
    }
  }, [response]);

  async function handleSuccess(code: string) {
    setLoading(true);
    try {
      // NOTE: For production, exchange `code` for tokens on your backend to
      // keep the client secret safe. Here we use the implicit id_token flow
      // configured via Firebase / Azure AD for simplicity in development.
      const idToken = code; // replace with real token exchange result
      const user = await signInWithMicrosoftToken(idToken);

      if (!user.email || !isUniversityEmail(user.email)) {
        Alert.alert(
          "学校メールが必要です",
          "大学のMicrosoftアカウント（.ac.jpなど）でサインインしてください。"
        );
        return;
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("ログイン失敗", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.button, (!request || loading) && styles.disabled]}
      onPress={() => promptAsync()}
      disabled={!request || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.inner}>
          <Text style={styles.label}>Microsoftでサインイン</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#2F6AD9",
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  disabled: { opacity: 0.6 },
  inner: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
