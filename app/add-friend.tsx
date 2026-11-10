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
import {
  addFriendByInvite, checkInviteStatus, type InviteAddResult,
} from "../src/services/friendRequestService";
import {
  APP_STORE_URL, PLAY_STORE_PUBLIC, PLAY_STORE_URL, buildAppOpenUrl, detectMobileOS,
} from "../src/services/friendInvite";
import ScreenHeader from "../src/components/common/ScreenHeader";

// 招待リンク（/add-friend?u=<uid>&k=<token>）の受け口。docs/INVITE-LINK.md
// - ネイティブ: 招待者を見せて「友達になりますか？」→ [友達になる] で friendships を作る。
//   招待した側の承認は取らない（準熙決定 2026-11-05）が、開いた側には一度だけ確認する
//   （2026-11-10。開いただけで友達になると、知らない人のリンクで時間割が見えてしまう）。
//   自分のリンク・既に友達のときは確認なしで結果を出す。
//   友達一覧への反映は FriendsContext の friendships 購読（#89）が拾う。念のため refresh も呼ぶ
// - Web（Safari/Chrome）: 友達は作らない。Web のゲスト口座はアプリと別人なので、
//   「アプリで開く」とストアのボタンだけを出す
function param(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

// checking = 招待者の確認中 / confirm = 「友達になりますか？」 / working = 追加中 / done = 結果
type Phase = "checking" | "confirm" | "working" | "done";
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
  const [phase, setPhase] = useState<Phase>("checking");
  const [result, setResult] = useState<Result | null>(null);
  const refreshRef = useRef(refreshFriends);
  refreshRef.current = refreshFriends;
  // 画面を離れたあとに state を触らないための印（追加ボタンの非同期処理用）
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  // 招待者の公開プロフィール（表示用）。usersPublic はサインイン後しか読めないので user を待つ
  useEffect(() => {
    let alive = true;
    if (!inviterUid || !user) return;
    getPublicProfile(inviterUid)
      .then((p) => { if (alive) setInviter(p); })
      .catch(() => { if (alive) setInviter(null); });
    return () => { alive = false; };
  }, [inviterUid, user]);

  // ネイティブ: 確認画面を出すかどうかの判定（ここでは友達を作らない）
  const uid = user?.uid;
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!valid) { setResult("invalid"); setPhase("done"); return; }
    if (!uid) return; // 匿名サインイン待ち
    let alive = true;
    setPhase("checking");
    (async () => {
      const p = await getPublicProfile(inviterUid!).catch(() => null);
      if (!alive) return;
      if (!p) { setResult("invalid"); setPhase("done"); return; }
      const status = await checkInviteStatus(uid, inviterUid!).catch(() => "ready" as const);
      if (!alive) return;
      if (status === "ready") {
        setPhase("confirm");
      } else {
        setResult(status);
        setPhase("done");
      }
    })();
    return () => { alive = false; };
  }, [uid, inviterUid, token, valid]);

  // [友達になる]（失敗時の「もう一度試す」もここ）
  const busyRef = useRef(false); // 連打で2回書かないように（state の反映を待たずに止める）
  async function confirmAdd() {
    if (!uid || !inviterUid || busyRef.current) return;
    busyRef.current = true;
    setPhase("working");
    let r: Result;
    try {
      r = await addFriendByInvite(uid, inviterUid, token);
    } catch (e) {
      console.warn("invite add failed:", e);
      r = "failed";
    }
    // 友達一覧に即反映（購読でも反映されるが、画面を離れていても確実に読み直す）
    if (r === "added") refreshRef.current().catch(() => {});
    busyRef.current = false;
    if (!aliveRef.current) return;
    setResult(r);
    setPhase("done");
  }

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

  // ── ネイティブ: 確認してから友達に追加 ──────────────────────
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("friends.addTitle")} onBack={goFriends} />

      <View style={styles.content}>
        {phase === "checking" || phase === "working" ? (
          <>
            <ActivityIndicator color={theme.primary} />
            {phase === "working" && <Text style={styles.desc}>{t("addFriend.adding")}</Text>}
          </>
        ) : phase === "confirm" ? (
          <>
            {avatar}
            <Text style={styles.title}>{`${name}${t("addFriend.confirmSuffix")}`}</Text>
            <Text style={styles.desc}>{t("addFriend.confirmDesc")}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={confirmAdd}>
              <Text style={styles.primaryText}>{t("addFriend.confirmButton")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={goFriends}>
              <Text style={styles.secondaryText}>{t("addFriend.declineButton")}</Text>
            </TouchableOpacity>
          </>
        ) : result === "invalid" ? (
          invalidBlock
        ) : result === "failed" ? (
          <>
            <Text style={styles.title}>{t("addFriend.failedTitle")}</Text>
            <Text style={styles.desc}>{t("addFriend.failedDesc")}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={confirmAdd}>
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
