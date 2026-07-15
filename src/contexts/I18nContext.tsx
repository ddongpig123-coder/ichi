import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TRANSLATIONS, type TranslationKey } from "../i18n/translations";
import type { UserLanguage } from "../types/user";

// ============================================================
// 表示言語コンテキスト
// - 言語はAsyncStorageに保存（未ログイン/オンボーディング前でも機能するため）。
//   users.language への同期は呼び出し側（オンボーディング/設定画面）が行う。
// - t(key) は型付きキーのみ受け付ける（存在しないキーはコンパイルエラー）。
// ============================================================

const STORAGE_KEY = "ichi:language";
const DEFAULT_LANGUAGE: UserLanguage = "ja";

interface I18nContextValue {
  language: UserLanguage;
  setLanguage: (lang: UserLanguage) => void;
  t: (key: TranslationKey) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UserLanguage>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "ja" || saved === "ko") setLanguageState(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLanguage = useCallback((lang: UserLanguage) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey) => TRANSLATIONS[language][key] ?? TRANSLATIONS.ja[key] ?? key,
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
