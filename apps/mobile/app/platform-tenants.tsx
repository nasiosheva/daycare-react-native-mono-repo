import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BottomSheet, Button, NavigationCard, colors, FloatingActionButton, radius, spacing } from "@daycare/ui";
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const tenants = useQuery({ queryKey: ["platform-tenants", debouncedSearch], queryFn: () => api.tenants(debouncedSearch || undefined), enabled: Boolean(profile?.isPlatformAdmin) });
  const institutionTypes = useQuery({ queryKey: ["platform-institution-types"], queryFn: () => api.institutionTypes(), enabled: Boolean(profile?.isPlatformAdmin) });
  const markPaymentPaid = useMutation({ mutationFn: ({ organizationId, paymentId }: { organizationId: string; paymentId: string }) => api.markTenantPaymentPaid(organizationId, paymentId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }) });
  const [status, setStatus] = useState<TenantSubscriptionStatus | null>(null);
  const [institutionType, setInstitutionType] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const institutionTypeNames = useMemo(() => new Map(institutionTypes.data?.map((type) => [type.code, type.name])), [institutionTypes.data]);
  const visibleTenants = useMemo(() => tenants.data?.filter((tenant) =>
    (!status || tenant.subscriptionStatus === status) && (!institutionType || tenant.institutionTypes.includes(institutionType))
  ) ?? [], [status, institutionType, tenants.data]);
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  return <AppScreen floatingAction={<View style={styles.floatingActions}>
    <FloatingActionButton accessibilityLabel={t("tenant.addTitle")} onPress={() => router.push("/add-tenant")}>+ {t("tenant.addTitle")}</FloatingActionButton>
    <FloatingActionButton accessibilityLabel={t("institutionCatalog.add")} onPress={() => router.push("/institution-types")}>+ {t("institutionCatalog.add")}</FloatingActionButton>
  </View>}><AppText variant="title">{t("tenant.title")}</AppText>
    <AppText variant="heading">{t("tenant.list")}</AppText>
    <TextInput style={styles.input} placeholder={t("tenant.search")} value={search} onChangeText={setSearch} />
    <AppText variant="label">{t("tenant.filterStatus")}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <StatusTab label={t("tenant.filterAll")} selected={!status} onPress={() => setStatus(null)} />
      {tenantSubscriptionStatuses.map((item) => <StatusTab key={item} label={t(tenantSubscriptionFilterKey(item))} selected={status === item} onPress={() => setStatus(item)} />)}
    </ScrollView>
    <AppText variant="label">{t("tenant.institutionTypes")}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <StatusTab label={t("tenant.filterAll")} selected={!institutionType} onPress={() => setInstitutionType(null)} />
      {institutionTypes.data?.map((item) => <StatusTab key={item.code} label={item.name} selected={institutionType === item.code} onPress={() => setInstitutionType(item.code)} />)}
    </ScrollView>
    <NavigationCard accessibilityLabel={t("tenant.list")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("tenant.list")}</AppText>
      <AppText tone={visibleTenants.length ? "default" : "muted"}>{tenants.isLoading ? t("tenant.load") : visibleTenants.length ? t("tenant.tenantsSummary", { count: visibleTenants.length }) : t("common.noData")}</AppText>
    </NavigationCard>

    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("tenant.list")}>
      {tenants.isLoading && <AppText>{t("tenant.load")}</AppText>}
      {tenants.isError && <Button variant="secondary" onPress={() => tenants.refetch()}>{t("tenant.reload")}</Button>}
      {!tenants.isLoading && !tenants.isError && visibleTenants.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
      {visibleTenants.map((tenant) => <View key={tenant.id} style={styles.card}>
        <AppText variant="heading">{tenant.name}</AppText>
        <AppText tone="muted">{tenant.institutionTypes.map((type) => institutionTypeNames.get(type) ?? type).join(" + ")}</AppText>
        <AppText tone="muted">{tenant.subscriptionPlan ? t(tenantSubscriptionPlanKey(tenant.subscriptionPlan)) : t("tenant.noSubscription")} · {tenant.subscriptionStatus ? t(tenantSubscriptionStatusKey(tenant.subscriptionStatus)) : t("tenant.noStatus")}</AppText>
        {tenant.staffAdmin && <AppText variant="caption" tone="muted">{t("tenant.staffAdmin")} · {tenant.staffAdmin.email ?? tenant.staffAdmin.displayName ?? t("common.noData")}</AppText>}
        {tenant.trialEndsAt && <AppText variant="caption" tone="muted">{t("tenant.trialUntil", { date: formatDate(tenant.trialEndsAt) })}</AppText>}
        {tenant.payments.map((payment) => <View key={payment.id} style={styles.payment}>
          <AppText>{formatCurrency(payment.amount)} · {t(tenantPaymentStatusKey(payment.status))}</AppText>
          <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(payment.dueDate) })}</AppText>
          {payment.status === "PENDING" && <Button loading={markPaymentPaid.isPending} onPress={() => void markPaymentPaid.mutateAsync({ organizationId: tenant.id, paymentId: payment.id })}>{t("tenant.markPaid")}</Button>}
        </View>)}
        <Button variant="secondary" onPress={() => { setListOpen(false); router.push({ pathname: "/tenant-detail", params: { tenantId: tenant.id } }); }}>{t("tenant.openDetails")}</Button>
      </View>)}
    </BottomSheet>
  </AppScreen>;
}

function StatusTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  floatingActions: { alignItems: "flex-end", gap: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  payment: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
