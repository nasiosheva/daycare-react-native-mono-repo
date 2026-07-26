import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useInvoices, useMarkInvoicePaid, useServicePlans } from "@/booking/useBooking";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import type { ServicePlanDiscountKind, ServicePlanDiscountType, ServicePlanType, UnusedCreditPolicy } from "@daycare/core";
import type { ServicePlanTemplate } from "@daycare/api-client";

const discountKinds: ServicePlanDiscountKind[] = ["AUTOMATIC", "PROMO_CODE"];
const discountTypes: ServicePlanDiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT"];
const emptyDiscountForm = () => ({ name: "", kind: "AUTOMATIC" as ServicePlanDiscountKind, promoCode: "", type: "PERCENTAGE" as ServicePlanDiscountType, value: "", startsOn: "", endsOn: "", usageLimit: "" });

const planTypes: ServicePlanType[] = ["DAILY", "WEEKLY", "MONTHLY"];
type PlanFields = { name: string; price: string; type: ServicePlanType; credits: string; policy: UnusedCreditPolicy; carryDays: string; capacity: string };
const emptyPlanFields = (): PlanFields => ({ name: "", price: "", type: "DAILY", credits: "1", policy: "EXPIRE", carryDays: "30", capacity: "" });
const MAX_DAILY_CAPACITY = 999;
const digitsOnly = (value: string) => value.replace(/\D/g, "");
const formatThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const formatPriceInput = (value: string) => formatThousands(digitsOnly(value));
const formatCapacityInput = (value: string) => { const digits = digitsOnly(value); return digits ? String(Math.min(MAX_DAILY_CAPACITY, Number(digits))) : ""; };
function templateToFields(template: ServicePlanTemplate): PlanFields {
  return { name: template.name, type: template.type, price: template.suggestedPrice != null ? formatThousands(String(template.suggestedPrice)) : "", credits: template.creditCount?.toString() ?? (template.type === "DAILY" ? "1" : ""), policy: template.unusedCreditPolicy ?? "EXPIRE", carryDays: template.carryForwardDays?.toString() ?? "30", capacity: template.dailyCapacity?.toString() ?? "" };
}
function toPlanInput(fields: PlanFields) {
  const priceDigits = digitsOnly(fields.price);
  const price = priceDigits ? Number(priceDigits) : undefined;
  const creditCount = fields.type === "MONTHLY" || !fields.credits.trim() ? undefined : Number(fields.credits);
  const dailyCapacity = fields.capacity.trim() ? Number(fields.capacity) : undefined;
  const carryForwardDays = fields.type === "WEEKLY" && fields.policy === "CARRY_FORWARD" ? Number(fields.carryDays) : undefined;
  if (!fields.name.trim() || (price !== undefined && (!Number.isFinite(price) || price <= 0)) || (creditCount !== undefined && (!Number.isInteger(creditCount) || creditCount < 1)) || (dailyCapacity !== undefined && (!Number.isInteger(dailyCapacity) || dailyCapacity < 1 || dailyCapacity > MAX_DAILY_CAPACITY)) || (carryForwardDays !== undefined && (!Number.isInteger(carryForwardDays) || carryForwardDays < 1))) return undefined;
  return { name: fields.name.trim(), type: fields.type, price, creditCount, unusedCreditPolicy: fields.type === "WEEKLY" ? fields.policy : undefined, carryForwardDays, bookingRequiresApproval: true, dailyCapacity };
}
function planFieldError(fields: PlanFields, isTemplateEditor: boolean): "billing.nameRequired" | "billing.priceRequired" | "billing.daysRequired" | "billing.invalidCapacity" | "billing.invalidCarryDays" | null {
  if (!fields.name.trim()) return "billing.nameRequired";
  const priceDigits = digitsOnly(fields.price);
  if (!isTemplateEditor && !priceDigits) return "billing.priceRequired";
  if (priceDigits) {
    const price = Number(priceDigits);
    if (!Number.isFinite(price) || price <= 0) return "billing.priceRequired";
  }
  if (fields.type !== "MONTHLY") {
    const credits = fields.credits.trim() ? Number(fields.credits) : NaN;
    if (!Number.isInteger(credits) || credits < 1) return "billing.daysRequired";
  }
  if (fields.capacity.trim()) {
    const capacity = Number(fields.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_DAILY_CAPACITY) return "billing.invalidCapacity";
  }
  if (fields.type === "WEEKLY" && fields.policy === "CARRY_FORWARD") {
    const carryDays = fields.carryDays.trim() ? Number(fields.carryDays) : NaN;
    if (!Number.isInteger(carryDays) || carryDays < 1) return "billing.invalidCarryDays";
  }
  return null;
}

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
  const [listSheet, setListSheet] = useState<"plans" | "templates" | "capacity" | "discounts" | "invoices" | null>(null);
  const [discountFormOpen, setDiscountFormOpen] = useState(false);
  const [discount, setDiscount] = useState(emptyDiscountForm());
  const [planFormMode, setPlanFormMode] = useState<"plan" | "template" | null>(null);
  const [planFormTemplateId, setPlanFormTemplateId] = useState<string>();
  const [planFields, setPlanFields] = useState<PlanFields>(emptyPlanFields());
  const discounts = useQuery({ queryKey: ["service-plan-discounts", organizationId, selectedPlanId], queryFn: () => api.servicePlanDiscounts(selectedPlanId!), enabled: membership?.role === "STAFF_ADMIN" && Boolean(selectedPlanId) });
  const selectedTemplate = planFormTemplateId ? templates.data?.find((item) => item.id === planFormTemplateId) : undefined;
  const refreshCapacities = () => { void queryClient.invalidateQueries({ queryKey: ["branch-capacities", organizationId] }); };
  const refreshTemplates = () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-templates", organizationId] }); };
  const refreshDiscounts = () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-discounts", organizationId, selectedPlanId] }); };
  const refreshPlans = () => { void queryClient.invalidateQueries({ queryKey: ["service-plans", organizationId] }); };
  const setBranchCapacity = useMutation({ mutationFn: ({ branchId, dailyCapacity }: { branchId: string; dailyCapacity: number }) => api.setBranchCapacity(branchId, dailyCapacity), onSuccess: refreshCapacities });
  const deleteTemplate = useMutation({ mutationFn: api.deleteServicePlanTemplate.bind(api), onSuccess: refreshTemplates });
  const deactivateDiscount = useMutation({ mutationFn: ({ planId, discountId }: { planId: string; discountId: string }) => api.deactivateServicePlanDiscount(planId, discountId), onSuccess: refreshDiscounts });
  const createDiscount = useMutation({ mutationFn: ({ targetPlanId, input }: { targetPlanId: string; input: Parameters<typeof api.createServicePlanDiscount>[1] }) => api.createServicePlanDiscount(targetPlanId, input), onSuccess: () => { refreshDiscounts(); setDiscountFormOpen(false); setDiscount(emptyDiscountForm()); } });
  const closePlanFormState = () => { setPlanFormMode(null); setPlanFormTemplateId(undefined); setPlanFields(emptyPlanFields()); };
  const createPlan = useMutation({ mutationFn: api.createServicePlan.bind(api), onSuccess: () => { refreshPlans(); closePlanFormState(); } });
  const createTemplate = useMutation({ mutationFn: api.createServicePlanTemplate.bind(api), onSuccess: () => { refreshTemplates(); closePlanFormState(); } });
  const updateTemplate = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateServicePlanTemplate>[1] }) => api.updateServicePlanTemplate(id, input), onSuccess: () => { refreshTemplates(); closePlanFormState(); } });

  useEffect(() => { if (selectedTemplate) setPlanFields(templateToFields(selectedTemplate)); }, [selectedTemplate]);

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const openCapacity = (branchId: string, current?: number | null) => { setListSheet(null); setCapacityBranchId(branchId); setCapacity(current?.toString() ?? ""); };
  const saveCapacity = async () => {
    const dailyCapacity = Number(capacity);
    if (!capacityBranchId || !Number.isInteger(dailyCapacity) || dailyCapacity < 1 || dailyCapacity > MAX_DAILY_CAPACITY) return notify(t("billing.invalidCapacity"));
    try { await setBranchCapacity.mutateAsync({ branchId: capacityBranchId, dailyCapacity }); setCapacityBranchId(undefined); } catch (error) { notify(t("billing.capacityFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const closeListSheet = () => setListSheet(null);
  const openCreateDiscount = () => { setListSheet(null); setDiscount(emptyDiscountForm()); setDiscountFormOpen(true); };
  const closeDiscountForm = () => { setDiscountFormOpen(false); setDiscount(emptyDiscountForm()); };
  const saveDiscount = async () => {
    if (!selectedPlanId) return;
    const value = Number(discount.value);
    const usageLimit = discount.usageLimit.trim() ? Number(discount.usageLimit) : undefined;
    if (!discount.name.trim() || !Number.isFinite(value) || value <= 0 || (discount.type === "PERCENTAGE" && value >= 100) || (discount.kind === "PROMO_CODE" && !discount.promoCode.trim()) || (usageLimit !== undefined && (!Number.isInteger(usageLimit) || usageLimit < 1))) return notify(t("billing.invalidDiscount"));
    try {
      await createDiscount.mutateAsync({ targetPlanId: selectedPlanId, input: { kind: discount.kind, name: discount.name.trim(), promoCode: discount.kind === "PROMO_CODE" ? discount.promoCode.trim() : undefined, type: discount.type, value, startsOn: discount.startsOn.trim() || undefined, endsOn: discount.endsOn.trim() || undefined, usageLimit: discount.kind === "PROMO_CODE" ? usageLimit : undefined } });
    } catch (error) { notify(t("billing.discountFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const isTemplateEditor = planFormMode === "template";
  const openCreatePlan = () => { setListSheet(null); setPlanFormTemplateId(undefined); setPlanFields(emptyPlanFields()); setPlanFormMode("plan"); };
  const openCreateTemplate = () => { setListSheet(null); setPlanFormTemplateId(undefined); setPlanFields(emptyPlanFields()); setPlanFormMode("template"); };
  const openUseTemplate = (templateId: string) => { setListSheet(null); setPlanFormTemplateId(templateId); setPlanFormMode("plan"); };
  const openEditTemplate = (templateId: string) => { setListSheet(null); setPlanFormTemplateId(templateId); setPlanFormMode("template"); };
  const closePlanForm = () => closePlanFormState();
  const updatePlanFields = (patch: Partial<PlanFields>) => setPlanFields((current) => ({ ...current, ...patch }));
  const savePlanForm = async () => {
    const fieldError = planFieldError(planFields, isTemplateEditor);
    if (fieldError) return notify(t(fieldError));
    const input = toPlanInput(planFields);
    if (!input || (!isTemplateEditor && input.price === undefined)) return notify(t("billing.invalid"));
    try {
      if (isTemplateEditor) {
        const { price: suggestedPrice, ...templateInput } = input;
        if (planFormTemplateId) await updateTemplate.mutateAsync({ id: planFormTemplateId, input: { ...templateInput, suggestedPrice } });
        else await createTemplate.mutateAsync({ ...templateInput, suggestedPrice });
      } else {
        await createPlan.mutateAsync({ ...input, price: input.price! });
      }
    } catch (error) {
      notify(isTemplateEditor ? t("billing.templateFailed") : t("billing.failed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };
  const planFormTitle = isTemplateEditor ? t(planFormTemplateId ? "billing.editTemplate" : "billing.createTemplate") : t("billing.createPlan");
  const pendingInvoices = invoices.data?.filter((invoice) => invoice.status === "PENDING") ?? [];

  return <AppScreen showBottomNavigation={false} title={t("billing.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {!canManage && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <BranchTab label={t("branchFilter.allBranches")} selected={!filterBranchId} onPress={() => setFilterBranchId(undefined)} />
      {branches.data?.map((branch) => <BranchTab key={branch.id} label={branch.name} selected={filterBranchId === branch.id} onPress={() => setFilterBranchId(branch.id)} />)}
    </ScrollView>
    <View style={styles.grid}>
      <NavigationCard accessibilityLabel={t("billing.activePlans")} onPress={() => setListSheet("plans")} style={styles.tile}>
        <AppText variant="label">{t("billing.activePlans")}</AppText>
        <AppText tone={plans.data?.length ? "default" : "muted"}>{plans.data?.length ? t("billing.plansSummary", { count: plans.data.length }) : t("common.noData")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("billing.templates")} onPress={() => setListSheet("templates")} style={styles.tile}>
        <AppText variant="label">{t("billing.templates")}</AppText>
        <AppText tone={templates.data?.length ? "default" : "muted"}>{templates.data?.length ? t("billing.templatesSummary", { count: templates.data.length }) : t("common.noData")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("billing.branchCapacity")} onPress={() => setListSheet("capacity")} style={styles.tile}>
        <AppText variant="label">{t("billing.branchCapacity")}</AppText>
        <AppText tone="muted">{branches.data?.filter((branch) => branch.active).length ? t("billing.branchesSummary", { count: branches.data.filter((branch) => branch.active).length }) : t("common.noData")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("billing.discounts")} onPress={() => setListSheet("discounts")} style={styles.tile}>
        <AppText variant="label">{t("billing.discounts")}</AppText>
        <AppText tone="muted">{t("billing.discountsDescription")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("billing.pendingInvoices")} onPress={() => setListSheet("invoices")} style={styles.tile}>
        <AppText variant="label">{t("billing.pendingInvoices")}</AppText>
        <AppText tone={pendingInvoices.length ? "danger" : "muted"}>{pendingInvoices.length ? t("billing.pendingInvoicesCount", { count: pendingInvoices.length }) : t("common.noData")}</AppText>
      </NavigationCard>
    </View>

    <BottomSheet visible={listSheet === "plans"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("billing.activePlans")}>
      <AppText tone="muted">{t("billing.activePlansDescription")}</AppText>
      {canManage && <Button onPress={openCreatePlan}>{t("billing.createPlan")}</Button>}
      {plans.isFetching && <ShimmerList />}
      {!plans.isFetching && plans.data?.map((plan) => <View key={plan.id} style={styles.card}>
        <AppText variant="label">{plan.name}</AppText>
        <AppText>{t(servicePlanTypeKey(plan.type))} · {formatCurrency(plan.price)}</AppText>
        <PlanExtras type={plan.type} creditCount={plan.creditCount} unusedCreditPolicy={plan.unusedCreditPolicy} dailyCapacity={plan.dailyCapacity} t={t} />
      </View>)}
      {!plans.isFetching && plans.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={listSheet === "templates"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("billing.templates")}>
      <AppText tone="muted">{t("billing.templatesDescription")}</AppText>
      {canManage && <Button onPress={openCreateTemplate}>{t("billing.createTemplate")}</Button>}
      {templates.isFetching && <ShimmerList />}
      {!templates.isFetching && templates.data?.map((template) => <View key={template.id} style={styles.card}>
        <AppText variant="label">{template.name}</AppText>
        <AppText tone="muted">{t(servicePlanTypeKey(template.type))}{template.suggestedPrice ? ` · ${formatCurrency(template.suggestedPrice)}` : ""}</AppText>
        <PlanExtras type={template.type} creditCount={template.creditCount} unusedCreditPolicy={template.unusedCreditPolicy} dailyCapacity={template.dailyCapacity} t={t} />
        {canManage && <View style={styles.row}><Button variant="secondary" onPress={() => openUseTemplate(template.id)}>{t("billing.useTemplate")}</Button>{template.source === "TENANT" && <Button variant="secondary" onPress={() => openEditTemplate(template.id)}>{t("billing.editTemplate")}</Button>}{template.source === "TENANT" && <Button variant="danger" loading={deleteTemplate.isPending} onPress={() => void deleteTemplate.mutateAsync(template.id)}>{t("billing.deleteTemplate")}</Button>}</View>}
      </View>)}
      {!templates.isFetching && templates.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={listSheet === "capacity"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("billing.branchCapacity")}>
      <AppText tone="muted">{t("billing.branchCapacityDescription")}</AppText>
      {(branches.isFetching || capacities.isFetching) && <ShimmerList />}
      {!branches.isFetching && !capacities.isFetching && branches.data?.filter((branch) => branch.active).map((branch) => { const configured = capacities.data?.find((item) => item.branchId === branch.id)?.dailyCapacity; return <View key={branch.id} style={styles.card}>
        <AppText variant="label">{branch.name}</AppText>
        <AppText tone="muted">{configured != null ? t("billing.planCapacitySummary", { count: configured }) : t("learning.unlimited")}</AppText>
        {canManage && <Button variant="secondary" onPress={() => openCapacity(branch.id, configured)}>{t("common.edit")}</Button>}
      </View>; })}
    </BottomSheet>

    <BottomSheet visible={listSheet === "discounts"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("billing.discounts")}>
      <AppText tone="muted">{t("billing.discountsDescription")}</AppText>
      <View style={styles.row}>{plans.data?.map((plan) => <Button key={plan.id} variant={plan.id === selectedPlanId ? "primary" : "secondary"} onPress={() => setSelectedPlanId(plan.id)}>{plan.name}</Button>)}</View>
      {canManage && selectedPlanId && <Button variant="secondary" onPress={openCreateDiscount}>{t("billing.createDiscount")}</Button>}
      {discounts.isFetching && <ShimmerList />}
      {!discounts.isFetching && discounts.data?.map((item) => <View key={item.id} style={styles.card}>
        <AppText variant="label">{item.name}{item.promoCode ? ` · ${item.promoCode}` : ""}</AppText>
        <AppText tone="muted">{item.type === "PERCENTAGE" ? `${item.value}%` : formatCurrency(item.value)} · {item.active ? t("status.ACTIVE") : t("billing.inactive")}</AppText>
        {item.startsOn && item.endsOn && <AppText variant="caption" tone="muted">{t("billing.discountValidityRange", { start: formatDate(item.startsOn), end: formatDate(item.endsOn) })}</AppText>}
        {item.startsOn && !item.endsOn && <AppText variant="caption" tone="muted">{t("billing.discountValidityFrom", { start: formatDate(item.startsOn) })}</AppText>}
        {!item.startsOn && item.endsOn && <AppText variant="caption" tone="muted">{t("booking.validUntil", { date: formatDate(item.endsOn) })}</AppText>}
        {item.usageLimit != null && <AppText variant="caption" tone="muted">{t("billing.discountUsageLimit", { count: item.usageLimit })}</AppText>}
        {canManage && item.active && selectedPlanId && <Button variant="danger" loading={deactivateDiscount.isPending} onPress={() => void deactivateDiscount.mutateAsync({ planId: selectedPlanId, discountId: item.id })}>{t("billing.deactivate")}</Button>}
      </View>)}
      {!discounts.isFetching && selectedPlanId && discounts.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={listSheet === "invoices"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("billing.pendingInvoices")}>
      <AppText tone="muted">{t("billing.pendingInvoicesDescription")}</AppText>
      {invoices.isFetching && <ShimmerList />}
      {!invoices.isFetching && pendingInvoices.map((invoice) => <View key={invoice.id} style={styles.card}>
        <AppText variant="label">{invoice.invoiceNumber} · {invoice.childName}</AppText>
        <AppText tone="muted">{t("staffAdmin.parent")}: {invoice.parentName ?? invoice.parentEmail ?? t("common.noData")}</AppText>
        <AppText>{formatCurrency(invoice.totalAmount)} · {t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>
        {invoice.discountName && <AppText variant="caption" tone="muted">{t("billing.invoiceDiscountApplied", { name: invoice.discountName, amount: formatCurrency(invoice.discountAmount) })}</AppText>}
        {canManage && <Button loading={markPaid.isPending} onPress={() => void markPaid.mutateAsync(invoice.id)}>{t("billing.markPaid")}</Button>}
      </View>)}
      {!invoices.isFetching && pendingInvoices.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={Boolean(capacityBranchId)} onClose={() => setCapacityBranchId(undefined)} closeAccessibilityLabel={t("common.close")} title={t("billing.branchCapacity")} negativeAction={{ label: t("common.cancel"), onPress: () => setCapacityBranchId(undefined) }} positiveAction={{ label: t("billing.saveCapacity"), loading: setBranchCapacity.isPending, onPress: () => void saveCapacity() }}><TextInput style={styles.input} placeholder={t("billing.dailyCapacity")} keyboardType="numeric" maxLength={3} value={capacity} onChangeText={(value) => setCapacity(formatCapacityInput(value))} /></BottomSheet>

    <BottomSheet visible={discountFormOpen} onClose={closeDiscountForm} closeAccessibilityLabel={t("common.close")} title={t("billing.createDiscount")} negativeAction={{ label: t("common.cancel"), onPress: closeDiscountForm }} positiveAction={{ label: t("billing.saveDiscount"), loading: createDiscount.isPending, onPress: () => void saveDiscount() }}>
      <TextInput style={styles.input} placeholder={t("billing.discountName")} value={discount.name} onChangeText={(name) => setDiscount((current) => ({ ...current, name }))} />
      <Choice values={discountKinds} value={discount.kind} onChange={(kind) => setDiscount((current) => ({ ...current, kind }))} labels={{ AUTOMATIC: t("billing.automatic"), PROMO_CODE: t("billing.promo") }} />
      {discount.kind === "PROMO_CODE" && <TextInput style={styles.input} autoCapitalize="characters" placeholder={t("billing.promoCode")} value={discount.promoCode} onChangeText={(promoCode) => setDiscount((current) => ({ ...current, promoCode }))} />}
      <Choice values={discountTypes} value={discount.type} onChange={(type) => setDiscount((current) => ({ ...current, type }))} labels={{ PERCENTAGE: t("billing.percentage"), FIXED_AMOUNT: t("billing.fixedAmount") }} />
      <TextInput style={styles.input} placeholder={t("billing.discountValue")} keyboardType="numeric" value={discount.value} onChangeText={(value) => setDiscount((current) => ({ ...current, value }))} />
      <DatePicker placeholder={t("billing.startsOn")} value={discount.startsOn} onChange={(startsOn) => setDiscount((current) => ({ ...current, startsOn }))} maximumDate={discount.endsOn || undefined} onClear={() => setDiscount((current) => ({ ...current, startsOn: "" }))} clearAccessibilityLabel={t("common.clear")} />
      <DatePicker placeholder={t("billing.endsOn")} value={discount.endsOn} onChange={(endsOn) => setDiscount((current) => ({ ...current, endsOn }))} minimumDate={discount.startsOn || undefined} onClear={() => setDiscount((current) => ({ ...current, endsOn: "" }))} clearAccessibilityLabel={t("common.clear")} />
      {discount.kind === "PROMO_CODE" && <TextInput style={styles.input} placeholder={t("billing.usageLimit")} keyboardType="numeric" value={discount.usageLimit} onChangeText={(usageLimit) => setDiscount((current) => ({ ...current, usageLimit }))} />}
    </BottomSheet>

    <BottomSheet visible={planFormMode !== null} onClose={closePlanForm} closeAccessibilityLabel={t("common.close")} title={planFormTitle} negativeAction={{ label: t("common.cancel"), onPress: closePlanForm }} positiveAction={{ label: t(isTemplateEditor ? "common.save" : "billing.savePlan"), loading: createPlan.isPending || createTemplate.isPending || updateTemplate.isPending, onPress: () => void savePlanForm() }}>
      <TextInput style={styles.input} placeholder={t("billing.planName")} value={planFields.name} onChangeText={(name) => updatePlanFields({ name })} />
      <Choice values={planTypes} value={planFields.type} onChange={(type) => updatePlanFields({ type, credits: type === "DAILY" ? "1" : planFields.credits })} labels={{ DAILY: t(servicePlanTypeKey("DAILY")), WEEKLY: t(servicePlanTypeKey("WEEKLY")), MONTHLY: t(servicePlanTypeKey("MONTHLY")) }} />
      <TextInput style={styles.input} placeholder={t(isTemplateEditor ? "billing.suggestedPrice" : "billing.price")} keyboardType="numeric" value={planFields.price} onChangeText={(price) => updatePlanFields({ price: formatPriceInput(price) })} />
      <TextInput style={styles.input} placeholder={t("billing.dailyCapacity")} keyboardType="numeric" maxLength={3} value={planFields.capacity} onChangeText={(capacity) => updatePlanFields({ capacity: formatCapacityInput(capacity) })} />
      {planFields.type !== "MONTHLY" && <TextInput style={styles.input} placeholder={t("billing.days")} keyboardType="numeric" value={planFields.credits} onChangeText={(credits) => updatePlanFields({ credits })} />}
      {planFields.type === "WEEKLY" && <><View style={styles.options}><Button variant={planFields.policy === "EXPIRE" ? "primary" : "secondary"} onPress={() => updatePlanFields({ policy: "EXPIRE" })}>{t("billing.expire")}</Button><Button variant={planFields.policy === "CARRY_FORWARD" ? "primary" : "secondary"} onPress={() => updatePlanFields({ policy: "CARRY_FORWARD" })}>{t("billing.carry")}</Button></View>{planFields.policy === "CARRY_FORWARD" && <TextInput style={styles.input} placeholder={t("billing.carryForwardDays")} keyboardType="numeric" value={planFields.carryDays} onChangeText={(carryDays) => updatePlanFields({ carryDays })} />}</>}
    </BottomSheet>
  </AppScreen>;
}

function Choice<T extends string>({ values, value, onChange, labels }: { values: readonly T[]; value: T; onChange: (value: T) => void; labels: Record<T, string> }) { return <View style={styles.options}>{values.map((item) => <Button key={item} variant={item === value ? "primary" : "secondary"} onPress={() => onChange(item)}>{labels[item]}</Button>)}</View>; }

function PlanExtras({ type, creditCount, unusedCreditPolicy, dailyCapacity, t }: { type: ServicePlanType; creditCount?: number | null; unusedCreditPolicy?: UnusedCreditPolicy | null; dailyCapacity?: number | null; t: ReturnType<typeof useI18n>["t"] }) {
  return <>
    {type !== "MONTHLY" && <AppText tone="muted">{t("billing.planCreditsSummary", { count: creditCount ?? 0 })}</AppText>}
    {type === "WEEKLY" && <AppText tone="muted">{t(unusedCreditPolicy === "CARRY_FORWARD" ? "billing.carry" : "billing.expire")}</AppText>}
    {dailyCapacity != null && <AppText tone="muted">{t("billing.planCapacitySummary", { count: dailyCapacity })}</AppText>}
  </>;
}

function BranchTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({ input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }, row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, tile: { flexGrow: 1, flexBasis: "47%" }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint }, tabsScroll: { flexGrow: 0, flexShrink: 0 }, tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" }, activeTab: { borderBottomColor: colors.primary }, tabText: { color: colors.muted }, activeTabText: { color: colors.primary }, pressedTab: { opacity: 0.72 } });
