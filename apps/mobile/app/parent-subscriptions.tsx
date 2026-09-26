import { useMemo, useState } from "react";

import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, Badge, BottomSheet, Card, EmptyState, InfoRow, NavigationCard, ShimmerList, TabBar } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useEntitlements } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";

export default function ParentSubscriptionsScreen() {
  return (
    <LegacyDaycareRouteGuard policy={legacyDaycareRoutePolicies.staffAdminDaycareOperations}>
      <ParentSubscriptionsScreenContent />
    </LegacyDaycareRouteGuard>
  );
}

function ParentSubscriptionsScreenContent() {
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
    <TabBar accessibilityLabel={t("branchFilter.allBranches")} selected={filterBranchId ?? ""} onSelect={(key) => setFilterBranchId(key || undefined)} items={[{ key: "", label: t("branchFilter.allBranches") }, ...(branches.data?.map((branch) => ({ key: branch.id, label: branch.name })) ?? [])]} />
    <NavigationCard accessibilityLabel={t("staffAdmin.subscriptionsTitle")} onPress={() => setSheetOpen(true)}>
      <AppText variant="h5">{t("staffAdmin.subscriptionsTitle")}</AppText>
      <AppText variant="bodySmall" tone="muted">{t("staffAdmin.subscriptionsSubtitle")}</AppText>
      <AppText tone={totalCount > 0 ? "default" : "muted"}>{totalCount > 0 ? t("staffAdmin.subscriptionsSummary", { active: activeCount, total: totalCount }) : t("staffAdmin.noSubscriptions")}</AppText>
    </NavigationCard>
    <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("staffAdmin.subscriptionsTitle")}>
      {entitlements.isFetching && <ShimmerList />}
      {!entitlements.isFetching && entitlements.data?.map((entitlement) => <Card key={entitlement.id} title={entitlement.childName} subtitle={`${entitlement.planName} · ${t(servicePlanTypeKey(entitlement.type))}`} trailing={<Badge tone={statusTone(entitlement.status)} label={t(`status.${entitlement.status}` as Parameters<typeof t>[0])} />}>
        <AppText variant="label">{entitlement.totalCredits == null ? t("staffAdmin.monthlyQuota") : t("staffAdmin.quota", { remaining: entitlement.remainingCredits ?? 0, total: entitlement.totalCredits })}</AppText>
        <InfoRow icon="person-outline" label={t("staffAdmin.parent")} value={entitlement.parentName ?? entitlement.parentEmail ?? t("common.noData")} />
        <AppText variant="caption" tone="muted">{t("staffAdmin.validUntil", { date: formatDate(entitlement.validUntil) })}</AppText>
      </Card>)}
      {!entitlements.isFetching && entitlements.data?.length === 0 && <EmptyState compact title={t("staffAdmin.noSubscriptions")} />}
    </BottomSheet>
  </AppScreen>;
}
