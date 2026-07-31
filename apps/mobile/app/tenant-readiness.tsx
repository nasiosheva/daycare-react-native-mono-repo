import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { TenantReadiness } from "@daycare/api-client";
import { AppText, BackButton, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
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
    {readiness.isError && <View style={styles.error}><AppText tone="danger">{t("tenantReadiness.loadFailed")}</AppText><Button variant="secondary" onPress={() => void readiness.refetch()}>{t("common.retry")}</Button></View>}
    {!readiness.isFetching && !readiness.isError && <>
      <ReadinessSection title={t("tenantReadiness.needsAttention")} emptyMessage={t("tenantReadiness.noAttentionNeeded")} tenants={needsAttention} onOpen={(tenantId) => router.push({ pathname: "/tenant-detail", params: { tenantId } })} t={t} />
      <ReadinessSection title={t("tenantReadiness.ready")} emptyMessage={t("tenantReadiness.noReadyTenants")} tenants={ready} onOpen={(tenantId) => router.push({ pathname: "/tenant-detail", params: { tenantId } })} t={t} />
    </>}
  </View></AppScreen>;
}

function ReadinessSection({ title, emptyMessage, tenants, onOpen, t }: { title: string; emptyMessage: string; tenants: TenantReadiness[]; onOpen: (tenantId: string) => void; t: ReturnType<typeof useI18n>["t"] }) {
  return <View style={styles.section}>
    <AppText variant="heading">{title}</AppText>
    {tenants.length === 0 && <AppText tone="muted">{emptyMessage}</AppText>}
    {tenants.map((tenant) => <NavigationCard key={tenant.tenantId} accessibilityLabel={t("tenantReadiness.openTenant", { name: tenant.tenantName })} onPress={() => onOpen(tenant.tenantId)}>
      <AppText variant="h5">{tenant.tenantName}</AppText>
      {tenant.issues.map((issue) => <AppText key={issue} variant="caption" tone="danger">• {t(tenantReadinessIssueKey(issue))}</AppText>)}
      {tenant.status === "READY" && <AppText variant="caption" tone="muted">{t("tenantReadiness.readyDescription")}</AppText>}
    </NavigationCard>)}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  section: { gap: spacing.sm },
  error: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
});
