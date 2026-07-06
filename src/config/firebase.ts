import { initializeApp, getApps } from "firebase/app";
import { Platform } from "react-native";
import { initializeAuth, browserLocalPersistence, type Auth, type Persistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 세션(익명 포함)이 앱 재시작 후에도 유지되도록 플랫폼별 영속화를 설정한다.
// firebase v12의 메타 패키지("firebase/auth")는 RN 빌드를 노출하지 않지만,
// 내부 패키지 @firebase/auth 에는 getReactNativePersistence 가 그대로 있다.
let persistence: Persistence;
if (Platform.OS === "web") {
  persistence = browserLocalPersistence;
} else {
  const { getReactNativePersistence } = require("@firebase/auth");
  persistence = getReactNativePersistence(AsyncStorage);
}

export const auth: Auth = initializeAuth(app, { persistence });

export const db = getFirestore(app);
