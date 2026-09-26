import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { radius, spacing, toneColors, type Tone } from "./theme";

type BadgeProps = {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

/** Small status pill: "Active", "Pending", "Needs attention"... Colour is never the only signal — always pass a label. */
export function Badge({ label, tone = "neutral", icon, style }: BadgeProps) {
  const palette = toneColors[tone];
  return <View style={[styles.badge, { backgroundColor: palette.background }, style]}>
    {icon && <Ionicons name={icon} size={12} color={palette.foreground} />}
    <AppText variant="caption" style={[styles.label, { color: palette.foreground }]}>{label}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: spacing.xs, paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  label: { fontWeight: "700" },
});
