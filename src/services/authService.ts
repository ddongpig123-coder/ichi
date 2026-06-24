import {
  signInWithCredential,
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
