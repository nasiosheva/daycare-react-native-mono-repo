import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function AnalyticsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const occupancy = useQuery({ queryKey: ["analytics-occupancy", organizationId], queryFn: () => api.analyticsOccupancy(), enabled: membership?.role === "STAFF_ADMIN" });
  const retention = useQuery({ queryKey: ["analytics-parent-retention", organizationId], queryFn: () => api.analyticsParentRetention(), enabled: membership?.role === "STAFF_ADMIN" });
  const trend = useQuery({ queryKey: ["analytics-development-trend", organizationId], queryFn: () => api.analyticsDevelopmentTrend(), enabled: membership?.role === "STAFF_ADMIN" });

  if (!profile) return null;
  if (!membership || membership.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("analytics.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <View style={styles.section}>
      <AppText variant="heading">{t("analytics.occupancy")}</AppText>
      {occupancy.isFetching && <ShimmerList variant="row" />}
      {occupancy.isError && <AppText tone="danger">{t("common.error")}</AppText>}
      {!occupancy.isFetching && occupancy.data?.map((branch) => <View key={branch.branchId} style={styles.row}>
        <AppText>{branch.branchName}</AppText>
        <AppText tone="muted">{branch.dailyCapacity != null ? t("analytics.occupancyWithCapacity", { count: branch.activeChildrenCount, capacity: branch.dailyCapacity }) : t("analytics.occupancyNoCapacity", { count: branch.activeChildrenCount })}</AppText>
      </View>)}
      {!occupancy.isFetching && occupancy.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </View>

    <View style={styles.section}>
      <AppText variant="heading">{t("analytics.retention")}</AppText>
      {retention.isFetching && <ShimmerList variant="row" />}
      {retention.isError && <AppText tone="danger">{t("common.error")}</AppText>}
      {!retention.isFetching && retention.data && <>
        <AppText tone="muted">{t("analytics.currentActiveParents", { count: retention.data.currentActiveParents })}</AppText>
        {retention.data.monthly.map((item) => <View key={item.month} style={styles.row}><AppText>{item.month}</AppText><AppText tone="muted">{t("analytics.deactivatedCount", { count: item.deactivatedCount })}</AppText></View>)}
      </>}
    </View>

    <View style={styles.section}>
      <AppText variant="heading">{t("analytics.developmentTrend")}</AppText>
      {trend.isFetching && <ShimmerList variant="row" />}
      {trend.isError && <AppText tone="danger">{t("common.error")}</AppText>}
      {!trend.isFetching && trend.data?.map((item) => <View key={item.month} style={styles.row}>
        <AppText>{item.month}</AppText>
        <AppText tone="muted">{item.goalCount === 0 ? t("analytics.noGoalsThatMonth") : item.averageYesPercent != null ? t("analytics.averageYesPercent", { percent: item.averageYesPercent, count: item.goalCount }) : t("analytics.noCheckInsThatMonth", { count: item.goalCount })}</AppText>
      </View>)}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
});
