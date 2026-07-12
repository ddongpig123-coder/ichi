import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { auth } from "../config/firebase";
import { ensureUserProfile } from "../services/userService";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  schoolDomain: string;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  schoolDomain: "global",
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // 匿名ユーザー含め、初回進入時にusersドキュメントを保証する
        // （時間割・友達データの土台。失敗してもアプリ利用自体は継続）
        try {
          await ensureUserProfile(u.uid, u.email);
        } catch (e) {
          console.warn("ensureUserProfile failed:", e);
        }
        setUser(u);
        setLoading(false);
      } else {
        // 로그인 없이 익명으로 자동 로그인
        await signInAnonymously(auth);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, schoolDomain: "global" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
