import { useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";
import { getPublicProfile, type PublicProfile } from "../src/services/userService";
import { sendFriendRequest } from "../src/services/friendRequestService";

function notify(title: string, message?: string) {
  if (Platform.OS === "web") window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

// 招待リンク（/add-friend?u=<uid>）の受け口。相手のプロフィールを表示し、友達申請を送る。
export default function AddFriendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ u?: string }>();
  const inviterUid = typeof params.u === "string" ? params.u : Array.isArray(params.u) ? params.u[0] : undefined;

  const [loading, setLoading] = useState(true);
  const [inviter, setInviter] = useState<PublicProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const isSelf = !!user && !!inviterUid && user.uid === inviterUid;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!inviterUid) { setLoading(false); return; }
      const p = await getPublicProfile(inviterUid).catch(() => null);
      if (alive) { setInviter(p); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [inviterUid]);

  function goFriends() {
    router.replace("/(tabs)/friends");
  }

  async function handleSend() {
    if (!user || !inviterUid) return;
    setBusy(true);
    try {
      const result = await sendFriendRequest(user.uid, inviterUid);
      const name = inviter?.nickname || t("friends.defaultPartner");
      switch (result) {
        case "sent":
          setDone(true);
          notify(t("friends.requestSentTitle"), `${name}${t("friends.requestSentSuffix")}`);
          break;
        case "self":
          notify(t("friends.cannotSendTitle"), t("friends.cannotSendSelf"));
          break;
        case "already-friends":
          setDone(true);
          notify(t("friends.alreadyFriendsTitle"), `${name}${t("friends.alreadyFriendsSuffix")}`);
          break;
        case "already-sent":
          setDone(true);
          notify(t("friends.alreadySentTitle"), t("friends.alreadySentMessage"));
          break;
        case "incoming-exists":
          notify(t("friends.incomingExistsTitle"), `${name}${t("friends.incomingExistsSuffix")}`);
          break;
      }
    } catch (e: any) {
      notify(t("friends.sendFailed"), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backButton} onPress={goFriends}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : !inviterUid || !inviter ? (
          <>
            <Text style={styles.title}>{t("addFriend.invalidTitle")}</Text>
            <Text style={styles.desc}>{t("addFriend.invalidDesc")}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={goFriends}>
              <Text style={styles.primaryText}>{t("addFriend.toFriends")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {inviter.photoURL ? (
              <Image source={{ uri: inviter.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{(inviter.nickname || "?").slice(0, 1)}</Text>
              </View>
            )}
            <Text style={styles.nickname}>{inviter.nickname || t("friends.unknownUser")}</Text>
            <Text style={styles.desc}>
              {isSelf ? t("addFriend.selfLink") : t("addFriend.invitedBy")}
            </Text>

            {isSelf ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={goFriends}>
                <Text style={styles.secondaryText}>{t("addFriend.toFriends")}</Text>
              </TouchableOpacity>
            ) : done ? (
              <TouchableOpacity style={styles.primaryButton} onPress={goFriends}>
                <Text style={styles.primaryText}>{t("addFriend.toFriends")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={handleSend}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryText}>{t("addFriend.sendRequest")}</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    backButton: {
      position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 18,
      justifyContent: "center", alignItems: "center", backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border, zIndex: 1,
    },
    backIcon: { fontSize: 18, color: theme.textPrimary },
    content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 14 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: { backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
    avatarInitial: { color: "#fff", fontSize: 34, fontWeight: "700" },
    nickname: { fontSize: 20, fontWeight: "700", color: theme.textPrimary },
    title: { fontSize: 18, fontWeight: "700", color: theme.textPrimary, textAlign: "center" },
    desc: { fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
    primaryButton: {
      backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 28,
      alignItems: "center", marginTop: 8, minWidth: 200,
    },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    secondaryButton: {
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
      paddingVertical: 13, paddingHorizontal: 28, alignItems: "center", marginTop: 8, minWidth: 200,
    },
    secondaryText: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
    buttonDisabled: { opacity: 0.5 },
  });
}
