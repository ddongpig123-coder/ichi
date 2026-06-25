import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { auth } from "../config/firebase";

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
