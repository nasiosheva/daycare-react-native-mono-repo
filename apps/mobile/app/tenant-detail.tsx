import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, PasswordInput, radius, spacing } from "@daycare/ui";
import { tenantSubscriptionPlans, type TenantSubscriptionPlan } from "@daycare/core";
import type { TenantStaffAdmin } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantPaymentStatusKey, tenantSubscriptionPlanKey, tenantSubscriptionStatusKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";

type Sheet = "edit" | "renew" | "staffAdmin" | "editStaffAdmin" | "removeStaffAdmin" | null;

export default function TenantDetailScreen() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { api, profile } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const tenant = useQuery({ queryKey: ["platform-tenant", tenantId], queryFn: () => api.tenant(tenantId), enabled: Boolean(profile?.isPlatformAdmin && tenantId) });
  const institutionTypes = useQuery({ queryKey: ["platform-institution-types"], queryFn: () => api.institutionTypes(), enabled: Boolean(profile?.isPlatformAdmin) });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["platform-tenant", tenantId] }), queryClient.invalidateQueries({ queryKey: ["platform-tenants"] })]);
  const update = useMutation({ mutationFn: (input: Parameters<typeof api.updateTenant>[1]) => api.updateTenant(tenantId, input), onSuccess: refresh });
  const renew = useMutation({ mutationFn: (monthlyFee?: number) => api.renewTenantSubscription(tenantId, monthlyFee), onSuccess: refresh });
  const changeStatus = useMutation({ mutationFn: (status: "ACTIVE" | "SUSPENDED") => api.setTenantSubscriptionStatus(tenantId, status), onSuccess: refresh });
  const createStaffAdmin = useMutation({ mutationFn: (input: { displayName: string; email: string; password: string }) => api.createTenantStaffAdmin(tenantId, input), onSuccess: refresh });
  const updateStaffAdmin = useMutation({ mutationFn: ({ membershipId, displayName }: { membershipId: string; displayName: string }) => api.updateTenantStaffAdmin(tenantId, membershipId, { displayName }), onSuccess: refresh });
  const removeStaffAdmin = useMutation({ mutationFn: (membershipId: string) => api.removeTenantStaffAdmin(tenantId, membershipId), onSuccess: refresh });
  const markPaid = useMutation({ mutationFn: (paymentId: string) => api.markTenantPaymentPaid(tenantId, paymentId), onSuccess: refresh });
  const voidPayment = useMutation({ mutationFn: (paymentId: string) => api.voidTenantPayment(tenantId, paymentId), onSuccess: refresh });
  const refreshInvitation = useMutation({ mutationFn: () => api.refreshTenantStaffAdminInvitation(tenantId), onSuccess: refresh });
  const cancelInvitation = useMutation({ mutationFn: () => api.cancelTenantStaffAdminInvitation(tenantId), onSuccess: refresh });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [plan, setPlan] = useState<TenantSubscriptionPlan>("STARTER");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [staffAdminName, setStaffAdminName] = useState("");
  const [staffAdminEmail, setStaffAdminEmail] = useState("");
  const [staffAdminPassword, setStaffAdminPassword] = useState("");
  const [staffAdminToRemove, setStaffAdminToRemove] = useState<TenantStaffAdmin | null>(null);
  const [editingStaffAdmin, setEditingStaffAdmin] = useState<TenantStaffAdmin | null>(null);
  const [editStaffAdminName, setEditStaffAdminName] = useState("");

  useEffect(() => {
    if (!tenant.data) return;
    setName(tenant.data.name);
    setTypes(tenant.data.institutionTypes);
    setPlan(tenant.data.subscriptionPlan ?? "STARTER");
    setMonthlyFee(tenant.data.monthlyFee?.toString() ?? "");
  }, [tenant.data]);
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;
  const staffAdmins = tenant.data?.staffAdmins ?? (tenant.data?.staffAdmin ? [{ ...tenant.data.staffAdmin, primary: true }] : []);

  const save = async () => {
    const fee = monthlyFee.trim() ? Number(monthlyFee) : undefined;
    if (!name.trim() || !types.length || !Number.isFinite(fee ?? 1) || (fee !== undefined && fee <= 0)) return notify(t("tenant.dataRequired"));
    try {
      await update.mutateAsync({ tenantName: name.trim(), institutionTypes: types, subscriptionPlan: plan, monthlyFee: fee });
      setSheet(null);
      notify(t("tenant.saved"));
    } catch (error) { notify(t("tenant.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const submitRenewal = async () => {
    const fee = Number(monthlyFee);
    if (!Number.isFinite(fee) || fee <= 0) return notify(t("tenant.feeRequired"));
    try {
      await renew.mutateAsync(fee);
      setSheet(null);
      notify(t("tenant.renewed"));
    } catch (error) { notify(t("tenant.renewFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const updateStatus = async (status: "ACTIVE" | "SUSPENDED") => {
    try {
      await changeStatus.mutateAsync(status);
      notify(status === "ACTIVE" ? t("tenant.activated") : t("tenant.suspended"));
    } catch (error) { notify(t("tenant.subscriptionFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const pay = async (paymentId: string) => { try { await markPaid.mutateAsync(paymentId); } catch (error) { notify(t("tenant.checkoutFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const voidInvoice = async (paymentId: string) => { try { await voidPayment.mutateAsync(paymentId); notify(t("tenant.paymentVoided")); } catch (error) { notify(t("tenant.paymentVoidFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const updateInvitation = async (action: "refresh" | "cancel") => {
    try {
      if (action === "refresh") await refreshInvitation.mutateAsync(); else await cancelInvitation.mutateAsync();
      notify(action === "refresh" ? t("tenant.invitationRefreshed") : t("tenant.invitationCancelled"));
    } catch (error) { notify(t("tenant.invitationFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const closeStaffAdminSheet = () => {
    setStaffAdminName("");
    setStaffAdminEmail("");
    setStaffAdminPassword("");
    setSheet(null);
  };
  const submitStaffAdmin = async () => {
    if (!staffAdminName.trim() || !staffAdminEmail.trim() || staffAdminPassword.length < 6) return notify(t("tenant.staffAdminRequired"));
    try {
      await createStaffAdmin.mutateAsync({ displayName: staffAdminName.trim(), email: staffAdminEmail.trim(), password: staffAdminPassword });
      closeStaffAdminSheet();
      notify(t("tenant.staffAdminCreated"));
    } catch (error) { notify(t("tenant.staffAdminCreateFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const openEditStaffAdmin = (staffAdmin: TenantStaffAdmin) => { setEditingStaffAdmin(staffAdmin); setEditStaffAdminName(staffAdmin.displayName ?? ""); setSheet("editStaffAdmin"); };
  const closeEditStaffAdminSheet = () => { setEditingStaffAdmin(null); setEditStaffAdminName(""); setSheet(null); };
  const submitEditStaffAdmin = async () => {
    if (!editingStaffAdmin || !editStaffAdminName.trim()) return notify(t("tenant.staffAdminRequired"));
    try {
      await updateStaffAdmin.mutateAsync({ membershipId: editingStaffAdmin.id, displayName: editStaffAdminName.trim() });
      closeEditStaffAdminSheet();
    } catch (error) { notify(t("tenant.staffAdminSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const submitRemoveStaffAdmin = async () => {
    if (!staffAdminToRemove) return;
    try {
      await removeStaffAdmin.mutateAsync(staffAdminToRemove.id);
      setStaffAdminToRemove(null);
      setSheet(null);
      notify(t("tenant.staffAdminRemoved"));
    } catch (error) { notify(t("tenant.staffAdminRemoveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen showBottomNavigation={false} title={t("tenant.detailTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {tenant.isLoading && <AppText>{t("tenant.load")}</AppText>}
    {tenant.isError && <Button variant="secondary" onPress={() => tenant.refetch()}>{t("common.retry")}</Button>}
    {tenant.data && <View style={styles.content}>
      <View style={styles.card}>
        <AppText variant="title">{tenant.data.name}</AppText>
        <AppText tone="muted">{tenant.data.branchName ?? t("common.noData")}</AppText>
        <AppText>{tenant.data.institutionTypes.map((type) => institutionTypes.data?.find((item) => item.code === type)?.name ?? type).join(" + ")}</AppText>
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
        {staffAdmins.map((staffAdmin) => <View key={staffAdmin.id} style={styles.staffAdmin}>
          <AppText variant="label">{staffAdmin.displayName ?? staffAdmin.email ?? t("common.noData")}{staffAdmin.primary ? ` · ${t("tenant.primaryStaffAdmin")}` : ""}</AppText>
          <AppText tone="muted">{t(`status.${staffAdmin.status}` as Parameters<typeof t>[0])}</AppText>
          {!staffAdmin.primary && staffAdmin.status === "ACTIVE" && <View style={styles.actions}>
            <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("tenant.editStaffAdmin")} onPress={() => openEditStaffAdmin(staffAdmin)} />
            <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("tenant.removeStaffAdmin")} disabled={removeStaffAdmin.isPending} onPress={() => { setStaffAdminToRemove(staffAdmin); setSheet("removeStaffAdmin"); }} />
          </View>}
        </View>)}
        {staffAdmins.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
        {tenant.data.staffAdmin?.status === "PENDING" && <View style={styles.actions}><Button variant="secondary" loading={refreshInvitation.isPending} onPress={() => void updateInvitation("refresh")}>{t("tenant.refreshInvitation")}</Button><Button variant="danger" loading={cancelInvitation.isPending} onPress={() => void updateInvitation("cancel")}>{t("tenant.cancelInvitation")}</Button></View>}
        <Button variant="secondary" onPress={() => setSheet("staffAdmin")}>{t("tenant.addStaffAdmin")}</Button>
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
      <AppText variant="heading">{t("tenant.paymentHistory")}</AppText>
      {tenant.data.payments.length === 0 && <AppText tone="muted">{t("tenant.noPayments")}</AppText>}
      {tenant.data.payments.map((payment) => <View key={payment.id} style={styles.card}>
        <AppText>{formatCurrency(payment.amount)} · {t(tenantPaymentStatusKey(payment.status))}</AppText>
        <AppText tone="muted">{t("tenant.dueDate", { date: formatDate(payment.dueDate) })}</AppText>
        {payment.status === "PENDING" && <View style={styles.actions}><Button loading={markPaid.isPending} onPress={() => void pay(payment.id)}>{t("tenant.markPaid")}</Button><Button variant="danger" loading={voidPayment.isPending} onPress={() => void voidInvoice(payment.id)}>{t("tenant.voidPayment")}</Button></View>}
      </View>)}
    </View>}
    <BottomSheet visible={sheet === "edit"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenant.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("common.save"), loading: update.isPending, onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("tenant.name")} value={name} onChangeText={setName} />
      <AppText variant="label">{t("tenant.institutionTypes")}</AppText>
      <View style={styles.actions}>{institutionTypes.data?.map((type) => <Button key={type.code} variant={types.includes(type.code) ? "primary" : "secondary"} onPress={() => setTypes((current) => current.includes(type.code) ? current.filter((item) => item !== type.code) : [...current, type.code])}>{type.name}</Button>)}</View>
      <View style={styles.actions}>{tenantSubscriptionPlans.map((item) => <Button key={item} variant={plan === item ? "primary" : "secondary"} onPress={() => setPlan(item)}>{t(tenantSubscriptionPlanKey(item))}</Button>)}</View>
      <TextInput style={styles.input} keyboardType="numeric" placeholder={t("tenant.monthlyFee")} value={monthlyFee} onChangeText={setMonthlyFee} />
    </BottomSheet>
    <BottomSheet visible={sheet === "renew"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenant.renewal")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenant.renew"), loading: renew.isPending, onPress: () => void submitRenewal() }}>
      <TextInput style={styles.input} keyboardType="numeric" placeholder={t("tenant.monthlyFee")} value={monthlyFee} onChangeText={setMonthlyFee} />
    </BottomSheet>
    <BottomSheet visible={sheet === "staffAdmin"} onClose={closeStaffAdminSheet} closeAccessibilityLabel={t("common.close")} title={t("tenant.addStaffAdmin")} negativeAction={{ label: t("common.cancel"), onPress: closeStaffAdminSheet }} positiveAction={{ label: t("common.save"), loading: createStaffAdmin.isPending, onPress: () => void submitStaffAdmin() }}>
      <TextInput style={styles.input} placeholder={t("tenantUsers.displayName")} value={staffAdminName} onChangeText={setStaffAdminName} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={staffAdminEmail} onChangeText={setStaffAdminEmail} />
      <PasswordInput placeholder={t("tenantUsers.password")} value={staffAdminPassword} onChangeText={setStaffAdminPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
    <BottomSheet visible={sheet === "editStaffAdmin"} onClose={closeEditStaffAdminSheet} closeAccessibilityLabel={t("common.close")} title={t("tenant.editStaffAdmin")} negativeAction={{ label: t("common.cancel"), onPress: closeEditStaffAdminSheet }} positiveAction={{ label: t("common.save"), loading: updateStaffAdmin.isPending, disabled: !editStaffAdminName.trim(), onPress: () => void submitEditStaffAdmin() }}>
      <TextInput style={styles.input} placeholder={t("tenantUsers.displayName")} value={editStaffAdminName} onChangeText={setEditStaffAdminName} />
    </BottomSheet>
    <BottomSheet visible={sheet === "removeStaffAdmin"} onClose={() => { setStaffAdminToRemove(null); setSheet(null); }} closeAccessibilityLabel={t("common.close")} title={t("tenant.removeStaffAdmin")} negativeAction={{ label: t("common.cancel"), onPress: () => { setStaffAdminToRemove(null); setSheet(null); } }} positiveAction={{ label: t("tenant.removeStaffAdmin"), variant: "danger", loading: removeStaffAdmin.isPending, onPress: () => void submitRemoveStaffAdmin() }}>
      <AppText tone="muted">{t("tenant.removeStaffAdminConfirm", { name: staffAdminToRemove?.displayName ?? staffAdminToRemove?.email ?? t("common.noData") })}</AppText>
    </BottomSheet>
  </AppScreen>;
}

function IconButton({ icon, tone = "secondary", onPress, accessibilityLabel, disabled }: { icon: keyof typeof Ionicons.glyphMap; tone?: "secondary" | "danger"; onPress: () => void; accessibilityLabel: string; disabled?: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, tone === "danger" && styles.iconButtonDanger, pressed && !disabled && styles.iconButtonPressed, disabled && styles.iconButtonDisabled]}
  >
    <Ionicons name={icon} size={18} color={tone === "danger" ? colors.danger : colors.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  branch: { gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  branchContent: { gap: spacing.xs },
  staffAdmin: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
