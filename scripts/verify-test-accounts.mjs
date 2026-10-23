// シードしたテストアカウントの検証（読み戻し）
import { loadEnv } from "./load-env.mjs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const env = loadEnv(import.meta.url);
const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY, authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app), db = getFirestore(app);
const YEAR = new Date().getFullYear();

// 公開リポジトリなのでパスワードはコードに書かない（seed 側と同じキー）。
const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD || env.TEST_ACCOUNT_PASSWORD;
if (!PASSWORD) {
  console.error("TEST_ACCOUNT_PASSWORD が未設定。.env に1行足してから実行してください。");
  process.exit(1);
}

for (const email of ["ichidemo1@example.com","ichidemo2@example.com","ichidemo3@example.com","ichidemo4@example.com"]) {
  const { user } = await signInWithEmailAndPassword(auth, email, PASSWORD);
  const u = (await getDoc(doc(db, "users", user.uid))).data();
  const pub = (await getDoc(doc(db, "usersPublic", user.uid))).data();
  const fall = (await getDoc(doc(db, "users", user.uid, "timetables", `${YEAR}-秋`))).data();
  const spring = (await getDoc(doc(db, "users", user.uid, "timetables", `${YEAR}-春`))).data();
  const idx = (await getDoc(doc(db, "emailIndex", email))).data();
  console.log(`${email}
  users: ${u?.nickname} / ${u?.department} / ${u?.admissionYear}년입학 / school=${u?.schoolDomain}
  usersPublic: ${pub ? "OK" : "없음"}  emailIndex: ${idx?.uid === user.uid ? "OK" : "불일치"}
  ${YEAR}秋: ${fall?.sessions?.length ?? 0}과목 (${fall?.sessions?.map(s=>s.day+s.period).join(",")}) visibility=${fall?.visibility}
  ${YEAR}春: ${spring?.sessions?.length ?? 0}과목 (${spring?.sessions?.map(s=>s.day+s.period).join(",")})`);
  await signOut(auth);
}
process.exit(0);
