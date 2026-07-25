import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "./theme";

type ShimmerProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

type ShimmerListVariant = "card" | "row" | "tile";
type ShimmerListProps = {
  count?: number;
  variant?: ShimmerListVariant;
  style?: StyleProp<ViewStyle>;
};

export function Shimmer({ width = "100%", height = 16, borderRadius = radius.sm, style }: ShimmerProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.38);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.38, duration: 700, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

  return <Animated.View accessible={false} style={[styles.block, { width, height, borderRadius, opacity }, style]} />;
}

export function ShimmerList({ count = 3, variant = "card", style }: ShimmerListProps) {
  const layout = shimmerLayouts[variant];
  return <View accessibilityElementsHidden style={[styles.list, style]}>
    {Array.from({ length: count }, (_, index) => <View key={index} style={layout.container}>
      {layout.lines.map((line, lineIndex) => <Shimmer key={lineIndex} {...line} />)}
    </View>)}
  </View>;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => subscription.remove();
  }, []);
  return reducedMotion;
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  block: { backgroundColor: colors.disabled },
  card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  row: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tile: { flexBasis: "47%", flexGrow: 1, gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});

const shimmerLayouts: Record<ShimmerListVariant, { container: ViewStyle; lines: ShimmerProps[] }> = {
  card: { container: styles.card, lines: [{ width: "58%", height: 20 }, { width: "92%", height: 14 }, { width: "42%", height: 14 }] },
  row: { container: styles.row, lines: [{ width: "48%", height: 18 }, { width: "80%", height: 14 }] },
  tile: { container: styles.tile, lines: [{ width: "72%", height: 18 }, { width: "56%", height: 14 }] },
};
