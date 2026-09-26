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
};

export function FloatingActionButton({ children, onPress, accessibilityLabel, icon }: FloatingActionButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    {icon && <Ionicons name={icon} size={22} color={colors.onPrimary} />}
    <AppText variant="label" style={styles.label}>{children}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary, ...shadows.md },
  label: { color: colors.onPrimary },
  pressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
});
