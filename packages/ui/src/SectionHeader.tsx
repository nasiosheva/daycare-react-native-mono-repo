import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { spacing } from "./theme";

type SectionHeaderProps = {
  title: string;
  description?: string;
  /** e.g. a "See all" ghost button. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, description, action, style }: SectionHeaderProps) {
  return <View style={[styles.row, style]}>
    <View style={styles.copy}>
      <AppText variant="heading" accessibilityRole="header">{title}</AppText>
      {description && <AppText variant="bodySmall" tone="muted">{description}</AppText>}
    </View>
    {action}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  copy: { flex: 1, gap: 2 },
});
