import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { NavigationCard } from "./NavigationCard";
import { colors, radius, spacing, toneColors } from "./theme";

type MenuItemProps = {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Right-aligned status such as a Badge or a count. */
  badge?: ReactNode;
  /** Highlights the item when it needs the user's action (e.g. incomplete setup). */
  attention?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Menu entry with an icon tile so users can scan and recognise features quickly. */
export function MenuItem({ title, description, icon, onPress, badge, attention = false, disabled, style }: MenuItemProps) {
  return <NavigationCard
    accessibilityLabel={description ? `${title}. ${description}` : title}
    onPress={onPress}
    disabled={disabled}
    style={[attention && styles.attention, style]}
    leading={<View style={[styles.iconTile, attention && styles.iconTileAttention]}><Ionicons name={icon} size={22} color={attention ? colors.danger : colors.primary} /></View>}
  >
    <View style={styles.titleRow}>
      <AppText variant="h6" style={styles.title}>{title}</AppText>
      {badge}
    </View>
    {description && <AppText variant="bodySmall" tone="muted" numberOfLines={2}>{description}</AppText>}
  </NavigationCard>;
}

/** Groups related MenuItems under a heading so long menus stay easy to scan. */
export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}>
    <AppText variant="overline" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>{title.toUpperCase()}</AppText>
    <View style={styles.sectionItems}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  attention: { borderColor: colors.danger, backgroundColor: toneColors.danger.background },
  iconTile: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  iconTileAttention: { backgroundColor: colors.surface },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flexShrink: 1 },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.xs },
  sectionItems: { gap: spacing.sm },
});
