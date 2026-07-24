import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useInvoices, useMarkInvoicePaid, useServicePlans } from "@/booking/useBooking";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { BranchFilterControl } from "@/branches/BranchFilterSheet";

export default function BillingAdminScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active === true;
  const queryClient = useQueryClient();
  const plans = useServicePlans();
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const invoices = useInvoices({ branchId: filterBranchId });
  const markPaid = useMarkInvoicePaid();
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const capacities = useQuery({ queryKey: ["branch-capacities", organizationId], queryFn: () => api.branchCapacities(), enabled: membership?.role === "STAFF_ADMIN" });
  const templates = useQuery({ queryKey: ["service-plan-templates", organizationId], queryFn: () => api.servicePlanTemplates(), enabled: membership?.role === "STAFF_ADMIN" });
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [capacityBranchId, setCapacityBranchId] = useState<string>();
  const [capacity, setCapacity] = useState("");
  const discounts = useQuery({ queryKey: ["service-plan-discounts", organizationId, selectedPlanId], queryFn: () => api.servicePlanDiscounts(selectedPlanId!), enabled: membership?.role === "STAFF_ADMIN" && Boolean(selectedPlanId) });
  const refreshCapacities = () => { void queryClient.invalidateQueries({ queryKey: ["branch-capacities", organizationId] }); };
  const refreshTemplates = () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-templates", organizationId] }); };
  const refreshDiscounts = () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-discounts", organizationId, selectedPlanId] }); };
  const setBranchCapacity = useMutation({ mutationFn: ({ branchId, dailyCapacity }: { branchId: string; dailyCapacity: number }) => api.setBranchCapacity(branchId, dailyCapacity), onSuccess: refreshCapacities });
  const deleteTemplate = useMutation({ mutationFn: api.deleteServicePlanTemplate.bind(api), onSuccess: refreshTemplates });
  const deactivateDiscount = useMutation({ mutationFn: ({ planId, discountId }: { planId: string; discountId: string }) => api.deactivateServicePlanDiscount(planId, discountId), onSuccess: refreshDiscounts });

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const openCapacity = (branchId: string, current?: number | null) => { setCapacityBranchId(branchId); setCapacity(current?.toString() ?? ""); };
  const saveCapacity = async () => {
    const dailyCapacity = Number(capacity);
    if (!capacityBranchId || !Number.isInteger(dailyCapacity) || dailyCapacity < 1) return Alert.alert(t("billing.invalidCapacity"));
    try { await setBranchCapacity.mutateAsync({ branchId: capacityBranchId, dailyCapacity }); setCapacityBranchId(undefined); } catch (error) { Alert.alert(t("billing.capacityFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("billing.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {!canManage && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <BranchFilterControl branchId={filterBranchId} onChange={setFilterBranchId} />
    {canManage && <Button onPress={() => router.push("/billing-plan-editor")}>{t("billing.createPlan")}</Button>}
    <AppText variant="heading">{t("billing.activePlans")}</AppText>
    {plans.data?.map((plan) => <View key={plan.id} style={styles.card}><AppText variant="label">{plan.name}</AppText><AppText>{t(servicePlanTypeKey(plan.type))} · {formatCurrency(plan.price)}</AppText></View>)}
    <AppText variant="heading">{t("billing.templates")}</AppText><AppText tone="muted">{t("billing.templatesDescription")}</AppText>
    {templates.data?.map((template) => <View key={template.id} style={styles.card}><AppText variant="label">{template.name}</AppText><AppText tone="muted">{t(servicePlanTypeKey(template.type))}{template.suggestedPrice ? ` · ${formatCurrency(template.suggestedPrice)}` : ""}</AppText>{canManage && <View style={styles.row}><Button variant="secondary" onPress={() => router.push({ pathname: "/billing-plan-editor", params: { templateId: template.id } })}>{t("billing.useTemplate")}</Button>{template.source === "TENANT" && <Button variant="secondary" onPress={() => router.push({ pathname: "/billing-plan-editor", params: { mode: "template", templateId: template.id } })}>{t("billing.editTemplate")}</Button>}{template.source === "TENANT" && <Button variant="danger" loading={deleteTemplate.isPending} onPress={() => void deleteTemplate.mutateAsync(template.id)}>{t("billing.deleteTemplate")}</Button>}</View>}</View>)}
    {canManage && <Button variant="secondary" onPress={() => router.push({ pathname: "/billing-plan-editor", params: { mode: "template" } })}>{t("billing.createTemplate")}</Button>}
    <AppText variant="heading">{t("billing.branchCapacity")}</AppText><AppText tone="muted">{t("billing.branchCapacityDescription")}</AppText>
    {branches.data?.filter((branch) => branch.active).map((branch) => { const configured = capacities.data?.find((item) => item.branchId === branch.id)?.dailyCapacity; return <View key={branch.id} style={styles.card}><AppText variant="label">{branch.name}</AppText><AppText tone="muted">{configured ?? "–"}</AppText>{canManage && <Button variant="secondary" onPress={() => openCapacity(branch.id, configured)}>{t("common.edit")}</Button>}</View>; })}
    <AppText variant="heading">{t("billing.discounts")}</AppText><AppText tone="muted">{t("billing.discountsDescription")}</AppText><View style={styles.row}>{plans.data?.map((plan) => <Button key={plan.id} variant={plan.id === selectedPlanId ? "primary" : "secondary"} onPress={() => setSelectedPlanId(plan.id)}>{plan.name}</Button>)}</View>
    {canManage && selectedPlanId && <Button variant="secondary" onPress={() => router.push({ pathname: "/billing-discount-editor", params: { planId: selectedPlanId } })}>{t("billing.createDiscount")}</Button>}
    {discounts.data?.map((discount) => <View key={discount.id} style={styles.card}><AppText variant="label">{discount.name}{discount.promoCode ? ` · ${discount.promoCode}` : ""}</AppText><AppText tone="muted">{discount.type === "PERCENTAGE" ? `${discount.value}%` : formatCurrency(discount.value)} · {discount.active ? t("status.ACTIVE") : t("billing.inactive")}</AppText>{canManage && discount.active && selectedPlanId && <Button variant="danger" loading={deactivateDiscount.isPending} onPress={() => void deactivateDiscount.mutateAsync({ planId: selectedPlanId, discountId: discount.id })}>{t("billing.deactivate")}</Button>}</View>)}
    <AppText variant="heading">{t("billing.pendingInvoices")}</AppText>{invoices.data?.filter((invoice) => invoice.status === "PENDING").map((invoice) => <View key={invoice.id} style={styles.card}><AppText variant="label">{invoice.invoiceNumber} · {invoice.childName}</AppText><AppText>{formatCurrency(invoice.totalAmount)} · {t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>{canManage && <Button loading={markPaid.isPending} onPress={() => void markPaid.mutateAsync(invoice.id)}>{t("billing.markPaid")}</Button>}</View>)}
    <BottomSheet visible={Boolean(capacityBranchId)} onClose={() => setCapacityBranchId(undefined)} closeAccessibilityLabel={t("common.close")} title={t("billing.branchCapacity")} negativeAction={{ label: t("common.cancel"), onPress: () => setCapacityBranchId(undefined) }} positiveAction={{ label: t("billing.saveCapacity"), loading: setBranchCapacity.isPending, onPress: () => void saveCapacity() }}><TextInput style={styles.input} placeholder={t("billing.dailyCapacity")} keyboardType="numeric" value={capacity} onChangeText={setCapacity} /></BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }, row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint } });
