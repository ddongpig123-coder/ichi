import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

// 星評価（表示 + 入力兼用）。onChange を渡すと入力可能になる。
// 集計平均の表示は四捨五入した数の星を塗る（数値は呼び出し側で併記）。
const STAR_GOLD = "#F5A623";

interface Props {
  value: number;              // 0〜5
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
  size?: number;
}

export default function StarRating({ value, onChange, size = 20 }: Props) {
  const { theme } = useTheme();
  const filledCount = Math.round(value);

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const color = n <= filledCount ? STAR_GOLD : theme.border;
        const star = <Text style={{ fontSize: size, color, lineHeight: size * 1.1 }}>★</Text>;
        if (!onChange) return <View key={n}>{star}</View>;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
            hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
          >
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2, alignItems: "center" },
});
