import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// はじめの設定（ポップアップ）と使い方ツアーの進み具合（2026-11-14 準熙）。
// 流れ: オンボーディング（言語 → 規約 → ① 学校）→ ホームの上にポップアップ
//   ② 時間割を登録（timetable）→ ③ 友達を追加（friends）→ 使い方ツアー（tour）→ done
// どのステップも「あとで」「スキップ」で飛ばせる。
// 端末ローカル（AsyncStorage）に保存する。アプリを途中で閉じても、次に開いたとき続きから出る。
// プロフィール →「アプリの使い方」で tour だけをもう一度見られる。
// 既存ユーザー（この機能より前にオンボーディングを終えた人）には出さない（キーが無い = done 扱い）。

// push = はじめの設定 ④ 通知（新規ユーザー。次は tour）/ pushOnly = 既存ユーザーにアップデート後 1 回だけ（次は done）。
// どちらも通知の部品があるアプリで、OS の許可がまだ決まっていないときだけ（docs/PUSH-NOTIFICATIONS.md §2）
export type TutorialStage = "timetable" | "friends" | "push" | "pushOnly" | "tour" | "done";

const KEY = "ichi:tutorialStage";

let current: TutorialStage | null = null; // null = まだ読み込んでいない
const listeners = new Set<(s: TutorialStage) => void>();

function emit(s: TutorialStage) {
  current = s;
  listeners.forEach((l) => l(s));
}

export async function loadTutorialStage(): Promise<TutorialStage> {
  if (current) return current;
  try {
    const v = await AsyncStorage.getItem(KEY);
    current = v === "timetable" || v === "friends" || v === "push" || v === "pushOnly" || v === "tour" ? v : "done";
  } catch {
    current = "done"; // 読めないときは出さない（毎回出て邪魔になるよりまし）
  }
  return current;
}

export function setTutorialStage(s: TutorialStage): void {
  emit(s);
  AsyncStorage.setItem(KEY, s).catch(() => {});
}

// 画面から購読する。読み込み前は null
export function useTutorialStage(): TutorialStage | null {
  const [stage, setStage] = useState<TutorialStage | null>(current);
  useEffect(() => {
    let alive = true;
    loadTutorialStage().then((s) => { if (alive) setStage(s); });
    listeners.add(setStage);
    return () => { alive = false; listeners.delete(setStage); };
  }, []);
  return stage;
}
