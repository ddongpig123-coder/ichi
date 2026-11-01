import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useI18n } from "../../src/contexts/I18nContext";
import {
  isOperator,
  getQueueItem,
  createManualItem,
  updateQueueItem,
  type QueueDraftInput,
} from "../../src/services/contentQueueService";
import {
  CONTENT_TITLE_MAX,
  CONTENT_BODY_MAX,
  type ContentQueueItem,
  type ContentQueueStatus,
  type ContentScope,
} from "../../src/types/contentQueue";
import { OFFICIAL_BOARDS, boardLabel } from "../../src/types/board";
import { LOUNGES, loungeLabel } from "../../src/types/lounge";
import { findBannedWords } from "../../src/utils/contentFilter";
import type { Theme } from "../../src/theme/themes";
import ScreenHeader from "../../src/components/common/ScreenHeader";

// 投稿キューの確認・修正・承認（運営アカウント専用・docs/CONTENT-OPS.md §9）。
// id なし = 手書きの新規作成。posted は読み取り専用。
export default function ContentEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { user, schoolDomain: mySchool } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [item, setItem] = useState<ContentQueueItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scope, setScope] = useState<ContentScope>("school");
  const [schoolDomain, setSchoolDomain] = useState<string | null>(null);
  const [boardId, setBoardId] = useState<string>("free");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const ok = await isOperator(user.uid);
      if (!alive) return;
      setAllowed(ok);
      if (!ok) return;
      if (!id) {
        // 新規: 自分の学校があれば学校掲示板、なければラウンジを初期値に
        setSchoolDomain(mySchool);
        if (!mySchool) {
          setScope("lounge");
          setBoardId(LOUNGES[0].id);
        }
        return;
      }
      const it = await getQueueItem(id);
      if (!alive) return;
      if (!it) {
        setNotFound(true);
        return;
      }
      setItem(it);
      setScope(it.scope);
      setSchoolDomain(it.schoolDomain ?? mySchool);
      setBoardId(it.boardId);
      setTitle(it.title);
      setBody(it.body);
      setSourceUrl(it.sourceUrl ?? "");
    })();
    return () => {
      alive = false;
    };
  }, [user, id, mySchool]);

  function notify(msg: string) {
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert(msg);
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/admin");
  }

  async function save(nextStatus: Exclude<ContentQueueStatus, "posted">) {
    if (!user) return;
    // 却下・下書き戻しは中身が空でも保存できるようにはしない（ルールが空文字を拒否するため）
    if (!title.trim() || !body.trim()) {
      notify(t("admin.required"));
      return;
    }
    const input: QueueDraftInput = {
      scope,
      schoolDomain: scope === "school" ? schoolDomain : null,
      boardId,
      title,
      body,
      sourceUrl,
    };
    setBusy(true);
    try {
      if (item) await updateQueueItem(item.id, input, nextStatus);
      else await createManualItem(user.uid, input, nextStatus === "approved" ? "approved" : "draft");
      goBack();
    } catch (e: any) {
      notify(`${t("common.saveFailed")}${e?.message ? `\n${e.message}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  const header = <ScreenHeader title={t(id ? "admin.editTitle" : "admin.new")} onBack={goBack} />;

  if (allowed === null || (id && !item && !notFound && allowed)) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      </View>
    );
  }
  if (!allowed || notFound) {
    return (
      <View style={styles.container}>
        {header}
        <Text style={styles.empty}>{t(!allowed ? "admin.noPermission" : "admin.notFound")}</Text>
      </View>
    );
  }

  const status = item?.status ?? null; // null = 新規
  const readOnly = status === "posted";
  const banned = findBannedWords(title, body);
  const validUrl = /^https?:\/\//.test(sourceUrl.trim());

  function chip(key: string, label: string, selected: boolean, onPress: () => void) {
    return (
      <TouchableOpacity
        key={key}
        style={[styles.chip, selected && styles.chipActive]}
        onPress={onPress}
        disabled={readOnly}
      >
        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {item?.topic ? (
          <Text style={styles.meta}>
            {t("admin.topic")}: {item.topic} · {t(item.source === "ai" ? "admin.sourceAi" : "admin.sourceManual")}
          </Text>
        ) : null}
        {readOnly ? (
          <Text style={styles.readOnly}>
            {t("admin.postedReadonly")}
            {item?.postedAt ? `\n${t("admin.postedAt")}: ${new Date(item.postedAt).toLocaleString()}` : ""}
          </Text>
        ) : null}

        {/* 投稿先 */}
        <Text style={styles.label}>{t("admin.target")}</Text>
        {schoolDomain ? (
          <>
            <Text style={styles.subLabel}>{t("admin.targetSchool")}（{schoolDomain}）</Text>
            <View style={styles.chipRow}>
              {OFFICIAL_BOARDS.map((b) =>
                chip(`s-${b.id}`, boardLabel(b, language), scope === "school" && boardId === b.id, () => {
                  setScope("school");
                  setBoardId(b.id);
                })
              )}
            </View>
          </>
        ) : null}
        <Text style={styles.subLabel}>{t("admin.targetLounge")}</Text>
        <View style={styles.chipRow}>
          {LOUNGES.map((l) =>
            chip(`l-${l.id}`, loungeLabel(l, language), scope === "lounge" && boardId === l.id, () => {
              setScope("lounge");
              setBoardId(l.id);
            })
          )}
        </View>

        {/* タイトル・本文 */}
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t("admin.titleLabel")}</Text>
          <Text style={styles.count}>{title.length}/{CONTENT_TITLE_MAX}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          maxLength={CONTENT_TITLE_MAX}
          editable={!readOnly}
          placeholderTextColor={theme.textSecondary}
        />
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t("admin.bodyLabel")}</Text>
          <Text style={styles.count}>{body.length}/{CONTENT_BODY_MAX}</Text>
        </View>
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          maxLength={CONTENT_BODY_MAX}
          multiline
          textAlignVertical="top"
          editable={!readOnly}
        />
        {banned.length > 0 ? (
          <Text style={styles.warning}>{t("admin.bannedWarning")}{banned.join("、")}</Text>
        ) : null}

        {/* 出典（お知らせ・日程の事実確認用） */}
        <Text style={styles.label}>{t("admin.sourceUrlLabel")}</Text>
        <TextInput
          style={styles.input}
          value={sourceUrl}
          onChangeText={setSourceUrl}
          autoCapitalize="none"
          keyboardType="url"
          editable={!readOnly}
          placeholder="https://"
          placeholderTextColor={theme.textSecondary}
        />
        {validUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(sourceUrl.trim())}>
            <Text style={styles.link}>{t("admin.sourceUrlOpen")}</Text>
          </TouchableOpacity>
        ) : null}

        {/* 操作ボタン（状態ごと） */}
        {!readOnly ? (
          <View style={styles.actions}>
            {status === null || status === "draft" ? (
              <>
                <ActionButton label={t("admin.saveDraft")} kind="secondary" busy={busy} onPress={() => save("draft")} styles={styles} />
                <ActionButton label={t(status === null ? "admin.saveAndApprove" : "admin.approve")} kind="primary" busy={busy} onPress={() => save("approved")} styles={styles} />
              </>
            ) : null}
            {status === "approved" ? (
              <>
                <ActionButton label={t("admin.backToDraft")} kind="secondary" busy={busy} onPress={() => save("draft")} styles={styles} />
                <ActionButton label={t("admin.approve")} kind="primary" busy={busy} onPress={() => save("approved")} styles={styles} />
              </>
            ) : null}
            {status === "rejected" ? (
              <ActionButton label={t("admin.backToDraft")} kind="secondary" busy={busy} onPress={() => save("draft")} styles={styles} />
            ) : null}
            {status === "draft" || status === "approved" ? (
              <ActionButton label={t("admin.reject")} kind="danger" busy={busy} onPress={() => save("rejected")} styles={styles} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActionButton({
  label,
  kind,
  busy,
  onPress,
  styles,
}: {
  label: string;
  kind: "primary" | "secondary" | "danger";
  busy: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const btnStyle = kind === "primary" ? styles.btnPrimary : kind === "danger" ? styles.btnDanger : styles.btnSecondary;
  const textStyle = kind === "secondary" ? styles.btnTextSecondary : styles.btnText;
  return (
    <TouchableOpacity style={[styles.btn, btnStyle, busy && styles.disabled]} onPress={onPress} disabled={busy}>
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, gap: 6 },
    empty: { textAlign: "center", color: theme.textSecondary, marginTop: 40, fontSize: 14 },
    meta: { fontSize: 12, color: theme.textSecondary },
    readOnly: {
      fontSize: 13,
      color: theme.textSecondary,
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 10,
      lineHeight: 19,
    },
    label: { fontSize: 12, color: theme.textSecondary, marginTop: 10 },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    count: { fontSize: 11, color: theme.textSecondary },
    subLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: theme.card,
    },
    chipActive: { borderColor: theme.primary, backgroundColor: theme.primary },
    chipText: { fontSize: 12, color: theme.textPrimary },
    chipTextActive: { color: "#fff", fontWeight: "700" },
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
    bodyInput: { minHeight: 180 },
    warning: { fontSize: 12, color: "#E2574C", marginTop: 2 },
    link: { fontSize: 13, color: theme.primary, fontWeight: "600", marginTop: 2 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
    btn: { flexGrow: 1, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center" },
    btnPrimary: { backgroundColor: theme.primary },
    btnSecondary: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
    btnDanger: { backgroundColor: "#E2574C" },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    btnTextSecondary: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.4 },
  });
}
