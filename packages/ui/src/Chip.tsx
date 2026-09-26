import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Selectable option pill. Lighter than a full Button when the user picks one of several values. */
export function Chip({ label, selected, onPress, disabled = false, accessibilityLabel }: ChipProps) {
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ checked: selected, disabled }}
    disabled={disabled}
    hitSlop={{ top: 4, bottom: 4 }}
    onPress={onPress}
    style={({ pressed }) => [styles.chip, selected && styles.selected, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
  >
    {selected && <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
    <AppText variant="label" style={selected ? styles.selectedLabel : undefined}>{label}</AppText>
  </Pressable>;
}

/** Wrapping row of chips with shared spacing. */
export function ChipGroup({ children, accessibilityLabel, style }: { children: ReactNode; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedLabel: { color: colors.onPrimary },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
