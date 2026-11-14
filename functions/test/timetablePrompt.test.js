// npm test（functions/ で）— 出力検証が「信用できない値」を捨てるか
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PERIODS, buildPrompt, extractJson, sanitizePeriods, sanitizeResult } from "../timetablePrompt.js";

test("時限表: 正しい形は通し、おかしい形は null", () => {
  assert.deepEqual(sanitizePeriods([{ period: 1, start: "08:50", end: "10:30" }]), [{ period: 1, start: "08:50", end: "10:30" }]);
  assert.equal(sanitizePeriods([]), null);
  assert.equal(sanitizePeriods([{ period: 0, start: "08:50", end: "10:30" }]), null);
  assert.equal(sanitizePeriods([{ period: 1, start: "8:50", end: "10:30" }]), null);
  assert.equal(sanitizePeriods("x"), null);
  assert.equal(sanitizePeriods(Array.from({ length: 11 }, (_, i) => ({ period: i + 1, start: "09:00", end: "10:00" }))), null);
});

test("プロンプトに学校の時限表が入る", () => {
  const p = buildPrompt([{ period: 1, start: "08:50", end: "10:30" }]);
  assert.match(p, /1限 08:50-10:30/);
  assert.doesNotMatch(buildPrompt(DEFAULT_PERIODS), /08:50/);
});

test("JSON を前後の文から取り出す", () => {
  assert.deepEqual(extractJson('はい\n{"sessions":[]}\n以上'), { sessions: [] });
  assert.throws(() => extractJson("JSON なし"));
});

test("出力検証: 範囲外・不正は捨て、長すぎる文字は切る", () => {
  const r = sanitizeResult({
    sessions: [
      { day: "月", period: 1, name: " 国際金融論A ", teacher: null, room: "1123教室", confidence: "high" },
      { day: "月", period: 9, name: "存在しない時限" },
      { day: "Mon", period: 1, name: "英語の曜日" },
      { day: "火", period: 2, name: "" },
      { day: "水", period: "3", name: "x".repeat(300), confidence: "low", extra: "捨てる" },
    ],
    unplaced: [{ name: "知的財産法B（M）", reason: "その他欄" }, { name: "" }],
    secret: "未知のキー",
  }, DEFAULT_PERIODS);
  assert.equal(r.sessions.length, 2);
  assert.deepEqual(r.sessions[0], { day: "月", period: 1, name: "国際金融論A", teacher: null, room: "1123教室", confidence: "high" });
  assert.equal(r.sessions[1].name.length, 100);
  assert.equal(r.sessions[1].confidence, "low");
  assert.equal("extra" in r.sessions[1], false);
  assert.deepEqual(r.unplaced, [{ name: "知的財産法B（M）", reason: "その他欄" }]);
  assert.equal(r.notTimetable, false);
  assert.equal("secret" in r, false);
});

test("時間割でない画像", () => {
  assert.equal(sanitizeResult({ sessions: [], unplaced: [], notTimetable: true }, DEFAULT_PERIODS).notTimetable, true);
  assert.equal(sanitizeResult(null, DEFAULT_PERIODS).sessions.length, 0);
});
