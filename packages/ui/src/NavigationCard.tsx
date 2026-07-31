import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "./theme";

type NavigationCardProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function NavigationCard({ children, onPress, accessibilityLabel, disabled = false, trailing, style }: NavigationCardProps) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
  >
    <View style={styles.content}><View style={styles.body}>{children}</View>{trailing ?? <Ionicons name="chevron-forward" size={22} color={colors.primary} />}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...shadows.sm },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  body: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.78, backgroundColor: colors.surfaceTint, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
