import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { TenantReadiness } from "@daycare/api-client";
import { AppText, Avatar, BackButton, Badge, EmptyState, ErrorState, NavigationCard, SectionHeader, ShimmerList, colors, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantReadinessIssueKey } from "@/i18n/translations";

export default function TenantReadinessScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const readiness = useQuery({ queryKey: ["platform-tenant-readiness"], queryFn: () => api.tenantReadiness(), enabled: Boolean(profile?.isPlatformAdmin) });

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;
  const tenants = readiness.data?.tenants ?? [];
  const needsAttention = tenants.filter((tenant) => tenant.status === "NEEDS_ATTENTION");
  const ready = tenants.filter((tenant) => tenant.status === "READY");

  return <AppScreen showBottomNavigation={false} title={t("tenantReadiness.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText variant="title">{t("tenantReadiness.title")}</AppText>
    <AppText tone="muted">{t("tenantReadiness.description")}</AppText>
    {readiness.isFetching && <ShimmerList variant="card" count={4} />}
    {readiness.isError && !readiness.isFetching && <ErrorState title={t("tenantReadiness.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void readiness.refetch()} />}
    {!readiness.isFetching && !readiness.isError && <>
      <ReadinessSection title={t("tenantReadiness.needsAttention")} emptyMessage={t("tenantReadiness.noAttentionNeeded")} tenants={needsAttention} onOpen={(tenantId) => router.push({ pathname: "/tenant-detail", params: { tenantId } })} t={t} />
      <ReadinessSection title={t("tenantReadiness.ready")} emptyMessage={t("tenantReadiness.noReadyTenants")} tenants={ready} onOpen={(tenantId) => router.push({ pathname: "/tenant-detail", params: { tenantId } })} t={t} />
    </>}
  </View></AppScreen>;
}

function ReadinessSection({ title, emptyMessage, tenants, onOpen, t }: { title: string; emptyMessage: string; tenants: TenantReadiness[]; onOpen: (tenantId: string) => void; t: ReturnType<typeof useI18n>["t"] }) {
  return <View style={styles.section}>
    <SectionHeader title={`${title} (${tenants.length})`} />
    {tenants.length === 0 && <EmptyState compact icon="checkmark-done-outline" title={emptyMessage} />}
    {tenants.map((tenant) => <NavigationCard key={tenant.tenantId} accessibilityLabel={t("tenantReadiness.openTenant", { name: tenant.tenantName })} onPress={() => onOpen(tenant.tenantId)} leading={<Avatar name={tenant.tenantName} />} style={tenant.status === "NEEDS_ATTENTION" ? styles.attention : undefined}>
      <View style={styles.titleRow}><AppText variant="h6" style={styles.grow}>{tenant.tenantName}</AppText><Badge tone={tenant.status === "READY" ? "success" : "danger"} label={t(tenant.status === "READY" ? "tenantReadiness.ready" : "tenantReadiness.needsAttention")} /></View>
      {tenant.issues.map((issue) => <AppText key={issue} variant="caption" tone="danger">• {t(tenantReadinessIssueKey(issue))}</AppText>)}
      {tenant.status === "READY" && <AppText variant="caption" tone="muted">{t("tenantReadiness.readyDescription")}</AppText>}
    </NavigationCard>)}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  section: { gap: spacing.sm },
  attention: { borderColor: colors.danger },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
});
