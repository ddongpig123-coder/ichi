import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { Theme } from "../../theme/themes";
import { getUserProfile } from "../../services/userService";
import DefaultAvatar from "../common/DefaultAvatar";

export default function ProfileCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [nickname, setNickname] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setNickname(null);
      setPhotoURL(null);
      return;
    }
    getUserProfile(user.uid).then((p) => {
      setNickname(p?.nickname ?? null);
      setPhotoURL(p?.photoURL ?? null);
    });
  }, [user]);

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push("/profile-settings")}>
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={styles.avatar} />
      ) : (
        <DefaultAvatar size={26} />
      )}
      <Text style={styles.nickname} numberOfLines={1}>{nickname ?? "ゲスト"}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginRight: 4,
    },
    avatar: { width: 26, height: 26, borderRadius: 13 },
    nickname: { fontSize: 13, color: theme.textSecondary, fontWeight: "600", maxWidth: 80 },
  });
}
