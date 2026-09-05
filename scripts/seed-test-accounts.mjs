// テストアカウント作成 + 時間割シード（開発用）
// アプリと同じクライアント経路（Firebase JS SDK + セキュリティルール）で作成するため、
// サービスアカウント鍵は不要。ルールを回避しない＝実際のユーザーと同じ権限で書き込む。
//
// 実行: node scripts/seed-test-accounts.mjs
// ※ 本番データではない。作成後は Firebase Console から削除可能。

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// .env（EXPO_PUBLIC_* はクライアント公開値）を読む
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

const PASSWORD = "ichitest1234";           // テスト専用の共通パスワード
const SCHOOL = "meiji.ac.jp";
const C = ["#2F6AD9", "#E2574C", "#2FA84F", "#F0A93B", "#8E5CD9"];
const s = (day, period, name, teacher, room, ci) => ({ day, period, name, teacher, room, color: C[ci % C.length] });

// 友達の「重なり」テスト用に、わざと同じコマを共有させている
const ACCOUNTS = [
  {
    email: "ichitest1@example.com", nickname: "テスト太郎", department: "商学部", admissionYear: 2024,
    fall: [s("月",1,"経営学A","佐藤 教授","1101",0), s("火",2,"会計学B","田中 教授","2203",1),
           s("水",3,"マーケティング論","鈴木 教授","3305",2), s("木",2,"統計学入門","高橋 教授","1204",3)],
    spring: [s("月",2,"簿記原理","伊藤 教授","1102",1), s("水",1,"日本語表現法","渡辺 教授","2101",4)],
  },
  {
    email: "ichitest2@example.com", nickname: "テスト花子", department: "商学部", admissionYear: 2024,
    fall: [s("月",1,"経営学A","佐藤 教授","1101",0), s("火",2,"会計学B","田中 教授","2203",1),
           s("水",1,"簿記原理","伊藤 教授","1102",2), s("金",3,"国際経済学","中村 教授","4402",3)],
    spring: [s("火",1,"ミクロ経済学","小林 教授","3201",0), s("木",3,"英語コミュニケーション","Smith","2302",2)],
  },
  {
    email: "ichitest3@example.com", nickname: "テスト先輩", department: "商学部", admissionYear: 2023,
    fall: [s("月",1,"経営学A","佐藤 教授","1101",4), s("木",2,"統計学入門","高橋 教授","1204",0),
           s("火",4,"経営組織論","山本 教授","3103",1), s("金",2,"データサイエンス入門","加藤 教授","5501",2)],
    spring: [s("水",2,"民法総則","吉田 教授","1303",3), s("金",1,"経済史","松本 教授","2204",0)],
  },
  {
    email: "ichitest4@example.com", nickname: "テスト後輩", department: "経営学部", admissionYear: 2025,
    fall: [s("火",2,"会計学B","田中 教授","2203",2), s("水",3,"マーケティング論","鈴木 教授","3305",3),
           s("月",3,"ミクロ経済学","小林 教授","3201",4), s("木",1,"英語コミュニケーション","Smith","2302",0)],
    spring: [s("月",4,"情報リテラシー","清水 教授","5102",1), s("火",3,"心理学概論","森 教授","1401",2)],
  },
];

const YEAR = new Date().getFullYear();

async function seedOne(a, idx) {
  let uid, created = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, a.email, PASSWORD);
    uid = cred.user.uid;
  } catch (e) {
    if (e.code !== "auth/email-already-in-use") throw e;
    const cred = await signInWithEmailAndPassword(auth, a.email, PASSWORD);
    uid = cred.user.uid; created = false;
  }
  // emailIndex のルールは ID トークンの email クレームと一致を要求するため更新しておく
  await auth.currentUser.getIdToken(true);

  // users/{uid}（createUserProfile + completeOnboarding 相当）
  await setDoc(doc(db, "users", uid), {
    uid, email: a.email, nickname: a.nickname, photoURL: null, friendIds: [],
    createdAt: Date.now(), verificationLevel: 0, language: "ja",
    schoolDomain: SCHOOL, department: a.department, admissionYear: a.admissionYear,
    agreedTermsAt: Date.now(),
    academic: { department: a.department, grade: String(YEAR - a.admissionYear + 1), gpa: "", earnedCredits: "", requiredCredits: "", courseCount: String(a.fall.length) },
  }, { merge: true });

  // usersPublic ミラー（他ユーザーに見せてよい情報のみ）
  await setDoc(doc(db, "usersPublic", uid), {
    uid, nickname: a.nickname, photoURL: null,
    schoolDomain: SCHOOL, department: a.department, admissionYear: a.admissionYear,
  }, { merge: true });

  // emailIndex（メールで友達検索できるように）
  await setDoc(doc(db, "emailIndex", a.email.toLowerCase()), { uid });

  // 時間割（春・秋）。visibility は friends（友達に公開＝重なり表示テスト用）
  const withIds = (arr, sem) => arr.map((x, i) => ({ ...x, id: `seed-${idx}-${sem}-${i}` }));
  await setDoc(doc(db, "users", uid, "timetables", `${YEAR}-秋`),
    { sessions: withIds(a.fall, "f"), visibility: "friends", updatedAt: Date.now() }, { merge: true });
  await setDoc(doc(db, "users", uid, "timetables", `${YEAR}-春`),
    { sessions: withIds(a.spring, "s"), visibility: "friends", updatedAt: Date.now() }, { merge: true });

  await signOut(auth);
  return { uid, created };
}

const results = [];
for (let i = 0; i < ACCOUNTS.length; i++) {
  const a = ACCOUNTS[i];
  try {
    const r = await seedOne(a, i);
    results.push({ ...a, ...r });
    console.log(`${r.created ? "作成" : "既存"}  ${a.email}  ${a.nickname}  ${a.department}  uid=${r.uid}`);
  } catch (e) {
    console.error(`失敗  ${a.email}: ${e.code ?? ""} ${e.message}`);
  }
}
console.log(`\n完了: ${results.length}/${ACCOUNTS.length}  パスワード（全員共通）: ${PASSWORD}`);
process.exit(0);
