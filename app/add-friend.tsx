import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useFriends } from "../src/contexts/FriendsContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useI18n } from "../src/contexts/I18nContext";
import type { Theme } from "../src/theme/themes";
import { getPublicProfile, type PublicProfile } from "../src/services/userService";
import { addFriendByInvite, type InviteAddResult } from "../src/services/friendRequestService";
import {
  APP_STORE_URL, PLAY_STORE_PUBLIC, PLAY_STORE_URL, buildAppOpenUrl, detectMobileOS,
} from "../src/services/friendInvite";
import ScreenHeader from "../src/components/common/ScreenHeader";

// 招待リンク（/add-friend?u=<uid>&k=<token>）の受け口。docs/INVITE-LINK.md
// - ネイティブ: 開いた時点で承認なしに友達を作り、結果を見せる（準熙決定 2026-11-05）
// - Web（Safari/Chrome）: 友達は作らない。Web のゲスト口座はアプリと別人なので、
//   「アプリで開く」とストアのボタンだけを出す
function param(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

type Phase = "waiting" | "working" | "done";
type Result = InviteAddResult | "failed";

export default function AddFriendScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh: refreshFriends } = useFriends();
  const { theme } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ u?: string; k?: string }>();
  const inviterUid = param(params.u);
  const token = param(params.k) ?? "";
  const valid = !!inviterUid && !!token;

  const [inviter, setInviter] = useState<PublicProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refreshRef = useRef(refreshFriends);
  refreshRef.current = refreshFriends;

  // 招待者の公開プロフィール（表示用）。usersPublic はサインイン後しか読めないので user を待つ
  useEffect(() => {
    let alive = true;
    if (!inviterUid || !user) return;
    getPublicProfile(inviterUid)
      .then((p) => { if (alive) setInviter(p); })
      .catch(() => { if (alive) setInviter(null); });
    return () => { alive = false; };
  }, [inviterUid, user]);

  // ネイティブ: 友達を作る
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!valid) { setResult("invalid"); setPhase("done"); return; }
    if (!user) return; // 匿名サインイン待ち
    let alive = true;
    setPhase("working");
    (async () => {
      const p = await getPublicProfile(inviterUid!).catch(() => null);
      if (!alive) return;
      if (!p) { setResult("invalid"); setPhase("done"); return; }
      let r: Result;
      try {
        r = await addFriendByInvite(user.uid, inviterUid!, token);
      } catch (e) {
        console.warn("invite add failed:", e);
        r = "failed";
      }
      if (!alive) return;
      if (r === "added") refreshRef.current().catch(() => {}); // 友達一覧に即反映
      setResult(r);
      setPhase("done");
    })();
    return () => { alive = false; };
  }, [user, inviterUid, token, valid, attempt]);

  function goFriends() {
    router.replace("/(tabs)/friends");
  }

  function openWebUrl(url: string) {
    if (typeof window !== "undefined") window.location.assign(url);
  }

  const name = inviter?.nickname || t("friends.unknownUser");

  const avatar = inviter ? (
    inviter.photoURL ? (
      <Image source={{ uri: inviter.photoURL }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Text style={styles.avatarInitial}>{(inviter.nickname || "?").slice(0, 1)}</Text>
      </View>
    )
  ) : null;

  const invalidBlock = (
    <>
      <Text style={styles.title}>{t("addFriend.invalidTitle")}</Text>
      <Text style={styles.desc}>{t("addFriend.invalidDesc")}</Text>
      {Platform.OS !== "web" && (
        <TouchableOpacity style={styles.primaryButton} onPress={goFriends}>
          <Text style={styles.primaryText}>{t("addFriend.toFriends")}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // ── Web: アプリで開く / ストアへ ──────────────────────────
  if (Platform.OS === "web") {
    const os = detectMobileOS();
    return (
      <View style={styles.container}>
        <View style={styles.webBrand}>
          <Text style={styles.webBrandText}>大学の森</Text>
        </View>
        <View style={styles.content}>
          {!valid ? invalidBlock : (
            <>
              {avatar}
              <Text style={styles.title}>{t("addFriend.webTitle")}</Text>
              <Text style={styles.desc}>
                {inviter ? `${name}${t("addFriend.webInvitedSuffix")}` : ""}
                {t("addFriend.webDesc")}
              </Text>
              {os !== "other" && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => openWebUrl(buildAppOpenUrl(inviterUid!, token, os))}
                >
                  <Text style={styles.primaryText}>{t("addFriend.openApp")}</Text>
                </TouchableOpacity>
              )}
              {os !== "android" && (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openWebUrl(APP_STORE_URL)}>
                  <Text style={styles.secondaryText}>{t("addFriend.appStore")}</Text>
                </TouchableOpacity>
              )}
              {os === "android" && (PLAY_STORE_PUBLIC ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openWebUrl(PLAY_STORE_URL)}>
                  <Text style={styles.secondaryText}>{t("addFriend.playStore")}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.desc}>{t("addFriend.androidSoon")}</Text>
              ))}
              <Text style={styles.hint}>{os === "other" ? t("addFriend.pcHint") : t("addFriend.webHint")}</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── ネイティブ: 自動で友達に追加 ──────────────────────────
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("friends.addTitle")} onBack={goFriends} />

      <View style={styles.content}>
        {phase !== "done" ? (
          <>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.desc}>{t("addFriend.adding")}</Text>
          </>
        ) : result === "invalid" ? (
          invalidBlock
        ) : result === "failed" ? (
          <>
            <Text style={styles.title}>{t("addFriend.failedTitle")}</Text>
            <Text style={styles.desc}>{t("addFriend.failedDesc")}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setAttempt((n) => n + 1)}>
              <Text style={styles.primaryText}>{t("addFriend.retry")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={goFriends}>
              <Text style={styles.secondaryText}>{t("addFriend.toFriends")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {avatar}
            <Text style={styles.title}>
              {result === "self"
                ? t("addFriend.selfLink")
                : result === "already-friends"
                  ? `${name}${t("addFriend.alreadyFriends")}`
                  : `${name}${t("addFriend.addedSuffix")}`}
            </Text>
            {result === "added" && user?.isAnonymous && (
              <>
                <Text style={styles.hint}>{t("addFriend.guestHint")}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/account")}>
                  <Text style={styles.secondaryText}>{t("addFriend.registerAccount")}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={goFriends}>
              <Text style={styles.primaryText}>{t("addFriend.toFriends")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 14 },
    webBrand: { paddingTop: 28, alignItems: "center" },
    webBrandText: { fontSize: 18, fontWeight: "700", color: theme.primary },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: { backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
    avatarInitial: { color: "#fff", fontSize: 34, fontWeight: "700" },
    title: { fontSize: 18, fontWeight: "700", color: theme.textPrimary, textAlign: "center" },
    desc: { fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: "center", lineHeight: 18, marginTop: 4 },
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
  });
}
