import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { AcademicInfo, UserProfile } from "../types/user";

function userDoc(uid: string) {
  return doc(db, "users", uid);
}

// ── 公開プロフィール（usersPublic）とメール索引（emailIndex） ──────
// users/{uid} 本体は本人のみ読めるため、友達検索・友達リスト表示に必要な
// 最小情報だけを usersPublic に複製する。学業情報(GPA等)は絶対に含めない。
export interface PublicProfile {
  uid: string;
  nickname: string;
  photoURL: string | null;
  schoolDomain: string | null;
  department: string | null;
  admissionYear?: number | null; // 学年フィルタ用（先輩時間割）
}

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
    nickname,
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
    await writePublicMirror(uid, {
      nickname: "ゲスト", photoURL: null, schoolDomain: null, department: null,
    });
  } else {
    const data = snap.data() as UserProfile;
    const pub = await getDoc(publicDoc(uid));
    if (!pub.exists()) {
      await writePublicMirror(uid, {
        nickname: data.nickname || "ゲスト",
        photoURL: data.photoURL ?? null,
        schoolDomain: data.schoolDomain ?? null,
        department: data.department ?? null,
      });
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
  await setDoc(userDoc(uid), { uid, email, nickname }, { merge: true });
  await writePublicMirror(uid, { nickname });
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
  await setDoc(userDoc(uid), { uid, email, nickname, schoolDomain }, { merge: true });
  await writePublicMirror(uid, { nickname, schoolDomain });
  try {
    await auth.currentUser?.getIdToken(true);
    await writeEmailIndex(uid, email);
  } catch (e) {
    console.warn("emailIndex write failed:", e);
  }
}

// 익명 사용자는 users/{uid} 문서가 없을 수 있으므로 setDoc(merge)로 자동 생성
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, nickname }, { merge: true });
  await writePublicMirror(uid, { nickname });
}

export async function updatePhotoURL(uid: string, photoURL: string): Promise<void> {
  await setDoc(userDoc(uid), { uid, photoURL }, { merge: true });
  await writePublicMirror(uid, { photoURL });
}

export async function updateAcademicInfo(uid: string, academic: AcademicInfo): Promise<void> {
  await setDoc(userDoc(uid), { uid, academic }, { merge: true });
  // 学業情報は非公開のため usersPublic には反映しない。
  // ただし学部(department)は先輩時間割の学部公開判定に使うため正規値のみミラーする。
  if (academic.department) {
    await setDoc(userDoc(uid), { department: academic.department }, { merge: true });
    await writePublicMirror(uid, { department: academic.department });
  }
}

// 入学年度の保存。学年フィルタ(先輩時間割)・学点管理(Phase 3)が使う単一ソース。
// 他ユーザーに公開してよい値なので usersPublic にもミラーする（GPA等とは別扱い）。
export async function updateAdmissionYear(uid: string, admissionYear: number | null): Promise<void> {
  await setDoc(userDoc(uid), { uid, admissionYear }, { merge: true });
  await writePublicMirror(uid, { admissionYear });
}

// オンボーディング完了時の一括保存（規約同意日時・言語・学校）。
// 学校は公開情報（先輩時間割の学部公開判定等に使用）なので usersPublic にもミラーする。
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
  await writePublicMirror(uid, { schoolDomain });
}

// 学校選択のみ更新（規約同意済みユーザーの後からの学校選択）。
// agreedTermsAt は最初の同意日時を保持するため触らない。
export async function updateSchoolSelection(
  uid: string,
  schoolDomain: string | null
): Promise<void> {
  await setDoc(userDoc(uid), { uid, schoolDomain }, { merge: true });
  await writePublicMirror(uid, { schoolDomain });
}

// 自分の友達リスト表示順（よく会う友達など）の保存。users本体のみでよい。
export async function saveFriendOrders(
  uid: string,
  frequentFriendIds: string[],
  friendListOrder: string[]
): Promise<void> {
  await setDoc(userDoc(uid), { uid, frequentFriendIds, friendListOrder }, { merge: true });
}
