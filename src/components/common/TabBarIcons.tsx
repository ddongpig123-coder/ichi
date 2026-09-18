import type { ColorValue } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

// タブバー用の単色SVGアイコン（フォント不使用＝実機で豆腐化しない）。
// 色は color prop（＝タブのactive/inactive tint）を継承。無彩色運用。
type IconProps = { color: ColorValue; size?: number };

const SW = 1.8; // stroke-width 統一

export function HomeIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11 L12 4 L20 11" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 9.5 V20 H18 V9.5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 20 v-5 h4 v5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BoardIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4} width={14} height={17} rx={2.4} stroke={color} strokeWidth={SW} />
      <Path d="M8.5 9 H15.5 M8.5 13 H15.5 M8.5 17 H13" stroke={color} strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function FriendsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8.5} r={3} stroke={color} strokeWidth={SW} />
      <Path d="M3.5 19.5 c0-3.2 2.6-5 5.5-5 s5.5 1.8 5.5 5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={17} cy={9.5} r={2.3} stroke={color} strokeWidth={SW} />
      <Path d="M16 14.7 c2.6 .1 4.5 1.7 4.5 4.3" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 쪽지 = 封筒（メッセージ）アイコン
export function MessageIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6} width={18} height={13} rx={2.2} stroke={color} strokeWidth={SW} />
      <Path d="M4.2 7.5 L12 13 L19.8 7.5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={3.6} stroke={color} strokeWidth={SW} />
      <Path d="M4.5 20 c0-4 3.6-6 7.5-6 s7.5 2 7.5 6" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
