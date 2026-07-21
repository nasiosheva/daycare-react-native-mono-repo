import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Props = { children: ReactNode; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle> };

export function Button({ children, onPress, variant = "primary", disabled = false, loading = false, accessibilityLabel, style }: Props) {
  const inactive = disabled || loading;
  const textTone = variant === "primary" || variant === "danger" ? "onDark" : "onLight";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], inactive && styles.disabled, pressed && !inactive && styles.pressed, style]}
    >
      <View style={styles.content}>
        {loading && <ActivityIndicator color={textTone === "onDark" ? colors.onPrimary : colors.primary} />}
        <AppText variant="label" style={textTone === "onDark" ? styles.onDark : undefined}>{children}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, justifyContent: "center", borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1 },
  content: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  pressed: { opacity: 0.82 },
  onDark: { color: colors.onPrimary },
  onLight: { color: colors.text },
});
