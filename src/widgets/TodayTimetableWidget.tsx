import {
  HStack,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

// ============================================================
// iPhone ホーム画面ウィジェット「今日の時間割」（RELEASE-PLAN N4 / docs/WIDGET.md）
//
// 🔴 このファイルは「直接 import しない」。必ず src/services/widgetService.ts 経由
//   （部品のある新しいアプリでだけ、関数の中で require する）。
//   expo-widgets は読み込んだ瞬間にネイティブ部品を探すので、部品の無い
//   ストア版 1.0.0（OTA で同じ JS が届く）や Android・Web で読むと落ちる（AGENTS.md）。
//
// 🔴 'widget' と書いた関数は、アプリとは別の小さな JS 実行環境（ウィジェット拡張の中）で動く。
//   - 使えるのは @expo/ui/swift-ui の部品と修飾子だけ。フック・import・非同期は使えない
//   - 関数の外の定数・関数は見えない → 必要な値は全部 props で渡し、補助はこの関数の中に書く
//   - Babel の補助関数が入る書き方（オブジェクトの ...展開・分割代入・for-of・class）は避ける
//     （補助関数はアプリ側のモジュールにしか無く、ウィジェット側で「見つからない」になる）
//   - import した名前は変えない（Text as T などにしない）。ウィジェット側では同じ名前の
//     グローバルとして見つけるため
//
// 表示内容（時刻ごとの「授業中・次の授業」など）はアプリ側で計算して、時刻つきの
// タイムラインとしてまとめて渡す（widgetService.buildTodayTimeline）。
// ============================================================

/** 1 コマ分。短いキー名なのは、タイムライン 1 件ごとに端末へ保存されるため */
export type WidgetClass = {
  /** 時限（「2限」「2교시」） */
  p: string;
  /** 時刻（「10:50–12:30」） */
  tm: string;
  /** 授業名 */
  n: string;
  /** 教室（無ければ空文字） */
  r: string;
  /** 授業の色 */
  c: string;
  /** 0 = 終わった / 1 = 授業中 / 2 = 次の授業 / 3 = そのあと */
  s: number;
};

export type TodayWidgetProps = {
  /** 日付（「11/14(金)」）。時間割が無いときは空 */
  title: string;
  /** 見出し（「今日の時間割」） */
  heading: string;
  items: WidgetClass[];
  /** 授業中・次の授業が無いときの文（「今日の授業は終わりました」など） */
  msg: string;
  nowLabel: string;
  nextLabel: string;
  /** 表示しきれない授業の数（「ほか{n}コマ」。{n} を数に置き換える） */
  more: string;
  /** タップで開く URL（アプリのホーム） */
  url: string;
};

const TodayTimetable = (props: TodayWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const family = environment.widgetFamily;
  const dark = environment.colorScheme === "dark";
  const bg = dark ? "#1C1C1E" : "#FFFFFF";
  const NOW_COLOR = "#E2574C";
  const NEXT_COLOR = "#2F6AD9";
  const secondary = { type: "hierarchical" as const, style: "secondary" as const };
  const items = props.items || [];
  // まだアプリからデータが来ていない（追加した直前・ギャラリーの見本）ときの表示
  const empty = !props.heading;
  const heading = empty ? "今日の時間割" : props.heading;
  const msg = empty ? "アプリを開くと表示されます" : props.msg;
  const moreText = (n: number) => (props.more || "+{n}").replace("{n}", String(n));

  let focus: WidgetClass | null = null;
  for (let i = 0; i < items.length; i++) {
    if (items[i].s === 1) {
      focus = items[i];
      break;
    }
  }
  if (!focus) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].s === 2) {
        focus = items[i];
        break;
      }
    }
  }
  const focusLabel = focus ? (focus.s === 1 ? props.nowLabel : props.nextLabel) : "";
  const focusColor = focus && focus.s === 1 ? NOW_COLOR : NEXT_COLOR;
  const rootMods = [containerBackground(bg, "widget"), widgetURL(props.url)];

  // ── ロック画面（長方形）: 次の授業を 3 行で
  if (family === "accessoryRectangular") {
    if (!focus) {
      return (
        <VStack alignment="leading" spacing={1} modifiers={[widgetURL(props.url)]}>
          <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>{heading}</Text>
          <Text modifiers={[font({ textStyle: "caption" }), lineLimit(2)]}>{msg}</Text>
        </VStack>
      );
    }
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(props.url)]}>
        <Text modifiers={[font({ textStyle: "caption", weight: "bold" }), lineLimit(1)]}>
          {focusLabel + " · " + focus.p + " " + focus.tm}
        </Text>
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>{focus.n}</Text>
        <Text modifiers={[font({ textStyle: "caption" }), lineLimit(1)]}>{focus.r}</Text>
      </VStack>
    );
  }

  // ── 小（2×2）: 次の授業（授業中ならその授業）を大きく
  if (family === "systemSmall") {
    let rest = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].s >= 2 && items[i] !== focus) rest++;
    }
    return (
      <VStack alignment="leading" spacing={3} modifiers={rootMods}>
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(secondary), lineLimit(1)]}>
          {props.title || heading}
        </Text>
        {focus ? (
          <VStack alignment="leading" spacing={3}>
            <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(focusColor), lineLimit(1)]}>
              {focusLabel}
            </Text>
            <Text modifiers={[font({ size: 13, weight: "semibold" }), lineLimit(1)]}>
              {focus.p + " " + focus.tm}
            </Text>
            <Text modifiers={[font({ size: 16, weight: "bold" }), lineLimit(2)]}>{focus.n}</Text>
            {focus.r ? (
              <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary), lineLimit(1)]}>{focus.r}</Text>
            ) : null}
          </VStack>
        ) : (
          <Text modifiers={[font({ size: 14, weight: "semibold" }), lineLimit(4), padding({ top: 6 })]}>
            {msg}
          </Text>
        )}
        <Spacer />
        {rest > 0 ? (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>{moreText(rest)}</Text>
        ) : null}
      </VStack>
    );
  }

  // ── 中（4×2）・大（4×4）: 今日の授業の一覧
  const large = family === "systemLarge";
  const max = large ? 7 : 4;
  // 入りきらないときは、終わった授業から外す（いまの授業が必ず見えるように）
  let list = items;
  while (list.length > max && list[0].s === 0) list = list.slice(1);
  const hidden = list.length > max ? list.length - max : 0;
  list = list.slice(0, max);

  return (
    <VStack alignment="leading" spacing={large ? 8 : 5} modifiers={rootMods}>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>{heading}</Text>
        <Spacer />
        {props.title ? (
          <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(secondary), lineLimit(1)]}>
            {props.title}
          </Text>
        ) : null}
      </HStack>
      {/* 授業が無い日・全部終わった日は、一覧ではなくひとこと */}
      {list.length === 0 || msg ? (
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(secondary), padding({ top: 8 })]}>
          {msg}
        </Text>
      ) : (
        <VStack alignment="leading" spacing={large ? 8 : 5}>
          {list.map((it, i) => (
            <HStack key={"c" + i} spacing={7} modifiers={it.s === 0 ? [opacity(0.4)] : []}>
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[foregroundStyle(it.c), frame({ width: 4, height: large ? 30 : 18 })]}
              />
              <Text
                modifiers={[
                  font({ size: 12, weight: "bold" }),
                  foregroundStyle(secondary),
                  frame({ width: large ? 44 : 38, alignment: "leading" }),
                  lineLimit(1),
                ]}
              >
                {it.p}
              </Text>
              {large ? (
                <VStack alignment="leading" spacing={1}>
                  <Text modifiers={[font({ size: 14, weight: "semibold" }), lineLimit(1)]}>{it.n}</Text>
                  <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>
                    {it.r ? it.tm + " · " + it.r : it.tm}
                  </Text>
                </VStack>
              ) : (
                <Text modifiers={[font({ size: 13, weight: "semibold" }), lineLimit(1)]}>{it.n}</Text>
              )}
              <Spacer />
              {it.s === 1 ? (
                <Text
                  modifiers={[
                    font({ size: 10, weight: "bold" }),
                    foregroundStyle("#FFFFFF"),
                    padding({ horizontal: 5, vertical: 2 }),
                    background(NOW_COLOR),
                    cornerRadius(4),
                    lineLimit(1),
                  ]}
                >
                  {props.nowLabel}
                </Text>
              ) : !large && it.r ? (
                <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>{it.r}</Text>
              ) : null}
            </HStack>
          ))}
          {hidden > 0 ? (
            <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary)]}>{moreText(hidden)}</Text>
          ) : null}
        </VStack>
      )}
      <Spacer />
    </VStack>
  );
};

export default createWidget<TodayWidgetProps>("TodayTimetable", TodayTimetable);
