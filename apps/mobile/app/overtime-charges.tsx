import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import type { CreateOvertimeChargeInput, OvertimeCharge } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren } from "@/attendance/useAttendance";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";

type ChargeForm = { charge?: OvertimeCharge; childId: string; operationalDate: string; pickedUpAt: string; dueDate: string };
const emptyForm = (): ChargeForm => ({ childId: "", operationalDate: formatIsoDate(new Date()), pickedUpAt: "17:15", dueDate: formatIsoDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) });

export default function OvertimeChargesScreen() {
  return <LegacyDaycareRouteGuard policy={legacyDaycareRoutePolicies.staffAdminDaycareOperations}><OvertimeChargesScreenContent /></LegacyDaycareRouteGuard>;
}

function OvertimeChargesScreenContent() {
  const router = useRouter(); const { api, profile, organizationId } = useAuth(); const { t, formatCurrency, formatDate } = useI18n(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const charges = useQuery({ queryKey: ["overtime-charges", organizationId], queryFn: () => api.overtimeCharges(), enabled: membership?.role === "STAFF_ADMIN" });
  const children = useChildren(membership?.role === "STAFF_ADMIN");
  const [form, setForm] = useState<ChargeForm | null>(null);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["overtime-charges", organizationId] }); void client.invalidateQueries({ queryKey: ["invoices", organizationId] }); };
  const requestInput = (input: ChargeForm): CreateOvertimeChargeInput => ({ childId: input.childId, operationalDate: input.operationalDate, pickedUpAt: input.pickedUpAt, dueDate: input.dueDate });
  const create = useMutation({ mutationFn: (input: ChargeForm) => api.createOvertimeCharge(requestInput(input)), onSuccess: refresh });
  const update = useMutation({ mutationFn: (input: ChargeForm) => api.updateOvertimeCharge(input.charge!.id, requestInput(input)), onSuccess: refresh });
  const voidCharge = useMutation({ mutationFn: (chargeId: string) => api.voidOvertimeCharge(chargeId), onSuccess: refresh });
  const selectedChild = useMemo(() => children.data?.find((child) => child.id === form?.childId), [children.data, form?.childId]);
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const openCreate = () => setForm(emptyForm());
  const openEdit = (charge: OvertimeCharge) => setForm({ charge, childId: charge.childId, operationalDate: charge.operationalDate, pickedUpAt: charge.pickedUpAt, dueDate: charge.dueDate });
  const submit = async () => {
    if (!form || !form.childId || !form.operationalDate || !form.pickedUpAt || !form.dueDate) return Alert.alert(t("overtime.chargeRequired"));
    try { if (form.charge) await update.mutateAsync(form); else await create.mutateAsync(form); setForm(null); Alert.alert(t("overtime.chargeSaved")); }
    catch (error) { Alert.alert(t("overtime.chargeFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const cancel = async (charge: OvertimeCharge) => {
    try { await voidCharge.mutateAsync(charge.id); Alert.alert(t("overtime.chargeVoided")); }
    catch (error) { Alert.alert(t("overtime.chargeFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("overtime.chargesTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={membership.active !== false ? <FloatingActionButton accessibilityLabel={t("overtime.addCharge")} onPress={openCreate}>+ {t("overtime.addCharge")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("overtime.chargesDescription")}</AppText>
    {charges.isFetching && <ShimmerList />}
    {charges.isError && <Button variant="secondary" onPress={() => charges.refetch()}>{t("common.retry")}</Button>}
    {!charges.isFetching && charges.data?.map((charge) => <View key={charge.id} style={styles.card}><AppText variant="h5">{charge.childName}</AppText><AppText>{formatDate(charge.operationalDate)} · {charge.pickedUpAt} · {t("overtime.minutes", { count: charge.overtimeMinutes })}</AppText><AppText>{formatCurrency(charge.totalAmount)}</AppText><AppText tone="muted">{t("overtime.dueDate", { date: formatDate(charge.dueDate), status: t(`status.${charge.status}`) })}</AppText>{charge.status === "PENDING" && membership.active !== false && <View style={styles.actions}><Button variant="secondary" onPress={() => openEdit(charge)}>{t("common.edit")}</Button><Button variant="danger" loading={voidCharge.isPending} onPress={() => void cancel(charge)}>{t("overtime.voidCharge")}</Button></View>}</View>)}
    {!charges.isFetching && charges.data?.length === 0 && <AppText tone="muted">{t("overtime.noCharges")}</AppText>}
    <BottomSheet visible={Boolean(form)} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={form?.charge ? t("overtime.editCharge") : t("overtime.addCharge")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("common.save"), loading: create.isPending || update.isPending, disabled: !form?.childId, onPress: () => void submit() }}>
      <AppText variant="label">{t("overtime.child")}</AppText>
      {children.isFetching && <ShimmerList variant="row" />}
      {!children.isFetching && children.data?.map((child) => <Pressable key={child.id} disabled={Boolean(form?.charge)} onPress={() => setForm((current) => current ? { ...current, childId: child.id } : current)} style={({ pressed }) => [styles.child, form?.childId === child.id && styles.selectedChild, pressed && styles.pressed]}><AppText>{child.fullName}</AppText></Pressable>)}
      {selectedChild && <AppText tone="muted">{selectedChild.fullName}</AppText>}
      <DatePicker placeholder={t("overtime.operationalDate")} value={form?.operationalDate ?? ""} onChange={(operationalDate) => setForm((current) => current ? { ...current, operationalDate } : current)} disabled={Boolean(form?.charge)} />
      <DatePicker mode="time" placeholder={t("overtime.pickedUpAt")} value={form?.pickedUpAt ?? ""} onChange={(pickedUpAt) => setForm((current) => current ? { ...current, pickedUpAt } : current)} />
      <DatePicker placeholder={t("overtime.paymentDueDate")} value={form?.dueDate ?? ""} onChange={(dueDate) => setForm((current) => current ? { ...current, dueDate } : current)} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  child: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selectedChild: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  pressed: { opacity: 0.75 },
});
