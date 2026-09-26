import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

export type TabBarItem<T extends string> = { key: T; label: string; count?: number };

type TabBarProps<T extends string> = {
  items: readonly TabBarItem<T>[];
  selected: T;
  onSelect: (key: T) => void;
  accessibilityLabel?: string;
};

/** Horizontally scrolling underline tabs, e.g. a branch filter or attendance status filter. */
export function TabBar<T extends string>({ items, selected, onSelect, accessibilityLabel }: TabBarProps<T>) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.scroll} contentContainerStyle={styles.tabs}>
    {items.map((item) => {
      const active = item.key === selected;
      return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onSelect(item.key)} style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}>
        <AppText variant="label" style={active ? styles.activeText : styles.text}>{item.label}</AppText>
        {item.count != null && <View style={[styles.count, active && styles.countActive]}><AppText variant="caption" style={active ? styles.countTextActive : styles.countText}>{item.count}</AppText></View>}
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  text: { color: colors.muted },
  activeText: { color: colors.primary },
  pressed: { opacity: 0.72 },
  count: { minWidth: 22, alignItems: "center", paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.disabled },
  countActive: { backgroundColor: colors.primary },
  countText: { color: colors.muted, fontWeight: "700" },
  countTextActive: { color: colors.onPrimary, fontWeight: "700" },
});
