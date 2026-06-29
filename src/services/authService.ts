import {
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  OAuthProvider,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import {
  makeRedirectUri,
  useAuthRequest,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { auth } from "../config/firebase";
import { createUserProfile } from "./userService";

WebBrowser.maybeCompleteAuthSession();

// Microsoft Azure AD endpoints — tenant "common" allows any org account
const MICROSOFT_DISCOVERY = {
  authorizationEndpoint:
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint:
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

export const MICROSOFT_CLIENT_ID =
  process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "";

export function useMicrosoftAuth() {
  const redirectUri = makeRedirectUri({ scheme: "uni-community" });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ["openid", "profile", "email", "User.Read"],
      responseType: ResponseType.Code,
      redirectUri,
      extraParams: { prompt: "select_account" },
    },
    MICROSOFT_DISCOVERY
  );

  return { request, response, promptAsync, redirectUri };
}

// Exchange Microsoft ID token for Firebase credential
export async function signInWithMicrosoftToken(idToken: string): Promise<User> {
  const provider = new OAuthProvider("microsoft.com");
  const credential = provider.credential({ idToken });
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// パスワードは Firebase Auth に直接渡すだけで、こちら側では一切保持・保存しない。
// ハッシュ化・暗号化・検証はすべて Firebase のサーバー側で行われる。
export async function signUpWithEmail(
  email: string,
  password: string,
  nickname: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await createUserProfile(result.user.uid, email, nickname);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

// Returns true only if the email domain is a known university domain.
// Extend this list or replace with a Firestore allowlist.
export function isUniversityEmail(email: string): boolean {
  const allowed = [
    ".ac.jp",
    ".edu",
    ".university",
  ];
  return allowed.some((suffix) => email.endsWith(suffix));
}
