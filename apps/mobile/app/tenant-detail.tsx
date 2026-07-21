import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { institutionTypes, tenantSubscriptionPlans, type InstitutionType, type TenantSubscriptionPlan } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { institutionTypeKey, tenantPaymentStatusKey, tenantSubscriptionPlanKey, tenantSubscriptionStatusKey } from "@/i18n/translations";

type Sheet = "edit" | "renew" | null;

export default function TenantDetailScreen() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { api, profile } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const tenant = useQuery({ queryKey: ["platform-tenant", tenantId], queryFn: () => api.tenant(tenantId), enabled: Boolean(profile?.isPlatformAdmin && tenantId) });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["platform-tenant", tenantId] }), queryClient.invalidateQueries({ queryKey: ["platform-tenants"] })]);
  const update = useMutation({ mutationFn: (input: Parameters<typeof api.updateTenant>[1]) => api.updateTenant(tenantId, input), onSuccess: refresh });
  const renew = useMutation({ mutationFn: (monthlyFee?: number) => api.renewTenantSubscription(tenantId, monthlyFee), onSuccess: refresh });
  const changeStatus = useMutation({ mutationFn: (status: "ACTIVE" | "SUSPENDED") => api.setTenantSubscriptionStatus(tenantId, status), onSuccess: refresh });
  const markPaid = useMutation({ mutationFn: (paymentId: string) => api.markTenantPaymentPaid(tenantId, paymentId), onSuccess: refresh });
  const voidPayment = useMutation({ mutationFn: (paymentId: string) => api.voidTenantPayment(tenantId, paymentId), onSuccess: refresh });
  const refreshInvitation = useMutation({ mutationFn: () => api.refreshTenantStaffAdminInvitation(tenantId), onSuccess: refresh });
  const cancelInvitation = useMutation({ mutationFn: () => api.cancelTenantStaffAdminInvitation(tenantId), onSuccess: refresh });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState("");
  const [types, setTypes] = useState<InstitutionType[]>([]);
  const [plan, setPlan] = useState<TenantSubscriptionPlan>("STARTER");
  const [monthlyFee, setMonthlyFee] = useState("");

  useEffect(() => {
    if (!tenant.data) return;
    setName(tenant.data.name);
    setTypes(tenant.data.institutionTypes);
    setPlan(tenant.data.subscriptionPlan ?? "STARTER");
    setMonthlyFee(tenant.data.monthlyFee?.toString() ?? "");
  }, [tenant.data]);
  if (!profile?.isPlatformAdmin) return <Redirect href="/home" />;

  const save = async () => {
    const fee = monthlyFee.trim() ? Number(monthlyFee) : undefined;
    if (!name.trim() || !types.length || !Number.isFinite(fee ?? 1) || (fee !== undefined && fee <= 0)) return Alert.alert(t("tenant.dataRequired"));
    try {
      await update.mutateAsync({ tenantName: name.trim(), institutionTypes: types, subscriptionPlan: plan, monthlyFee: fee });
      setSheet(null);
      Alert.alert(t("tenant.saved"));
    } catch (error) { Alert.alert(t("tenant.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const submitRenewal = async () => {
    const fee = Number(monthlyFee);
    if (!Number.isFinite(fee) || fee <= 0) return Alert.alert(t("tenant.feeRequired"));
    try {
      await renew.mutateAsync(fee);
      setSheet(null);
      Alert.alert(t("tenant.renewed"));
    } catch (error) { Alert.alert(t("tenant.renewFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const updateStatus = async (status: "ACTIVE" | "SUSPENDED") => {
    try {
      await changeStatus.mutateAsync(status);
      Alert.alert(status === "ACTIVE" ? t("tenant.activated") : t("tenant.suspended"));
    } catch (error) { Alert.alert(t("tenant.subscriptionFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const pay = async (paymentId: string) => { try { await markPaid.mutateAsync(paymentId); } catch (error) { Alert.alert(t("tenant.checkoutFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const voidInvoice = async (paymentId: string) => { try { await voidPayment.mutateAsync(paymentId); Alert.alert(t("tenant.paymentVoided")); } catch (error) { Alert.alert(t("tenant.paymentVoidFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const updateInvitation = async (action: "refresh" | "cancel") => {
    try {
      if (action === "refresh") await refreshInvitation.mutateAsync(); else await cancelInvitation.mutateAsync();
      Alert.alert(action === "refresh" ? t("tenant.invitationRefreshed") : t("tenant.invitationCancelled"));
    } catch (error) { Alert.alert(t("tenant.invitationFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen showBottomNavigation={false} title={t("tenant.detailTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {tenant.isLoading && <AppText>{t("tenant.load")}</AppText>}
    {tenant.isError && <Button variant="secondary" onPress={() => tenant.refetch()}>{t("common.retry")}</Button>}
    {tenant.data && <View style={styles.content}>
      <View style={styles.card}>
        <AppText variant="title">{tenant.data.name}</AppText>
        <AppText tone="muted">{tenant.data.branchName ?? t("common.noData")}</AppText>
        <AppText>{tenant.data.institutionTypes.map((type) => t(institutionTypeKey(type))).join(" + ")}</AppText>
        <Button variant="secondary" onPress={() => setSheet("edit")}>{t("tenant.edit")}</Button>
      </View>
      <View style={styles.card}>
        <AppText variant="heading">{t("tenant.branches")}</AppText>
        {tenant.data.branches.map((branch) => <View key={branch.id} style={styles.branch}>
          <View style={styles.branchContent}><AppText variant="label">{branch.name}{branch.primary ? ` · ${t("tenant.primaryBranch")}` : ""}</AppText><AppText tone="muted">{branch.timezone}{branch.active ? "" : ` · ${t("tenant.archivedBranch")}`}</AppText></View>
        </View>)}
      </View>
      <View style={styles.card}>
        <AppText variant="heading">{t("tenant.staffAdmin")}</AppText>
        <AppText>{tenant.data.staffAdmin?.displayName ?? tenant.data.staffAdmin?.email ?? t("common.noData")}</AppText>
        <AppText tone="muted">{tenant.data.staffAdmin?.status === "ACTIVE" ? t("tenant.staffAdminActive") : t("tenant.staffAdminPending")}</AppText>
        {tenant.data.staffAdmin?.status === "PENDING" && <View style={styles.actions}><Button variant="secondary" loading={refreshInvitation.isPending} onPress={() => void updateInvitation("refresh")}>{t("tenant.refreshInvitation")}</Button><Button variant="danger" loading={cancelInvitation.isPending} onPress={() => void updateInvitation("cancel")}>{t("tenant.cancelInvitation")}</Button></View>}
      </View>
      <View style={styles.card}>
        <AppText variant="heading">{t("tenant.planTrial")}</AppText>
        <AppText>{tenant.data.subscriptionPlan ? t(tenantSubscriptionPlanKey(tenant.data.subscriptionPlan)) : t("tenant.noSubscription")} · {tenant.data.subscriptionStatus ? t(tenantSubscriptionStatusKey(tenant.data.subscriptionStatus)) : t("tenant.noStatus")}</AppText>
        {tenant.data.periodStart && tenant.data.periodEnd && <AppText tone="muted">{t("tenant.subscriptionPeriod", { start: formatDate(tenant.data.periodStart), end: formatDate(tenant.data.periodEnd) })}</AppText>}
        {tenant.data.trialEndsAt && <AppText tone="muted">{t("tenant.trialUntil", { date: formatDate(tenant.data.trialEndsAt) })}</AppText>}
        {tenant.data.monthlyFee && <AppText>{t("tenant.currentMonthlyFee")} · {formatCurrency(tenant.data.monthlyFee)}</AppText>}
        <View style={styles.actions}>
          <Button variant="secondary" onPress={() => setSheet("renew")}>{t("tenant.renewal")}</Button>
          {tenant.data.subscriptionStatus === "SUSPENDED" ? <Button loading={changeStatus.isPending} onPress={() => void updateStatus("ACTIVE")}>{t("tenant.activate")}</Button> : <Button variant="danger" loading={changeStatus.isPending} onPress={() => void updateStatus("SUSPENDED")}>{t("tenant.suspend")}</Button>}
        </View>
      </View>
      <AppText variant="heading">{t("billing.pendingInvoices")}</AppText>
      {tenant.data.payments.length === 0 && <AppText tone="muted">{t("tenant.noPayments")}</AppText>}
      {tenant.data.payments.map((payment) => <View key={payment.id} style={styles.card}>
        <AppText>{formatCurrency(payment.amount)} · {t(tenantPaymentStatusKey(payment.status))}</AppText>
        <AppText tone="muted">{t("tenant.dueDate", { date: formatDate(payment.dueDate) })}</AppText>
        {payment.status === "PENDING" && <View style={styles.actions}><Button loading={markPaid.isPending} onPress={() => void pay(payment.id)}>{t("tenant.markPaid")}</Button><Button variant="danger" loading={voidPayment.isPending} onPress={() => void voidInvoice(payment.id)}>{t("tenant.voidPayment")}</Button></View>}
      </View>)}
    </View>}
    <BottomSheet visible={sheet === "edit"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenant.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("common.save"), loading: update.isPending, onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("tenant.name")} value={name} onChangeText={setName} />
      <View style={styles.actions}>{institutionTypes.map((type) => <Button key={type} variant={types.includes(type) ? "primary" : "secondary"} onPress={() => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])}>{t(institutionTypeKey(type))}</Button>)}</View>
      <View style={styles.actions}>{tenantSubscriptionPlans.map((item) => <Button key={item} variant={plan === item ? "primary" : "secondary"} onPress={() => setPlan(item)}>{t(tenantSubscriptionPlanKey(item))}</Button>)}</View>
      <TextInput style={styles.input} keyboardType="numeric" placeholder={t("tenant.monthlyFee")} value={monthlyFee} onChangeText={setMonthlyFee} />
    </BottomSheet>
    <BottomSheet visible={sheet === "renew"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenant.renewal")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenant.renew"), loading: renew.isPending, onPress: () => void submitRenewal() }}>
      <TextInput style={styles.input} keyboardType="numeric" placeholder={t("tenant.monthlyFee")} value={monthlyFee} onChangeText={setMonthlyFee} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  branch: { gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  branchContent: { gap: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
