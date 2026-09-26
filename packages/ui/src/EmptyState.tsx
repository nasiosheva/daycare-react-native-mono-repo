import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { colors, radius, spacing } from "./theme";

type IoniconName = keyof typeof Ionicons.glyphMap;
type EmptyStateAction = { label: string; onPress: () => void };

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: IoniconName;
  action?: EmptyStateAction;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Friendly placeholder for an empty list: says what is missing and, when possible, how to add it. */
export function EmptyState({ title, description, icon = "file-tray-outline", action, compact = false, style }: EmptyStateProps) {
  return <View style={[styles.container, compact && styles.compact, style]}>
    <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}><Ionicons name={icon} size={compact ? 22 : 30} color={colors.primary} /></View>
    <AppText variant={compact ? "label" : "h6"} style={styles.center}>{title}</AppText>
    {description && <AppText variant="bodySmall" tone="muted" style={styles.center}>{description}</AppText>}
    {action && <Button variant="secondary" onPress={action.onPress} style={styles.action}>{action.label}</Button>}
  </View>;
}

type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Shown when data fails to load; always offers a way to try again. */
export function ErrorState({ title, description, retryLabel, onRetry, compact = false, style }: ErrorStateProps) {
  return <View accessibilityRole="alert" style={[styles.container, styles.error, compact && styles.compact, style]}>
    <View style={[styles.iconCircle, styles.errorIconCircle, compact && styles.iconCircleCompact]}><Ionicons name="cloud-offline-outline" size={compact ? 22 : 30} color={colors.danger} /></View>
    <AppText variant={compact ? "label" : "h6"} style={styles.center}>{title}</AppText>
    {description && <AppText variant="bodySmall" tone="muted" style={styles.center}>{description}</AppText>}
    {onRetry && retryLabel && <Button variant="secondary" onPress={onRetry} style={styles.action}>{retryLabel}</Button>}
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.surface },
  compact: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  error: { borderStyle: "solid", borderColor: colors.dangerSoft },
  iconCircle: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTint },
  iconCircleCompact: { width: 44, height: 44 },
  errorIconCircle: { backgroundColor: colors.dangerSoft },
  center: { textAlign: "center", maxWidth: 420 },
  action: { marginTop: spacing.xs, alignSelf: "center" },
});
