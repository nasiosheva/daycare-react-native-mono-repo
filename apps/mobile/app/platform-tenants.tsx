import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantSubscriptionStatuses, type TenantSubscriptionStatus } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantPaymentStatusKey, tenantSubscriptionFilterKey, tenantSubscriptionPlanKey, tenantSubscriptionStatusKey } from "@/i18n/translations";

export default function PlatformTenantsScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: () => api.tenants(), enabled: Boolean(profile?.isPlatformAdmin) });
  const markPaymentPaid = useMutation({ mutationFn: ({ organizationId, paymentId }: { organizationId: string; paymentId: string }) => api.markTenantPaymentPaid(organizationId, paymentId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }) });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantSubscriptionStatus | null>(null);
  const visibleTenants = useMemo(() => tenants.data?.filter((tenant) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [tenant.name, tenant.staffAdmin?.email, tenant.staffAdmin?.displayName, ...tenant.institutionTypes].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
    return matchesSearch && (!status || tenant.subscriptionStatus === status);
  }) ?? [], [search, status, tenants.data]);
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  return <AppScreen><AppText variant="title">{t("tenant.title")}</AppText>
    <AppText variant="heading">{t("tenant.list")}</AppText>
    <TextInput style={styles.input} placeholder={t("tenant.search")} value={search} onChangeText={setSearch} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      <StatusTab label={t("tenant.filterAll")} selected={!status} onPress={() => setStatus(null)} />
      {tenantSubscriptionStatuses.map((item) => <StatusTab key={item} label={t(tenantSubscriptionFilterKey(item))} selected={status === item} onPress={() => setStatus(item)} />)}
    </ScrollView>
    {tenants.isLoading && <AppText>{t("tenant.load")}</AppText>}
    {tenants.isError && <Button variant="secondary" onPress={() => tenants.refetch()}>{t("tenant.reload")}</Button>}
    {!tenants.isLoading && !tenants.isError && visibleTenants.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    {visibleTenants.map((tenant) => <View key={tenant.id} style={styles.card}>
      <AppText variant="heading">{tenant.name}</AppText>
      <AppText tone="muted">{tenant.institutionTypes.join(" + ")}</AppText>
      <AppText tone="muted">{tenant.subscriptionPlan ? t(tenantSubscriptionPlanKey(tenant.subscriptionPlan)) : t("tenant.noSubscription")} · {tenant.subscriptionStatus ? t(tenantSubscriptionStatusKey(tenant.subscriptionStatus)) : t("tenant.noStatus")}</AppText>
      {tenant.staffAdmin && <AppText variant="caption" tone="muted">{t("tenant.staffAdmin")} · {tenant.staffAdmin.email ?? tenant.staffAdmin.displayName ?? t("common.noData")}</AppText>}
      {tenant.trialEndsAt && <AppText variant="caption" tone="muted">{t("tenant.trialUntil", { date: formatDate(tenant.trialEndsAt) })}</AppText>}
      {tenant.payments.map((payment) => <View key={payment.id} style={styles.payment}>
        <AppText>{formatCurrency(payment.amount)} · {t(tenantPaymentStatusKey(payment.status))}</AppText>
        <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(payment.dueDate) })}</AppText>
        {payment.status === "PENDING" && <Button loading={markPaymentPaid.isPending} onPress={() => void markPaymentPaid.mutateAsync({ organizationId: tenant.id, paymentId: payment.id })}>{t("tenant.markPaid")}</Button>}
      </View>)}
      <Button variant="secondary" onPress={() => router.push({ pathname: "/tenant-detail", params: { tenantId: tenant.id } })}>{t("tenant.openDetails")}</Button>
    </View>)}
  </AppScreen>;
}

function StatusTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  payment: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
