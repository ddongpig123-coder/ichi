import {
  Button,
  HStack,
  Image,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  multilineTextAlignment,
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
//
// 表示（2026-11-17 準熙）: 小・ロック画面 = 今日の授業 / 中・大 = 今週の時間割（表）。
// 中・大の ◀ ▶（iOS 17+ のボタン）で「自分 → よく使う友達」を切り替える。押すと props.page が変わる
// （ウィジェット側でその時刻のエントリーだけ書き換わる → 次の切り替え時刻で自分に戻る）。
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
  /** 0 = 終わった / 1 = 授業中 / 2 = 次の授業 / 3 = そのあと（強調なし） */
  s: number;
};

/** 一人分の「今週の時間割」の表 */
export type WeekGrid = {
  /** 列の曜日（「月」…「金」、土曜に授業があれば「土」まで） */
  days: string[];
  /** 今日の列（日曜など無ければ -1） */
  today: number;
  /** 時限ごとの行（使っている時限の最初から最後まで）。s: 1 授業中 / 2 次（自分の今日の列だけ） */
  // 空きコマは 0（null は不可 — 端末の保存先 UserDefaults が null を受け付けず、アプリが落ちる）
  rows: { p: string; cells: ({ n: string; c: string; s: number } | 0)[] }[];
};

/** 中・大の 1 ページ（自分 or よく使う友達） */
export type WidgetPage = {
  /** 見出し（「自分の時間割」「田中の時間割」） */
  t: string;
  /** 時間割の表（友達の時間割が無い・非公開のときは無し） */
  week?: WeekGrid;
  /** 表の代わりのひとこと（「まだ今学期の時間割がありません」「時間割は非公開です」） */
  m?: string;
};

export type TodayWidgetProps = {
  /** 今日の日付（「11/17(火)」）。時間割が無いときは空 */
  title: string;
  /** 見出し（「今日の時間割」） */
  heading: string;
  /** 自分の今日の授業 */
  items: WidgetClass[];
  /** 授業中・次の授業が無いときの文（「今日は授業がありません」など） */
  msg: string;
  nowLabel: string;
  nextLabel: string;
  /** 表示しきれない授業の数（「ほか{n}コマ」。{n} を数に置き換える） */
  more: string;
  /** 中・大のページ（自分 → よく使う友達）。空なら msg を出す */
  pages: WidgetPage[];
  /** いま見ているページ（◀ ▶ で変わる） */
  page: number;
  /** タップで開く URL（アプリのホーム） */
  url: string;
};

const TodayTimetable = (props: TodayWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const family = environment.widgetFamily;
  const dark = environment.colorScheme === "dark";
  const bg = dark ? "#1C1C1E" : "#FFFFFF";
  const emptyCell = dark ? "#2C2C2E" : "#F2F2F7";
  const NOW_COLOR = "#E2574C";
  const NEXT_COLOR = "#2F6AD9";
  const secondary = { type: "hierarchical" as const, style: "secondary" as const };
  const primary = { type: "hierarchical" as const, style: "primary" as const };
  const items = props.items || [];
  // まだアプリからデータが来ていない（追加した直前・ギャラリーの見本）ときの表示
  const empty = !props.heading;
  const heading = empty ? "今日の時間割" : props.heading;
  const msg = empty ? "アプリを開くと表示されます" : props.msg;
  const moreText = (n: number) => (props.more || "+{n}").replace("{n}", String(n));
  const rootMods = [containerBackground(bg, "widget"), widgetURL(props.url)];

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

  // ── ロック画面（長方形）: 今日の次の授業（授業中ならその授業）
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
          {(focus.s === 1 ? props.nowLabel : props.nextLabel) + " · " + focus.p + " " + focus.tm}
        </Text>
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>{focus.n}</Text>
        <Text modifiers={[font({ textStyle: "caption" }), lineLimit(1)]}>{focus.r}</Text>
      </VStack>
    );
  }

  // ── 小（2×2）: 今日の時間割（一覧）。授業中は赤、次の授業は青、終わった授業は薄く
  if (family === "systemSmall") {
    const max = 5;
    let list = items;
    while (list.length > max && list[0].s === 0) list = list.slice(1);
    const hidden = list.length > max ? list.length - max : 0;
    list = list.slice(0, max);
    return (
      <VStack alignment="leading" spacing={4} modifiers={rootMods}>
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(secondary), lineLimit(1)]}>
          {props.title || heading}
        </Text>
        {list.length === 0 || msg ? (
          <Text modifiers={[font({ size: 14, weight: "semibold" }), lineLimit(4), padding({ top: 4 })]}>{msg}</Text>
        ) : (
          <VStack alignment="leading" spacing={4}>
            {list.map((it, i) => (
              <HStack key={"s" + i} spacing={5} modifiers={it.s === 0 ? [opacity(0.4)] : []}>
                <RoundedRectangle cornerRadius={1.5} modifiers={[foregroundStyle(it.c), frame({ width: 3, height: 15 })]} />
                <Text
                  modifiers={[
                    font({ size: 11, weight: "bold" }),
                    foregroundStyle(it.s === 1 ? NOW_COLOR : it.s === 2 ? NEXT_COLOR : secondary),
                    frame({ width: 12, alignment: "leading" }),
                  ]}
                >
                  {it.p.replace(/[^0-9]/g, "")}
                </Text>
                <Text
                  modifiers={[
                    font({ size: 13, weight: it.s === 1 ? "bold" : "semibold" }),
                    foregroundStyle(it.s === 1 ? NOW_COLOR : primary),
                    lineLimit(1),
                  ]}
                >
                  {it.n}
                </Text>
              </HStack>
            ))}
          </VStack>
        )}
        <Spacer />
        {hidden > 0 ? (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>{moreText(hidden)}</Text>
        ) : null}
      </VStack>
    );
  }

  // ── 中（4×2）・大（4×4）: 今週の時間割（表）。◀ ▶ で自分 → よく使う友達
  const large = family === "systemLarge";
  const pages = props.pages || [];
  if (pages.length === 0) {
    return (
      <VStack alignment="leading" spacing={8} modifiers={rootMods}>
        <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>{heading}</Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(secondary)]}>{msg}</Text>
        <Spacer />
      </VStack>
    );
  }
  let page = typeof props.page === "number" ? props.page : 0;
  if (page < 0 || page >= pages.length) page = 0;
  const cur = pages[page];
  const week = cur.week;
  const n = pages.length;
  const cellFont = large ? 10 : 9;
  const cellLines = large ? 3 : 1;

  return (
    <VStack alignment="leading" spacing={large ? 4 : 3} modifiers={rootMods}>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: large ? 14 : 13, weight: "bold" }), lineLimit(1)]}>{cur.t}</Text>
        <Spacer />
        {n > 1 ? (
          <HStack spacing={8}>
            <Button target="prev" onPress={() => ({ page: (page - 1 + n) % n })} modifiers={[buttonStyle("plain")]}>
              <Image systemName="chevron.left.circle.fill" size={large ? 22 : 20} color={NEXT_COLOR} />
            </Button>
            <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(secondary)]}>
              {page + 1 + "/" + n}
            </Text>
            <Button target="next" onPress={() => ({ page: (page + 1) % n })} modifiers={[buttonStyle("plain")]}>
              <Image systemName="chevron.right.circle.fill" size={large ? 22 : 20} color={NEXT_COLOR} />
            </Button>
          </HStack>
        ) : (
          <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(secondary), lineLimit(1)]}>
            {props.title}
          </Text>
        )}
      </HStack>
      {week ? (
        <VStack alignment="leading" spacing={large ? 4 : 3} modifiers={[frame({ maxHeight: 1000 })]}>
          <HStack spacing={3}>
            <Text modifiers={[font({ size: 9 }), frame({ width: 10 })]}>{" "}</Text>
            {week.days.map((d, i) => (
              <Text
                key={"d" + i}
                modifiers={[
                  font({ size: large ? 11 : 10, weight: i === week.today ? "bold" : "semibold" }),
                  foregroundStyle(i === week.today ? NEXT_COLOR : secondary),
                  frame({ maxWidth: 1000 }),
                  lineLimit(1),
                ]}
              >
                {d}
              </Text>
            ))}
          </HStack>
          {week.rows.map((row, r) => (
            <HStack key={"r" + r} spacing={3} modifiers={[frame({ maxHeight: 1000 })]}>
              <Text modifiers={[font({ size: 9, weight: "semibold" }), foregroundStyle(secondary), frame({ width: 10 })]}>
                {row.p}
              </Text>
              {row.cells.map((cell, k) => (
                <ZStack key={"x" + k} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 })]}>
                  <RoundedRectangle
                    cornerRadius={large ? 5 : 4}
                    modifiers={[
                      foregroundStyle(cell ? cell.c : emptyCell),
                      opacity(cell ? (cell.s ? 1 : k === week.today ? 0.4 : 0.22) : 1),
                    ]}
                  />
                  {cell ? (
                    <Text
                      modifiers={[
                        font({ size: cellFont, weight: "semibold" }),
                        foregroundStyle(cell.s ? "#FFFFFF" : primary),
                        multilineTextAlignment("center"),
                        lineLimit(cellLines),
                        minimumScaleFactor(0.7),
                        padding({ horizontal: 2 }),
                      ]}
                    >
                      {cell.n}
                    </Text>
                  ) : null}
                </ZStack>
              ))}
            </HStack>
          ))}
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxHeight: 1000 })]}>
          <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(secondary), padding({ top: 8 })]}>
            {cur.m || ""}
          </Text>
          <Spacer />
        </VStack>
      )}
    </VStack>
  );
};

export default createWidget<TodayWidgetProps>("TodayTimetable", TodayTimetable);
