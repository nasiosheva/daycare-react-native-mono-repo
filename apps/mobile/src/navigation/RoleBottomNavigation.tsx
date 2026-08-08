import { usePathname, useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InstitutionCapability, Role } from "@daycare/core";
import { AppText, colors, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

type IoniconName = keyof typeof Ionicons.glyphMap;
type NavigationItem = { href: Extract<Href, string>; labelKey: TranslationKey; icon: IoniconName; requiredCapability?: InstitutionCapability };
export type NavigationRole = Role | "PARENT_ONBOARDING";

const navigationByRole: Record<NavigationRole, NavigationItem[]> = {
  ADMIN: [
    { href: "/home", labelKey: "nav.home", icon: "home" },
    { href: "/platform-tenants", labelKey: "nav.tenant", icon: "business" },
    { href: "/platform-catalog", labelKey: "nav.catalog", icon: "grid" },
  ],
  STAFF_ADMIN: [
    { href: "/home", labelKey: "nav.home", icon: "home" },
    { href: "/children", labelKey: "children.title", icon: "people" },
    { href: "/academic", labelKey: "nav.academic", icon: "school" },
    { href: "/staff-admin", labelKey: "nav.management", icon: "settings" },
  ],
  STAFF: [
    { href: "/home", labelKey: "nav.home", icon: "home" },
    { href: "/staff-operations", labelKey: "nav.staffFlow", icon: "clipboard" },
    { href: "/academic", labelKey: "nav.academic", icon: "school" },
    { href: "/booking-approvals", labelKey: "nav.approvals", icon: "checkmark-circle", requiredCapability: "DAYCARE_OPERATIONS" },
  ],
  PARENT: [
    { href: "/home", labelKey: "nav.home", icon: "home" },
    { href: "/parent-qr", labelKey: "nav.qr", icon: "qr-code", requiredCapability: "DAYCARE_OPERATIONS" },
    { href: "/booking", labelKey: "nav.booking", icon: "calendar", requiredCapability: "DAYCARE_OPERATIONS" },
    { href: "/operational-hours", labelKey: "nav.operatingHours", icon: "time", requiredCapability: "DAYCARE_OPERATIONS" },
  ],
  PARENT_ONBOARDING: [
    { href: "/home", labelKey: "nav.home", icon: "home" },
    { href: "/parent-enrollment", labelKey: "nav.enrollment", icon: "document-text" },
  ],
};

export const bottomNavigationPaths = new Set<string>(Object.values(navigationByRole).flat().map((item) => item.href));

export function RoleBottomNavigation({ role }: { role: NavigationRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const access = useUiAccessContext(role !== "ADMIN" && role !== "PARENT_ONBOARDING");
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
    {navigationByRole[role].filter((item) => !item.requiredCapability || hasOfferingCapability(access.data, item.requiredCapability)).map((item) => {
      const selected = pathname === item.href;
      const iconName = (selected ? item.icon : `${item.icon}-outline`) as IoniconName;
      return <Pressable
        key={item.href}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        onPress={() => router.replace(item.href)}
        style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}
      >
        <View style={[styles.indicator, selected && styles.indicatorActive]} />
        <Ionicons name={iconName} size={24} color={selected ? colors.primary : colors.muted} />
        <AppText variant="caption" style={selected ? styles.selectedLabel : styles.label}>{t(item.labelKey)}</AppText>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { minWidth: "100%", paddingHorizontal: spacing.xs },
  item: { minWidth: 72, minHeight: 60, flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.sm },
  selected: { backgroundColor: colors.surfaceTint },
  pressed: { opacity: 0.76 },
  indicator: { width: 24, height: 3, borderRadius: 999, backgroundColor: "transparent" },
  indicatorActive: { backgroundColor: colors.primary },
  label: { color: colors.muted, textAlign: "center" },
  selectedLabel: { color: colors.primary, fontWeight: "700", textAlign: "center" },
});
