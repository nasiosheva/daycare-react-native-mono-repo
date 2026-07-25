import { usePathname, useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { InstitutionCapability, Role } from "@daycare/core";
import { AppText, colors, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

type NavigationItem = { href: Extract<Href, string>; labelKey: TranslationKey; requiredCapability?: InstitutionCapability };
export type NavigationRole = Role | "PARENT_ONBOARDING";

const navigationByRole: Record<NavigationRole, NavigationItem[]> = {
  ADMIN: [
    { href: "/home", labelKey: "nav.home" },
    { href: "/platform-tenants", labelKey: "nav.tenant" },
    { href: "/profile", labelKey: "nav.profile" },
  ],
  STAFF_ADMIN: [
    { href: "/home", labelKey: "nav.home" },
    { href: "/academic", labelKey: "nav.academic" },
    { href: "/staff-admin", labelKey: "nav.management" },
  ],
  STAFF: [
    { href: "/home", labelKey: "nav.home" },
    { href: "/staff-operations", labelKey: "nav.staffFlow" },
    { href: "/academic", labelKey: "nav.academic" },
    { href: "/booking-approvals", labelKey: "nav.approvals", requiredCapability: "DAYCARE_OPERATIONS" },
  ],
  PARENT: [
    { href: "/home", labelKey: "nav.home" },
    { href: "/development", labelKey: "nav.development" },
    { href: "/parent-qr", labelKey: "nav.qr" },
    { href: "/booking", labelKey: "nav.booking", requiredCapability: "DAYCARE_OPERATIONS" },
    { href: "/operational-hours", labelKey: "nav.operatingHours", requiredCapability: "DAYCARE_OPERATIONS" },
    { href: "/profile", labelKey: "nav.profile" },
  ],
  PARENT_ONBOARDING: [
    { href: "/home", labelKey: "nav.home" },
    { href: "/parent-enrollment", labelKey: "nav.enrollment" },
    { href: "/profile", labelKey: "nav.profile" },
  ],
};

export const bottomNavigationPaths = new Set<string>(Object.values(navigationByRole).flat().map((item) => item.href));

export function RoleBottomNavigation({ role, capabilities = [] }: { role: NavigationRole; capabilities?: readonly InstitutionCapability[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
    {navigationByRole[role].filter((item) => !item.requiredCapability || capabilities.includes(item.requiredCapability)).map((item) => {
      const selected = pathname === item.href;
      return <Pressable
        key={item.href}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        onPress={() => router.replace(item.href)}
        style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}
      >
        <View style={styles.indicator} />
        <AppText variant="caption" style={selected ? styles.selectedLabel : styles.label}>{t(item.labelKey)}</AppText>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { minWidth: "100%", paddingHorizontal: spacing.xs },
  item: { minWidth: 88, minHeight: 60, flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.sm },
  selected: { backgroundColor: colors.surfaceTint },
  pressed: { opacity: 0.76 },
  indicator: { width: 24, height: 3, borderRadius: 999, backgroundColor: "transparent" },
  label: { color: colors.muted, textAlign: "center" },
  selectedLabel: { color: colors.primary, fontWeight: "700", textAlign: "center" },
});
