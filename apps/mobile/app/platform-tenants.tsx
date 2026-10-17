import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, Avatar, Badge, Button, EmptyState, ErrorState, FloatingActionButton, SearchField, ShimmerList, TabBar, colors, radius, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantSubscriptionStatuses, type TenantSubscriptionStatus } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantPaymentStatusKey, tenantSubscriptionFilterKey, tenantSubscriptionPlanKey, tenantSubscriptionStatusKey } from "@/i18n/translations";
import { createIdempotencyKey } from "@/idempotency/createIdempotencyKey";

export default function PlatformTenantsScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<TenantSubscriptionStatus | null>(null);
  const [institutionType, setInstitutionType] = useState<string | null>(null);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const tenants = useQuery({ queryKey: ["platform-tenants", "page", debouncedSearch, status, institutionType, page], queryFn: () => api.tenantPage({ search: debouncedSearch, status, institutionType, page }), enabled: Boolean(profile?.isPlatformAdmin) });
  const institutionTypes = useQuery({ queryKey: ["platform-institution-types"], queryFn: () => api.institutionTypes(), enabled: Boolean(profile?.isPlatformAdmin) });
  const markPaymentPaid = useMutation({ mutationFn: ({ organizationId, paymentId }: { organizationId: string; paymentId: string }) => api.markTenantPaymentPaid(organizationId, paymentId, createIdempotencyKey()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }) });
  useEffect(() => setPage(0), [debouncedSearch, status, institutionType]);
  const institutionTypeNames = useMemo(() => new Map(institutionTypes.data?.map((type) => [type.code, type.name])), [institutionTypes.data]);
  const visibleTenants = tenants.data?.items ?? [];
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  return <AppScreen floatingAction={<View style={styles.floatingActions}>
    <FloatingActionButton icon="add" accessibilityLabel={t("tenant.addTitle")} onPress={() => router.push("/add-tenant")}>{t("tenant.addTitle")}</FloatingActionButton>
    <FloatingActionButton icon="add" accessibilityLabel={t("institutionCatalog.add")} onPress={() => router.push("/institution-types")}>{t("institutionCatalog.add")}</FloatingActionButton>
  </View>}><AppText variant="title">{t("tenant.title")}</AppText>
    <AppText variant="heading">{t("tenant.list")}</AppText>
    <Button variant="secondary" onPress={() => router.push("/tenant-subscription-review" as never)}>{t("tenantSubscriptionReview.title")}</Button>
    <Button variant="secondary" onPress={() => router.push("/tenant-grace-rollout" as never)}>{t("tenant.graceRolloutTitle")}</Button>
    <SearchField accessibilityLabel={t("tenant.search")} placeholder={t("tenant.search")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
    <AppText variant="label">{t("tenant.filterStatus")}</AppText>
    <TabBar accessibilityLabel={t("tenant.filterAll")} selected={status ?? ""} onSelect={(key) => setStatus(key ? key as NonNullable<typeof status> : null)} items={[{ key: "", label: `${t("tenant.filterAll")} (${tenants.data?.totalMatching ?? 0})` }, ...tenantSubscriptionStatuses.map((item) => ({ key: item, label: `${t(tenantSubscriptionFilterKey(item))} (${tenants.data?.statusCounts[item] ?? 0})` }))]} />
    <AppText variant="label">{t("tenant.institutionTypes")}</AppText>
    <TabBar accessibilityLabel={t("tenant.filterAll")} selected={institutionType ?? ""} onSelect={(key) => setInstitutionType(key || null)} items={[{ key: "", label: t("tenant.filterAll") }, ...(institutionTypes.data?.map((item) => ({ key: item.code, label: item.name })) ?? [])]} />
    {tenants.isFetching && <ShimmerList />}
    {tenants.isError && !tenants.isFetching && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("tenant.reload")} onRetry={() => tenants.refetch()} />}
    {!tenants.isFetching && !tenants.isError && visibleTenants.length === 0 && <EmptyState compact title={t("common.noData")} />}
    {!tenants.isFetching && visibleTenants.map((tenant) => <View key={tenant.id} style={styles.card}>
      <View style={styles.tenantHeader}>
        <Avatar name={tenant.name} />
        <View style={styles.grow}>
          <AppText variant="h6">{tenant.name}</AppText>
          <AppText variant="bodySmall" tone="muted">{tenant.institutionTypes.map((type) => institutionTypeNames.get(type) ?? type).join(" + ")}</AppText>
        </View>
        <Badge tone={tenant.subscriptionStatus ? statusTone(tenant.subscriptionStatus) : "neutral"} label={tenant.subscriptionStatus ? t(tenantSubscriptionStatusKey(tenant.subscriptionStatus)) : t("tenant.noStatus")} />
      </View>
      <AppText variant="label">{tenant.subscriptionPlan ? t(tenantSubscriptionPlanKey(tenant.subscriptionPlan)) : t("tenant.noSubscription")}</AppText>
      {tenant.staffAdmin && <AppText variant="caption" tone="muted">{t("tenant.staffAdmin")} · {tenant.staffAdmin.email ?? tenant.staffAdmin.displayName ?? t("common.noData")}</AppText>}
      {tenant.trialEndsAt && <AppText variant="caption" tone="muted">{t("tenant.trialUntil", { date: formatDate(tenant.trialEndsAt) })}</AppText>}
      <AppText variant="caption" tone="muted">{t("tenant.gracePeriod")}: {tenant.gracePeriodDays} {t("tenant.gracePeriodDays")}{tenant.graceEndsAt ? ` · ${t("tenant.graceEndsAt", { date: formatDate(tenant.graceEndsAt) })}` : ""}</AppText>
      {tenant.payments.map((payment) => <View key={payment.id} style={styles.payment}>
        <View style={styles.paymentRow}><AppText variant="label" style={styles.grow}>{payment.invoiceNumber} · {formatCurrency(payment.amount)}</AppText><Badge tone={statusTone(payment.status)} label={t(tenantPaymentStatusKey(payment.status))} /></View>
        <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(payment.dueDate) })}</AppText>
        {payment.status === "PENDING" && <Button loading={markPaymentPaid.isPending} onPress={() => void markPaymentPaid.mutateAsync({ organizationId: tenant.id, paymentId: payment.id })}>{t("tenant.markPaid")}</Button>}
      </View>)}
      <Button variant="secondary" onPress={() => router.push({ pathname: "/tenant-detail", params: { tenantId: tenant.id } })}>{t("tenant.openDetails")}</Button>
    </View>)}
    {!tenants.isFetching && (tenants.data?.totalPages ?? 0) > 1 && <View style={styles.pagination}>
      <Button variant="secondary" disabled={page <= 0} onPress={() => setPage((value) => Math.max(0, value - 1))}>{t("tenant.pagePrevious")}</Button>
      <AppText variant="caption" tone="muted">{t("tenant.pageSummary", { page: page + 1, pages: tenants.data?.totalPages ?? 1, total: tenants.data?.totalElements ?? 0 })}</AppText>
      <Button variant="secondary" disabled={page + 1 >= (tenants.data?.totalPages ?? 0)} onPress={() => setPage((value) => value + 1)}>{t("tenant.pageNext")}</Button>
    </View>}
  </AppScreen>;
}


const styles = StyleSheet.create({
  tenantHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1, gap: 2 },
  floatingActions: { alignItems: "flex-end", gap: spacing.sm },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  payment: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
