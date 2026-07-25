import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useEntitlements } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";

export default function ParentSubscriptionsScreen() {
  const router = useRouter();
  const { profile, organizationId, api } = useAuth();
  const { t, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const entitlements = useEntitlements({ branchId: filterBranchId });
  const activeCount = useMemo(() => entitlements.data?.filter((item) => item.status === "ACTIVE").length ?? 0, [entitlements.data]);
  const totalCount = entitlements.data?.length ?? 0;
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("staffAdmin.subscriptionsTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <BranchTab label={t("branchFilter.allBranches")} selected={!filterBranchId} onPress={() => setFilterBranchId(undefined)} />
      {branches.data?.map((branch) => <BranchTab key={branch.id} label={branch.name} selected={filterBranchId === branch.id} onPress={() => setFilterBranchId(branch.id)} />)}
    </ScrollView>
    <NavigationCard accessibilityLabel={t("staffAdmin.subscriptionsTitle")} onPress={() => setSheetOpen(true)}>
      <AppText variant="h5">{t("staffAdmin.subscriptionsTitle")}</AppText>
      <AppText variant="bodySmall" tone="muted">{t("staffAdmin.subscriptionsSubtitle")}</AppText>
      <AppText tone={totalCount > 0 ? "default" : "muted"}>{totalCount > 0 ? t("staffAdmin.subscriptionsSummary", { active: activeCount, total: totalCount }) : t("staffAdmin.noSubscriptions")}</AppText>
    </NavigationCard>
    <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("staffAdmin.subscriptionsTitle")}>
      {entitlements.data?.map((entitlement) => <View key={entitlement.id} style={styles.card}>
        <AppText variant="h5">{entitlement.childName}</AppText>
        <AppText tone="muted">{t("staffAdmin.parent")}: {entitlement.parentName ?? entitlement.parentEmail ?? t("common.noData")}</AppText>
        <AppText>{entitlement.planName} · {t(servicePlanTypeKey(entitlement.type))}</AppText>
        <AppText variant="bodySmall">{entitlement.totalCredits == null ? t("staffAdmin.monthlyQuota") : t("staffAdmin.quota", { remaining: entitlement.remainingCredits ?? 0, total: entitlement.totalCredits })}</AppText>
        <AppText variant="caption" tone="muted">{t(`status.${entitlement.status}` as Parameters<typeof t>[0])} · {t("staffAdmin.validUntil", { date: formatDate(entitlement.validUntil) })}</AppText>
      </View>)}
      {!entitlements.isLoading && entitlements.data?.length === 0 && <AppText tone="muted">{t("staffAdmin.noSubscriptions")}</AppText>}
    </BottomSheet>
  </AppScreen>;
}

function BranchTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
});
