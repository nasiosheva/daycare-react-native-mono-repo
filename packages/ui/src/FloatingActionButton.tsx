import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors, radius, shadows, spacing } from "./theme";

type FloatingActionButtonProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconOnly?: boolean;
  variant?: "primary" | "surface";
};

export function FloatingActionButton({ children, onPress, accessibilityLabel, icon, iconOnly = false, variant = "primary" }: FloatingActionButtonProps) {
  const isSurface = variant === "surface";
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.button, isSurface && styles.surface, iconOnly && styles.iconOnly, pressed && styles.pressed]}>
    {icon && <Ionicons name={icon} size={22} color={isSurface ? colors.primary : colors.onPrimary} />}
    {!iconOnly && <AppText variant="label" style={[styles.label, isSurface && styles.surfaceLabel]}>{children}</AppText>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary, ...shadows.md },
  surface: { backgroundColor: colors.surface },
  iconOnly: { width: 56, paddingHorizontal: 0 },
  label: { color: colors.onPrimary },
  surfaceLabel: { color: colors.primary },
  pressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
});
