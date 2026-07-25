import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useEntitlements } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { BranchFilterControl } from "@/branches/BranchFilterSheet";

export default function ParentSubscriptionsScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const entitlements = useEntitlements({ branchId: filterBranchId });
  const activeCount = useMemo(() => entitlements.data?.filter((item) => item.status === "ACTIVE").length ?? 0, [entitlements.data]);
  const totalCount = entitlements.data?.length ?? 0;
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("staffAdmin.subscriptionsTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <BranchFilterControl branchId={filterBranchId} onChange={setFilterBranchId} />
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

const styles = StyleSheet.create({ card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint } });
