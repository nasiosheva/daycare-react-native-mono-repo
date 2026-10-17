// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, BackButton, Badge, Button, EmptyState, ErrorState, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import type { TenantSubscriptionStatus } from "@daycare/core";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localeTags, tenantSubscriptionStatusKey, type TranslationKey } from "@/i18n/translations";

const PAGE_SIZE = 20;

export default function TenantGraceRolloutScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, locale } = useI18n();
  const [page, setPage] = useState(0);
  const preview = useQuery({
    queryKey: ["tenant-grace-rollout-preview", page],
    queryFn: () => api.tenantGraceRolloutPreview(page, PAGE_SIZE),
    enabled: Boolean(profile?.isPlatformAdmin),
  });

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const data = preview.data;
  return <AppScreen>
    <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />
    <AppText variant="title">{t("tenant.graceRolloutTitle")}</AppText>
    <AppText variant="body" tone="muted">{t("tenant.graceRolloutDescription")}</AppText>
    {preview.isLoading && <ShimmerList />}
    {preview.isError && !preview.isLoading && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("tenant.reload")} onRetry={() => void preview.refetch()} />}
    {data && <>
      <View style={styles.statusRow}>
        <Badge tone={data.graceLifecycleEnabled ? "success" : "warning"} label={t(data.graceLifecycleEnabled ? "tenant.graceRolloutEnabled" : "tenant.graceRolloutDisabled")} />
        <Button variant="secondary" loading={preview.isFetching} onPress={() => { if (page === 0) void preview.refetch(); else setPage(0); }}>{t("tenant.graceRolloutRefresh")}</Button>
      </View>
      <View style={styles.summary}>
        <AppText variant="label">{t("tenant.graceRolloutTenants")}: {data.totalTenantCount}</AppText>
        <AppText variant="label">{t("tenant.graceRolloutAffected")}: {data.affectedTenantCount}</AppText>
        <AppText variant="bodySmall">{t("tenant.graceRolloutGenerated", { date: new Date(data.generatedAt).toLocaleString(localeTags[locale]) })}</AppText>
        <AppText variant="caption" tone="muted">{t("tenant.graceRolloutSnapshot")}: {data.snapshotToken.slice(0, 16)}…</AppText>
        <AppText variant="caption" tone="muted">{t("tenant.graceRolloutCurrent")}: {Object.entries(data.currentStatusCounts).map(([status, count]) => `${t(tenantSubscriptionStatusKey(status as TenantSubscriptionStatus))} ${count}`).join(" · ") || "—"}</AppText>
        <AppText variant="caption" tone="muted">{t("tenant.graceRolloutProposed")}: {Object.entries(data.proposedStatusCounts).map(([status, count]) => `${t(tenantSubscriptionStatusKey(status as TenantSubscriptionStatus))} ${count}`).join(" · ") || "—"}</AppText>
      </View>
      {data.tenants.length === 0 && <EmptyState compact title={t("tenant.graceRolloutEmpty")} />}
      {data.tenants.map((tenant) => <View key={tenant.organizationId} style={styles.card}>
        <AppText variant="h6">{tenant.tenantName}</AppText>
        <AppText variant="caption" tone="muted">{tenant.periodEnd} · {t("tenant.graceRolloutDays", { count: tenant.gracePeriodDays })}</AppText>
        <View style={styles.statusRow}>
          <AppText variant="bodySmall">{t("tenant.graceRolloutCurrent")}</AppText>
          <Badge tone="warning" label={t(tenantSubscriptionStatusKey(tenant.currentEffectiveStatus))} />
        </View>
        <AppText variant="caption" tone="muted">{t("tenant.graceRolloutAccess")}: {t(`tenant.graceRolloutAccess.${tenant.currentAccessLevel}` as TranslationKey)}</AppText>
        <View style={styles.statusRow}>
          <AppText variant="bodySmall">{t("tenant.graceRolloutProposed")}</AppText>
          <Badge tone="success" label={t(tenantSubscriptionStatusKey(tenant.proposedEffectiveStatus))} />
        </View>
        <AppText variant="caption" tone="muted">{t("tenant.graceRolloutAccess")}: {t(`tenant.graceRolloutAccess.${tenant.proposedAccessLevel}` as TranslationKey)}</AppText>
      </View>)}
      {page + 1 < data.totalPages && <Button loading={preview.isFetching} onPress={() => setPage((current) => current + 1)}>{t("tenant.graceRolloutMore")}</Button>}
    </>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  summary: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
