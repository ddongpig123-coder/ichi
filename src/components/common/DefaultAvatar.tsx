import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

interface DefaultAvatarProps {
  size?: number;
}

/**
 * カカオトーク風のデフォルトプロフィール画像。
 * 灰色の円形背景に人物シルエット（頭部＋肩）を描画。
 */
export default function DefaultAvatar({ size = 40 }: DefaultAvatarProps) {
  const bg = "#C9CDD2";
  const fg = "#F5F7FA";

  // シルエットの比率（全体 size を 1 とした相対値）
  const cx = size / 2;
  const headR = size * 0.22;
  const headCY = size * 0.38;

  // 肩：楕円の上半分をパスで描く
  const shoulderRx = size * 0.36;
  const shoulderRy = size * 0.26;
  const shoulderCY = size * 0.78;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      <Svg width={size} height={size}>
        {/* 背景円 */}
        <Circle cx={cx} cy={cx} r={cx} fill={bg} />
        {/* 頭部 */}
        <Circle cx={cx} cy={headCY} r={headR} fill={fg} />
        {/* 肩（楕円の上半分） */}
        <Path
          d={`M ${cx - shoulderRx} ${shoulderCY}
              A ${shoulderRx} ${shoulderRy} 0 0 1 ${cx + shoulderRx} ${shoulderCY}
              Z`}
          fill={fg}
        />
      </Svg>
    </View>
  );
}
