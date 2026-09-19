import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { auth } from "../config/firebase";
import { ensureUserProfile, getUserProfile } from "../services/userService";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  // 実際の学校ドメイン（users.schoolDomain = オンボーディングで保存）。
  // null = 学校未選択(「その他」) または まだ未ロード。
  // 「未ロード」と「学校なし」は schoolReady で区別する（schoolReady=true かつ null なら学校なし）。
  // ※ 学校未選択のユーザーには学校掲示板を出さず、全国の留学生ラウンジに誘導する方針（§5）。
  schoolDomain: string | null;
  // users プロフィール読み込み完了フラグ。false の間は schoolDomain の判断を保留すること
  // （例: 掲示板は schoolReady まで待ってから、null なら「学校を選択」導線を出す）。
  schoolReady: boolean;
  // オンボーディング等で学校を保存した後に呼ぶ（reload せずに schoolDomain を反映するため）。
  refreshSchoolDomain: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  schoolDomain: null,
  schoolReady: false,
  refreshSchoolDomain: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [schoolDomain, setSchoolDomain] = useState<string | null>(null);
  const [schoolReady, setSchoolReady] = useState(false);

  const loadSchoolDomain = useCallback(async (uid: string) => {
    try {
      const p = await getUserProfile(uid);
      setSchoolDomain(p?.schoolDomain ?? null);
    } catch (e) {
      console.warn("load schoolDomain failed:", e);
      setSchoolDomain(null);
    } finally {
      setSchoolReady(true);
    }
  }, []);

  // オンボーディング完了直後などに呼び出して schoolDomain を最新化する。
  const refreshSchoolDomain = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await loadSchoolDomain(uid);
  }, [loadSchoolDomain]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // 先に user を差し替える。ensureUserProfile(通信)を待つ間に古い uid のまま
        // 画面が Firestore を読むと、トークンは新 uid なので permission-denied になるため。
        setUser(u);
        setLoading(false);
        // 匿名ユーザー含め、初回進入時にusersドキュメントを保証する
        try {
          await ensureUserProfile(u.uid, u.email);
        } catch (e) {
          console.warn("ensureUserProfile failed:", e);
        }
        // 実校スコープ判定のため users.schoolDomain をロードする
        setSchoolReady(false);
        await loadSchoolDomain(u.uid);
      } else {
        // ログインなしで匿名自動ログイン
        await signInAnonymously(auth);
      }
    });
    return unsubscribe;
  }, [loadSchoolDomain]);

  return (
    <AuthContext.Provider value={{ user, loading, schoolDomain, schoolReady, refreshSchoolDomain }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
