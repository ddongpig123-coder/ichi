import { useEffect, useState } from "react";
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
import { signUpWithEmail, signInWithEmail, signOut } from "../../src/services/authService";
import { getUserProfile, updateNickname, updatePhotoURL, addFriend, removeFriend } from "../../src/services/userService";
import type { UserProfile } from "../../src/types/user";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoURLInput, setPhotoURLInput] = useState("");
  const [friendUidInput, setFriendUidInput] = useState("");

  const isAnonymous = !user || user.isAnonymous;

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProfile(null);
      return;
    }
    getUserProfile(user.uid).then((p) => {
      setProfile(p);
      setPhotoURLInput(p?.photoURL ?? "");
    });
  }, [user]);

  async function handleAuthSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("メールとパスワードを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!nickname.trim()) {
          Alert.alert("ニックネームを入力してください");
          return;
        }
        await signUpWithEmail(email.trim(), password, nickname.trim());
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (e: any) {
      console.error("auth submit failed", e);
      Alert.alert("失敗しました", e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePhoto() {
    if (!user) return;
    try {
      await updatePhotoURL(user.uid, photoURLInput.trim());
      setProfile((p) => (p ? { ...p, photoURL: photoURLInput.trim() } : p));
    } catch (e: any) {
      Alert.alert("保存に失敗しました", e.message);
    }
  }

  async function handleAddFriend() {
    if (!user || !friendUidInput.trim()) return;
    try {
      await addFriend(user.uid, friendUidInput.trim());
      setProfile((p) => (p ? { ...p, friendIds: [...p.friendIds, friendUidInput.trim()] } : p));
      setFriendUidInput("");
    } catch (e: any) {
      Alert.alert("追加に失敗しました", e.message);
    }
  }

  async function handleRemoveFriend(friendUid: string) {
    if (!user) return;
    await removeFriend(user.uid, friendUid);
    setProfile((p) => (p ? { ...p, friendIds: p.friendIds.filter((id) => id !== friendUid) } : p));
  }

  if (isAnonymous) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContainer}>
        <Text style={styles.title}>{mode === "signup" ? "新規登録" : "ログイン"}</Text>

        {mode === "signup" && (
          <TextInput
            style={styles.input}
            placeholder="ニックネーム"
            placeholderTextColor="#aaa"
            value={nickname}
            onChangeText={setNickname}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleAuthSubmit} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? "処理中..." : mode === "signup" ? "登録する" : "ログイン"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === "signup" ? "login" : "signup")}>
          <Text style={styles.switchText}>
            {mode === "signup" ? "すでにアカウントをお持ちの方はログイン" : "新規登録はこちら"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContainer}>
      {profile?.photoURL && <Image source={{ uri: profile.photoURL }} style={styles.avatar} />}

      <Text style={styles.label}>ニックネーム</Text>
      <Text style={styles.value}>{profile?.nickname}</Text>

      <Text style={styles.label}>メールアドレス</Text>
      <Text style={styles.value}>{profile?.email}</Text>

      <Text style={styles.label}>プロフィール写真URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        placeholderTextColor="#aaa"
        value={photoURLInput}
        onChangeText={setPhotoURLInput}
      />
      <TouchableOpacity style={styles.smallBtn} onPress={handleSavePhoto}>
        <Text style={styles.smallBtnText}>保存</Text>
      </TouchableOpacity>

      <Text style={styles.label}>友達リスト（UID追加）</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="友達のUID"
          placeholderTextColor="#aaa"
          value={friendUidInput}
          onChangeText={setFriendUidInput}
        />
        <TouchableOpacity style={styles.smallBtn} onPress={handleAddFriend}>
          <Text style={styles.smallBtnText}>追加</Text>
        </TouchableOpacity>
      </View>

      {profile?.friendIds.map((fid) => (
        <View key={fid} style={styles.friendRow}>
          <Text style={styles.friendUid} numberOfLines={1}>{fid}</Text>
          <TouchableOpacity onPress={() => handleRemoveFriend(fid)}>
            <Text style={styles.removeText}>削除</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
        <Text style={styles.signOutText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  formContainer: { padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: "700", color: "#1A1A2E", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
  },
  submitBtn: { backgroundColor: "#2F6AD9", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchText: { color: "#2F6AD9", fontSize: 13, textAlign: "center", marginTop: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignSelf: "center", marginBottom: 8 },
  label: { fontSize: 12, color: "#888", marginTop: 8 },
  value: { fontSize: 15, fontWeight: "600", color: "#1A1A2E" },
  row: { flexDirection: "row", gap: 8 },
  smallBtn: { backgroundColor: "#2F6AD9", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  friendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  friendUid: { fontSize: 13, color: "#333", flex: 1 },
  removeText: { color: "#E2574C", fontSize: 12, fontWeight: "700" },
  signOutBtn: { marginTop: 20, alignItems: "center", paddingVertical: 10 },
  signOutText: { color: "#E2574C", fontWeight: "600" },
});
