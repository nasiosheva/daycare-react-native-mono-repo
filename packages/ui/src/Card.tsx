import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors, radius, shadows, spacing } from "./theme";

type CardProps = {
  children?: ReactNode;
  /** Optional heading shown at the top of the card. */
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Right-aligned element in the header, typically a Badge. */
  trailing?: ReactNode;
  /** "tinted" is for secondary information that sits inside another surface. */
  variant?: "default" | "tinted" | "selected";
  style?: StyleProp<ViewStyle>;
};

/** Standard content surface. Keeps padding, border and heading layout identical across screens. */
export function Card({ children, title, subtitle, icon, trailing, variant = "default", style }: CardProps) {
  const hasHeader = Boolean(title || icon || trailing);
  return <View style={[styles.card, styles[variant], style]}>
    {hasHeader && <View style={styles.header}>
      {icon && <View style={styles.iconTile}><Ionicons name={icon} size={20} color={colors.primary} /></View>}
      <View style={styles.heading}>
        {title && <AppText variant="h6" accessibilityRole="header">{title}</AppText>}
        {subtitle && <AppText variant="bodySmall" tone="muted">{subtitle}</AppText>}
      </View>
      {trailing}
    </View>}
    {children}
  </View>;
}

/** Label/value pair for summaries such as invoice or application details. */
export function InfoRow({ label, value, icon }: { label: string; value: ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.infoRow}>
    {icon && <Ionicons name={icon} size={16} color={colors.muted} style={styles.infoIcon} />}
    <View style={styles.infoCopy}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      {typeof value === "string" ? <AppText variant="label">{value}</AppText> : value}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  default: { borderColor: colors.border, backgroundColor: colors.surface, ...shadows.sm },
  tinted: { borderColor: "transparent", backgroundColor: colors.surfaceTint },
  selected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surfaceTint },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconTile: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  heading: { flex: 1, gap: 2 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  infoIcon: { marginTop: 2 },
  infoCopy: { flex: 1, gap: 2 },
});
