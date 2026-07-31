import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

type FloatingActionButtonProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
};

export function FloatingActionButton({ children, onPress, accessibilityLabel }: FloatingActionButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <AppText variant="label" style={styles.label}>{children}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 56, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary, shadowColor: colors.text, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  label: { color: colors.onPrimary },
  pressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
});
