import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, ToggleSwitch, colors, radius, spacing } from "@daycare/ui";
import type { BranchOperatingHour, OperatingDay, OvertimeRateTier } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { DatePicker } from "@/date-picker/DatePicker";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";

const operatingDays: OperatingDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const defaultHours = (): BranchOperatingHour[] => operatingDays.map((dayOfWeek) => ({ dayOfWeek, active: dayOfWeek !== "SUNDAY", opensAt: "07:00", closesAt: "17:00" }));
type OperatingHoursTemplate = { opensAt: string; closesAt: string };
const operatingHoursTemplates: OperatingHoursTemplate[] = [{ opensAt: "06:00", closesAt: "13:30" }, { opensAt: "07:00", closesAt: "16:00" }];
const operatingHoursTemplate = (template: OperatingHoursTemplate): BranchOperatingHour[] => operatingDays.map((dayOfWeek) => ({ dayOfWeek, active: dayOfWeek !== "SUNDAY", opensAt: dayOfWeek === "SUNDAY" ? null : template.opensAt, closesAt: dayOfWeek === "SUNDAY" ? null : template.closesAt }));

export default function BranchOperatingHoursScreen() {
  return <LegacyDaycareRouteGuard policy={legacyDaycareRoutePolicies.staffAdminDaycareOperations}><BranchOperatingHoursScreenContent /></LegacyDaycareRouteGuard>;
}

function BranchOperatingHoursScreenContent() {
  const router = useRouter();
  const { branchId } = useLocalSearchParams<{ branchId: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t, formatCurrency } = useI18n();
  const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const operatingHours = useQuery({ queryKey: ["branch-operating-hours", organizationId, branchId], queryFn: () => api.branchOperatingHours(branchId!), enabled: membership?.role === "STAFF_ADMIN" && Boolean(branchId) });
  const [hours, setHours] = useState<BranchOperatingHour[]>(defaultHours);
  const [tiers, setTiers] = useState<OvertimeRateTier[]>([{ durationMinutes: 15, amount: 100000 }]);
  const [autoOvertimeBillingEnabled, setAutoOvertimeBillingEnabled] = useState(false);
  const [overtimeGraceMinutes, setOvertimeGraceMinutes] = useState(15);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  useEffect(() => { if (operatingHours.data) { setHours(operatingDays.map((dayOfWeek) => operatingHours.data?.hours.find((item) => item.dayOfWeek === dayOfWeek) ?? { dayOfWeek, active: false, opensAt: null, closesAt: null })); setTiers(operatingHours.data.tiers); setAutoOvertimeBillingEnabled(operatingHours.data.autoOvertimeBillingEnabled); setOvertimeGraceMinutes(operatingHours.data.overtimeGraceMinutes); } }, [operatingHours.data]);
  const save = useMutation({ mutationFn: () => api.updateBranchOperatingHours(branchId!, { hours, tiers, autoOvertimeBillingEnabled, overtimeGraceMinutes }), onSuccess: () => client.invalidateQueries({ queryKey: ["branch-operating-hours", organizationId, branchId] }) });
  const valid = useMemo(() => hours.every((hour) => !hour.active || Boolean(hour.opensAt && hour.closesAt && hour.closesAt > hour.opensAt)) && tiers.every((tier) => tier.durationMinutes > 0 && tier.amount > 0) && overtimeGraceMinutes >= 0 && overtimeGraceMinutes <= 180 && (!autoOvertimeBillingEnabled || tiers.length > 0), [autoOvertimeBillingEnabled, hours, overtimeGraceMinutes, tiers]);
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN" || !branchId) return <Redirect href="/home" />;

  const updateHour = (dayOfWeek: OperatingDay, update: Partial<BranchOperatingHour>) => setHours((current) => current.map((hour) => hour.dayOfWeek === dayOfWeek ? { ...hour, ...update } : hour));
  const updateTier = (index: number, update: Partial<OvertimeRateTier>) => setTiers((current) => current.map((tier, tierIndex) => tierIndex === index ? { ...tier, ...update } : tier));
  const applyOperatingHoursTemplate = (template: OperatingHoursTemplate) => setHours(operatingHoursTemplate(template));
  const submit = async () => {
    if (!valid) return Alert.alert(t("overtime.invalidConfiguration"));
    try { await save.mutateAsync(); setShowSaveConfirmation(true); }
    catch (error) { Alert.alert(t("overtime.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("overtime.operatingHours")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("overtime.operatingHoursDescription")}</AppText>
    <View style={styles.row}>{operatingHoursTemplates.map((template) => { const timeRange = `${template.opensAt}–${template.closesAt}`; return <Button key={timeRange} variant="secondary" onPress={() => applyOperatingHoursTemplate(template)}>{t("overtime.applyTemplate", { timeRange })}</Button>; })}</View>
    {operatingHours.isLoading && <ShimmerList variant="row" count={7} />}
    {!operatingHours.isLoading && hours.map((hour) => <View key={hour.dayOfWeek} style={styles.card}>
      <View style={styles.row}><AppText variant="h5">{t(`overtime.day.${hour.dayOfWeek}`)}</AppText><Button variant="secondary" onPress={() => updateHour(hour.dayOfWeek, { active: !hour.active })}>{hour.active ? t("overtime.active") : t("overtime.inactive")}</Button></View>
      {hour.active && <View style={styles.row}><View style={styles.field}><AppText variant="caption" tone="muted">{t("overtime.opensAt")}</AppText><DatePicker mode="time" placeholder={t("overtime.opensAt")} value={hour.opensAt ?? ""} onChange={(opensAt) => updateHour(hour.dayOfWeek, { opensAt })} /></View><View style={styles.field}><AppText variant="caption" tone="muted">{t("overtime.closesAt")}</AppText><DatePicker mode="time" placeholder={t("overtime.closesAt")} value={hour.closesAt ?? ""} onChange={(closesAt) => updateHour(hour.dayOfWeek, { closesAt })} /></View></View>}
    </View>)}
    <AppText variant="heading">{t("overtime.rateTiers")}</AppText><AppText tone="muted">{t("overtime.rateTiersDescription")}</AppText>
    {tiers.map((tier, index) => <View key={index} style={styles.card}><AppText variant="label">{t("overtime.tier", { number: index + 1 })}</AppText><View style={styles.row}><View style={styles.field}><AppText variant="caption" tone="muted">{t("overtime.durationMinutes")}</AppText><TextInput style={styles.input} keyboardType="number-pad" value={String(tier.durationMinutes)} onChangeText={(value) => updateTier(index, { durationMinutes: Number(value) || 0 })} /></View><View style={styles.field}><AppText variant="caption" tone="muted">{t("overtime.amount")}</AppText><TextInput style={styles.input} keyboardType="decimal-pad" value={String(tier.amount)} onChangeText={(value) => updateTier(index, { amount: Number(value) || 0 })} /><AppText variant="caption" tone="muted">{formatCurrency(tier.amount)}</AppText></View></View><Button variant="danger" onPress={() => setTiers((current) => current.filter((_, tierIndex) => tierIndex !== index))}>{t("overtime.removeTier")}</Button></View>)}
    <Button variant="secondary" onPress={() => setTiers((current) => [...current, { durationMinutes: 15, amount: 100000 }])}>{t("overtime.addTier")}</Button>
    <View style={styles.card}><ToggleSwitch label={t("overtime.autoBilling")} description={t("overtime.autoBillingDescription")} value={autoOvertimeBillingEnabled} onValueChange={setAutoOvertimeBillingEnabled} disabled={tiers.length === 0} accessibilityLabel={t("overtime.autoBilling")} />{autoOvertimeBillingEnabled && <View style={styles.field}><AppText variant="caption" tone="muted">{t("overtime.graceMinutes")}</AppText><TextInput style={styles.input} keyboardType="number-pad" value={String(overtimeGraceMinutes)} onChangeText={(value) => setOvertimeGraceMinutes(Number(value) || 0)} /><AppText variant="caption" tone="muted">{t("overtime.graceMinutesDescription")}</AppText></View>}</View>
    <Button loading={save.isPending} disabled={!valid || membership.active === false} onPress={() => void submit()}>{t("common.save")}</Button>
    <BottomSheet visible={showSaveConfirmation} onClose={() => setShowSaveConfirmation(false)} closeAccessibilityLabel={t("common.close")} title={t("overtime.saved")} positiveAction={{ label: t("common.ok"), onPress: () => router.back() }}>
      <AppText tone="muted">{t("overtime.saved")}</AppText>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  field: { flex: 1, minWidth: 140, gap: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
