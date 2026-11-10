import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc, deleteField, query, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { UserProfile } from "../types/user";
import { NICKNAME_MAX } from "../data/limits";

// ニックネームは usersPublic のルールで 20 文字（NICKNAME_MAX）までに制限されている。
// 画面の入力欄は maxLength で止めているが、ソーシャル連携はプロバイダの表示名を
// そのまま渡してくるので、ここで必ず詰める。詰めないと usersPublic への書き込みが
// ルールに弾かれ、連携そのものが失敗する。
// 🔑 コードポイント単位で切る（絵文字のサロゲートペアを半分で切らないため）。
function clampNickname(nickname: string): string {
  return Array.from(nickname).slice(0, NICKNAME_MAX).join("");
}

function userDoc(uid: string) {
  return doc(db, "users", uid);
}

// ── 公開プロフィール（usersPublic）とメール索引（emailIndex） ──────
// users/{uid} 本体は本人のみ読めるため、友達検索・友達リスト表示に必要な
// 最小情報だけを usersPublic に複製する。学業情報(GPA等)は絶対に含めない。
// 🔑 学校・学部・入学年度は **載せない**（2026-11-10）。どの画面も他人のこれらを使っておらず、
//    プライバシーポリシー「所属等が他の利用者に公開されることはありません」とも合わない。
//    本人の値は users/{uid}（本人だけが読める）にある。昔の版が書いた値は
//    LEGACY_PUBLIC_KEYS として起動時に消す（ensureUserProfile）。
export interface PublicProfile {
  uid: string;
  nickname: string;
  photoURL: string | null;
}

// 以前 usersPublic にミラーしていた所属情報。もう書かない。残っていれば消す
const LEGACY_PUBLIC_KEYS = ["schoolDomain", "department", "admissionYear"] as const;

function publicDoc(uid: string) {
  return doc(db, "usersPublic", uid);
}

async function writePublicMirror(uid: string, fields: Partial<PublicProfile>): Promise<void> {
  await setDoc(publicDoc(uid), { uid, ...fields }, { merge: true });
}

export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(publicDoc(uid));
  return snap.exists() ? (snap.data() as PublicProfile) : null;
}

// メール→uid 索引。ルール側で「Authトークンのemailと一致する場合のみ書き込み可」を
// 強制しているため、書き込み前にIDトークンへemailが反映されている必要がある
// （アカウント連携直後は getIdToken(true) で強制リフレッシュしてから呼ぶこと）。
async function writeEmailIndex(uid: string, email: string): Promise<void> {
  const key = email.trim().toLowerCase();
  if (!key) return;
  await setDoc(doc(db, "emailIndex", key), { uid });
}

export async function lookupUidByEmail(email: string): Promise<string | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const snap = await getDoc(doc(db, "emailIndex", key));
  return snap.exists() ? (snap.data().uid as string) : null;
}

// ── users 本体 ────────────────────────────────────────────────
// Firebase Auth がアカウント作成済みであることが前提。パスワードはここでは一切扱わない。
export async function createUserProfile(
  uid: string,
  email: string,
  nickname: string
): Promise<void> {
  await setDoc(userDoc(uid), {
    uid,
    email,
    nickname: clampNickname(nickname),
    photoURL: null,
    friendIds: [],
    createdAt: Date.now(),
    // 認証レベルは必ず0で作成（昇格はCloud Functionsのみ。firestore.rulesで強制）
    verificationLevel: 0,
    language: "ja",
    schoolDomain: null,
    department: null,
    admissionYear: null,
  });
}

// 初回進入時にusersドキュメントを保証する（匿名ユーザー含む）。
// 存在しない場合のみ作成 — 時間割・友達など全データの土台になるため、
// 認証方式に関係なく必ずドキュメントが存在する状態を作る。
// あわせて usersPublic / emailIndex の自己修復も行う
// （この機能追加以前に登録したユーザーへの後方互換）。
export async function ensureUserProfile(uid: string, email: string | null): Promise<void> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) {
    await createUserProfile(uid, email ?? "", "ゲスト");
    await writePublicMirror(uid, { nickname: "ゲスト", photoURL: null });
  } else {
    const data = snap.data() as UserProfile;
    const pub = await getDoc(publicDoc(uid));
    if (!pub.exists()) {
      await writePublicMirror(uid, {
        nickname: data.nickname || "ゲスト",
        photoURL: data.photoURL ?? null,
      });
    } else {
      // 昔の版（ストア版に内蔵の初回起動コードを含む）が書いた所属情報を消す。
      // 既に消えていれば何もしない（読み取りは上の1回だけ、書き込みは残っているときだけ）
      const pubData = pub.data();
      const legacy = LEGACY_PUBLIC_KEYS.filter((k) => k in pubData);
      if (legacy.length > 0) {
        try {
          const patch: Record<string, unknown> = { uid };
          legacy.forEach((k) => { patch[k] = deleteField(); });
          await updateDoc(publicDoc(uid), patch);
        } catch (e) {
          console.warn("usersPublic legacy cleanup failed:", e);
        }
      }
    }
  }
  // メール索引の自己修復（登録済みユーザーのみ。失敗しても致命的ではない）
  if (email) {
    try {
      const existing = await lookupUidByEmail(email);
      if (existing !== uid) await writeEmailIndex(uid, email);
    } catch (e) {
      console.warn("emailIndex self-heal failed:", e);
    }
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// アカウント連携(匿名→メール)完了時にemail/nicknameを反映する。
// emailIndex はルール上、IDトークンにemailが載っている必要があるため強制リフレッシュ。
export async function updateAccountInfo(
  uid: string,
  email: string,
  nickname: string
): Promise<void> {
  const nick = clampNickname(nickname);
  await setDoc(userDoc(uid), { uid, email, nickname: nick }, { merge: true });
  await writePublicMirror(uid, { nickname: nick });
  try {
    await auth.currentUser?.getIdToken(true);
    await writeEmailIndex(uid, email);
  } catch (e) {
    console.warn("emailIndex write failed:", e);
  }
}

// Microsoft(大学アカウント)連携完了時に学校ドメインまで反映する。
// verificationLevel の昇格はここでは行わない（クライアント変更は規則で禁止。
// TODO(server): Cloud Functions でメールドメイン検証後に昇格させる）。
export async function updateMicrosoftAccountInfo(
  uid: string,
  email: string,
  nickname: string,
  schoolDomain: string | null
): Promise<void> {
  const nick = clampNickname(nickname);
  await setDoc(userDoc(uid), { uid, email, nickname: nick, schoolDomain }, { merge: true });
  await writePublicMirror(uid, { nickname: nick });
  try {
    await auth.currentUser?.getIdToken(true);
    await writeEmailIndex(uid, email);
  } catch (e) {
    console.warn("emailIndex write failed:", e);
  }
}

// 익명 사용자는 users/{uid} 문서가 없을 수 있으므로 setDoc(merge)로 자동 생성
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  const nick = clampNickname(nickname);
  await setDoc(userDoc(uid), { uid, nickname: nick }, { merge: true });
  await writePublicMirror(uid, { nickname: nick });
}

export async function updatePhotoURL(uid: string, photoURL: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, photoURL }, { merge: true });
  await writePublicMirror(uid, { photoURL });
}

// 学部の保存（プロフィール）。users 本体のみ（usersPublic には載せない — 上の PublicProfile 参照）。
// ※ GPA・単位などの成績はここに書かない — 端末保存（gradRecordService の PrivateAcademic）。
//    以前の updateAcademicInfo は academic ごとサーバーに平文で書いていた（CREDIT-TRACKING §6-2 違反）。
export async function updateDepartment(uid: string, department: string): Promise<void> {
  const value = department.trim();
  await setDoc(userDoc(uid), { uid, academic: { department: value }, department: value || null }, { merge: true });
}

// 旧版がサーバーに平文で置いた成績（GPA・単位・履修数・学年）を消す。
// 端末へ移し終えてから呼ぶこと（先に消すと値が失われる）。
// 学年は入学年度から計算する値なので保存しない（§6-3: 可変の「学年」フィールドは作らない）。
export async function clearServerPrivateAcademic(uid: string): Promise<void> {
  await updateDoc(userDoc(uid), {
    "academic.gpa": deleteField(),
    "academic.earnedCredits": deleteField(),
    "academic.requiredCredits": deleteField(),
    "academic.courseCount": deleteField(),
    "academic.grade": deleteField(),
  });
}

// 入学年度の保存。学点管理(Phase 3)が使う単一ソース。users 本体のみ（usersPublic には載せない）。
export async function updateAdmissionYear(uid: string, admissionYear: number | null): Promise<void> {
  await setDoc(userDoc(uid), { uid, admissionYear }, { merge: true });
}

// 卒業要件で選んだ学部の保存（I-9 / 1.1 S2）。
// 端末保存（loadGradState/saveGradState）とは別に、サーバにも持たせておく。
// 機種変更・再インストールのあとも学部を選び直さずに済ませるため。
// 公開情報ではないので usersPublic にはミラーしない。
// 単位の記録そのものは端末ローカル専用のまま（CREDIT-TRACKING §6-2、平文保存禁止）。
// ここで保存するのは「どの学部の要件表を見るか」だけで、成績ではない。
export async function updateGradFaculty(
  uid: string,
  gradFacultyId: string | null
): Promise<void> {
  await setDoc(userDoc(uid), { uid, gradFacultyId }, { merge: true });
}

// オンボーディング完了時の一括保存（規約同意日時・言語・学校）。users 本体のみ。
// 学校の所属判定（掲示板の書き込み権限）はルールが users/{uid}.schoolDomain を見る。
export async function completeOnboarding(
  uid: string,
  language: UserProfile["language"],
  schoolDomain: string | null
): Promise<void> {
  await setDoc(
    userDoc(uid),
    { uid, language, schoolDomain, agreedTermsAt: Date.now() },
    { merge: true }
  );
}

// 学校選択のみ更新（規約同意済みユーザーの後からの学校選択）。
// agreedTermsAt は最初の同意日時を保持するため触らない。
export async function updateSchoolSelection(
  uid: string,
  schoolDomain: string | null
): Promise<void> {
  await setDoc(userDoc(uid), { uid, schoolDomain }, { merge: true });
}

// 自分の友達リスト表示順（よく会う友達など）の保存。users本体のみでよい。
export async function saveFriendOrders(
  uid: string,
  frequentFriendIds: string[],
  friendListOrder: string[]
): Promise<void> {
  await setDoc(userDoc(uid), { uid, frequentFriendIds, friendListOrder }, { merge: true });
}

// ── アカウント削除: 本人を特定できるデータの削除 ───────────────────
// Apple/Google のアカウント削除要件に対応。本人識別データ(プロフィール・公開ミラー・
// メール索引・時間割)を物理削除する。firestore.rules は本人の delete を許可済み(ルール変更不要)。
// ⚠️ 投稿・コメント・쪽지は authorUid を法的対応のため保存する方針(MODERATION.md)なので
//    ここでは削除しない。表示は既に匿名(@匿名N)で、アカウント削除により本人との紐付けは切れる。
// ⚠️ 講義レビュー（courses/…/reviews/{uid}）といいねはまだ消していない。講義・投稿をまたいで
//    自分の分を探すには collectionGroup 照会とルール追加が要る（Admin スクリプトで扱う想定）。
// ⚠️ 直列 await だと、1件目の書き込みが（ネイティブで ack が返らず）止まった時点で
//    残り全部が実行されない。並列(allSettled)にして、機微な本人識別データから先に投げる。
//    どのルールも isOwner(uid) ベースで他の文書を参照しないため、順序に依存しない
//    （emailIndex の delete だけは自身の resource.data.uid を見るが、他文書とは独立）。
//    この関数は reject しない。呼び出し側(deleteAccount)は制限時間付きで await し、
//    未完了でも Auth アカウント削除へ進む。
export async function deleteSelfData(uid: string, email: string | null): Promise<void> {
  const tasks: { step: string; task: Promise<unknown> }[] = [];

  // メール索引（メール→uid。最も機微なのでいちばん先に投げる）
  if (email) {
    const key = email.trim().toLowerCase();
    if (key) tasks.push({ step: "emailIndex", task: deleteDoc(doc(db, "emailIndex", key)) });
  }
  // 本体プロフィール（メール・ニックネーム）
  tasks.push({ step: "users", task: deleteDoc(userDoc(uid)) });
  // 公開ミラー
  tasks.push({ step: "usersPublic", task: deleteDoc(publicDoc(uid)) });
  // 時間割(サブコレクション)を全学期分削除
  tasks.push({ step: "timetables", task: deleteTimetables(uid) });
  // スクラップ・ブロックリスト（本人だけのサブコレクション）も消す
  tasks.push({ step: "scraps", task: deleteSubcollection(uid, "scraps") });
  tasks.push({ step: "blocks", task: deleteSubcollection(uid, "blocks") });
  // 友達関係と友達申請（送った分・届いた分）。残すと相手の一覧に「消えた人」との関係が残り、
  // 申請にも uid の組が残る。ルールはどれも当事者の delete を許可済み（2026-11-10 追加）
  tasks.push({ step: "friendships", task: deleteWhere("friendships", "participants", "array-contains", uid) });
  tasks.push({ step: "friendRequests(from)", task: deleteWhere("friendRequests", "fromUid", "==", uid) });
  tasks.push({ step: "friendRequests(to)", task: deleteWhere("friendRequests", "toUid", "==", uid) });

  const results = await Promise.allSettled(tasks.map((t) => t.task));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      // 握って続行（Auth 削除を止めないため）。どれが落ちたかはログに残す。
      console.warn(`[deleteSelfData] ${tasks[i].step} の削除に失敗:`, r.reason?.message ?? r.reason);
    }
  });
}

async function deleteTimetables(uid: string): Promise<void> {
  return deleteSubcollection(uid, "timetables");
}

async function deleteSubcollection(uid: string, name: string): Promise<void> {
  const snap = await getDocs(collection(db, "users", uid, name));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
}

// 本人が当事者の文書を条件で集めて消す（友達関係・友達申請）。1件の失敗で残りを止めない
async function deleteWhere(
  col: string,
  field: string,
  op: "==" | "array-contains",
  uid: string
): Promise<void> {
  const snap = await getDocs(query(collection(db, col), where(field, op, uid)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
}
