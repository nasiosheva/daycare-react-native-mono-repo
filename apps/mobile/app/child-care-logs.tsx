import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildCareLog, ChildCareLogType, ChildMealAmount, ChildMealType, ChildToiletType, CreateChildCareLogInput } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, colors, spacing, type Tone } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import { dateFromIsoTime, formatIsoTime } from "@/date-picker/date";

type FormState = {
  type: ChildCareLogType;
  mealType: ChildMealType;
  mealAmount: ChildMealAmount;
  toiletType: ChildToiletType;
  napStartedAt: string;
  napEndedAt: string;
  note: string;
  correctsLogId?: string;
  correctionReason: string;
};

const initialForm = (original?: ChildCareLog): FormState => {
  const now = new Date();
  return {
    type: original?.type ?? "MEAL",
    mealType: original?.mealType ?? "LUNCH",
    mealAmount: original?.mealAmount ?? "ALL",
    toiletType: original?.toiletType ?? "WET",
    napStartedAt: original?.napStartedAt ? formatIsoTime(new Date(original.napStartedAt)) : formatIsoTime(new Date(now.getTime() - 60 * 60 * 1000)),
    napEndedAt: original?.napEndedAt ? formatIsoTime(new Date(original.napEndedAt)) : formatIsoTime(now),
    note: original?.note ?? "",
    correctsLogId: original?.id,
    correctionReason: "",
  };
};
const careTypes: ChildCareLogType[] = ["MEAL", "NAP", "TOILET"];
const mealTypes: ChildMealType[] = ["BREAKFAST", "SNACK", "LUNCH", "OTHER"];
const mealAmounts: ChildMealAmount[] = ["NONE", "LESS_THAN_HALF", "ABOUT_HALF", "MOST", "ALL"];
const toiletTypes: ChildToiletType[] = ["WET", "SOILED", "TOILET_ATTEMPT"];

export default function ChildCareLogsScreen() {
  const router = useRouter();
  const { childId: rawChildId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canRecord = Boolean(membership?.active && (membership.role === "STAFF" || membership.role === "STAFF_ADMIN"));
  const logs = useQuery({ queryKey: ["child-care-logs", organizationId, childId], queryFn: () => api.childCareLogs(childId!, organizationId), enabled: Boolean(childId && organizationId && membership) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["child-care-logs", organizationId, childId] });
  const [form, setForm] = useState<FormState | null>(null);
  const create = useMutation({
    mutationFn: (input: CreateChildCareLogInput) => api.createChildCareLog(childId!, input, organizationId),
    onSuccess: () => { invalidate(); setForm(null); notify(t("operations.careSaved"), undefined, "success"); },
  });

  if (!profile) return null;
  if (!childId || !membership || !["PARENT", "STAFF", "STAFF_ADMIN"].includes(membership.role)) return <Redirect href="/home" />;

  const typeLabel = (type: ChildCareLogType) => t(type === "MEAL" ? "operations.meal" : type === "NAP" ? "operations.nap" : "operations.toilet");
  const mealTypeLabel = (type: ChildMealType) => t(type === "BREAKFAST" ? "operations.breakfast" : type === "SNACK" ? "operations.snack" : type === "LUNCH" ? "operations.lunch" : "operations.otherMeal");
  const mealAmountLabel = (amount: ChildMealAmount) => t(amount === "NONE" ? "operations.amountNone" : amount === "LESS_THAN_HALF" ? "operations.amountLessHalf" : amount === "ABOUT_HALF" ? "operations.amountHalf" : amount === "MOST" ? "operations.amountMost" : "operations.amountAll");
  const toiletTypeLabel = (type: ChildToiletType) => t(type === "WET" ? "operations.wet" : type === "SOILED" ? "operations.soiled" : "operations.toiletAttempt");
  const createInput = (): CreateChildCareLogInput | null => {
    if (!form) return null;
    const occurredAt = new Date().toISOString();
    const correction = form.correctsLogId ? { correctsLogId: form.correctsLogId, correctionReason: form.correctionReason.trim() || undefined } : {};
    if (form.type === "MEAL") return { type: form.type, occurredAt, mealType: form.mealType, mealAmount: form.mealAmount, note: form.note.trim() || undefined, ...correction };
    if (form.type === "NAP") {
      const napStartedAt = dateFromIsoTime(form.napStartedAt).toISOString();
      const napEndedAt = dateFromIsoTime(form.napEndedAt).toISOString();
      if (new Date(napEndedAt) <= new Date(napStartedAt)) return null;
      return { type: form.type, occurredAt, napStartedAt, napEndedAt, note: form.note.trim() || undefined, ...correction };
    }
    return { type: form.type, occurredAt, toiletType: form.toiletType, note: form.note.trim() || undefined, ...correction };
  };
  const save = () => {
    const input = createInput();
    if (!input || (form?.correctsLogId && !form.correctionReason.trim())) return notify(t("operations.careSaveFailed"), form?.correctsLogId ? t("operations.correctionReason") : undefined, "warning");
    void create.mutateAsync(input).catch((error: unknown) => notify(t("operations.careSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };

  return <AppScreen showBottomNavigation={false} title={t("operations.careLogs")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canRecord ? <FloatingActionButton icon="add" accessibilityLabel={t("operations.addCareLog")} onPress={() => setForm(initialForm())}>{t("operations.addCareLog")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("operations.careLogsDescription")}</AppText>
    {logs.isLoading && <ShimmerList />}
    {logs.isError && !logs.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void logs.refetch()} />}
    {!logs.isLoading && !logs.isError && logs.data?.map((log) => <CareLogCard key={log.id} log={log} formatDateTime={formatDateTime} typeLabel={typeLabel} mealTypeLabel={mealTypeLabel} mealAmountLabel={mealAmountLabel} toiletTypeLabel={toiletTypeLabel} canCorrect={canRecord && !log.correctsLogId} correctLabel={t("operations.correctCareLog")} onCorrect={() => setForm(initialForm(log))} />)}
    {!logs.isLoading && !logs.isError && logs.data?.length === 0 && <EmptyState icon="restaurant-outline" title={t("operations.careEmpty")} action={canRecord ? { label: t("operations.addCareLog"), onPress: () => setForm(initialForm()) } : undefined} />}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t(form?.correctsLogId ? "operations.correctCareLog" : "operations.addCareLog")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("common.save"), loading: create.isPending, onPress: save }}>
      <View style={styles.field}><AppText variant="label">{t("operations.careType")}</AppText><ChipGroup accessibilityLabel={t("operations.careType")}>{careTypes.map((type) => <Chip key={type} label={typeLabel(type)} selected={form?.type === type} onPress={() => setForm((current) => current ? { ...current, type } : current)} />)}</ChipGroup></View>
      {form?.type === "MEAL" && <><View style={styles.field}><AppText variant="label">{t("operations.mealType")}</AppText><ChipGroup accessibilityLabel={t("operations.mealType")}>{mealTypes.map((type) => <Chip key={type} label={mealTypeLabel(type)} selected={form.mealType === type} onPress={() => setForm((current) => current ? { ...current, mealType: type } : current)} />)}</ChipGroup></View><View style={styles.field}><AppText variant="label">{t("operations.mealAmount")}</AppText><ChipGroup accessibilityLabel={t("operations.mealAmount")}>{mealAmounts.map((amount) => <Chip key={amount} label={mealAmountLabel(amount)} selected={form.mealAmount === amount} onPress={() => setForm((current) => current ? { ...current, mealAmount: amount } : current)} />)}</ChipGroup></View></>}
      {form?.type === "NAP" && <View style={styles.timeRow}><View style={styles.timeField}><AppText variant="label">{t("operations.napStartedAt")}</AppText><DatePicker mode="time" placeholder={t("operations.napStartedAt")} value={form.napStartedAt} onChange={(napStartedAt) => setForm((current) => current ? { ...current, napStartedAt } : current)} /></View><View style={styles.timeField}><AppText variant="label">{t("operations.napEndedAt")}</AppText><DatePicker mode="time" placeholder={t("operations.napEndedAt")} value={form.napEndedAt} onChange={(napEndedAt) => setForm((current) => current ? { ...current, napEndedAt } : current)} /></View></View>}
      {form?.type === "TOILET" && <View style={styles.field}><AppText variant="label">{t("operations.toiletType")}</AppText><ChipGroup accessibilityLabel={t("operations.toiletType")}>{toiletTypes.map((type) => <Chip key={type} label={toiletTypeLabel(type)} selected={form.toiletType === type} onPress={() => setForm((current) => current ? { ...current, toiletType: type } : current)} />)}</ChipGroup></View>}
      <TextField label={t("operations.note")} value={form?.note ?? ""} onChangeText={(note) => setForm((current) => current ? { ...current, note } : current)} multiline maxLength={500} />
      {form?.correctsLogId && <TextField label={t("operations.correctionReason")} required value={form.correctionReason} onChangeText={(correctionReason) => setForm((current) => current ? { ...current, correctionReason } : current)} multiline maxLength={500} />}
    </BottomSheet>
  </AppScreen>;
}

function CareLogCard({ log, formatDateTime, typeLabel, mealTypeLabel, mealAmountLabel, toiletTypeLabel, canCorrect, correctLabel, onCorrect }: { log: ChildCareLog; formatDateTime: (value: string | Date) => string; typeLabel: (type: ChildCareLogType) => string; mealTypeLabel: (type: ChildMealType) => string; mealAmountLabel: (amount: ChildMealAmount) => string; toiletTypeLabel: (type: ChildToiletType) => string; canCorrect: boolean; correctLabel: string; onCorrect: () => void }) {
  const detail = log.type === "MEAL" ? `${mealTypeLabel(log.mealType!)} · ${mealAmountLabel(log.mealAmount!)}` : log.type === "NAP" ? `${formatDateTime(log.napStartedAt!)} – ${formatDateTime(log.napEndedAt!)}` : toiletTypeLabel(log.toiletType!);
  const icon = log.type === "MEAL" ? "restaurant-outline" : log.type === "NAP" ? "moon-outline" : "water-outline";
  const tone: Tone = log.type === "MEAL" ? "success" : log.type === "NAP" ? "info" : "warning";
  return <Card icon={icon} title={typeLabel(log.type)} subtitle={formatDateTime(log.occurredAt)} trailing={<Ionicons name="checkmark-circle" color={tone === "warning" ? colors.warning : colors.success} size={20} />}><AppText>{detail}</AppText>{log.note && <AppText tone="muted">{log.note}</AppText>}{log.correctionReason && <AppText variant="caption" tone="muted">{correctLabel}: {log.correctionReason}</AppText>}{canCorrect && <Button variant="secondary" onPress={onCorrect}>{correctLabel}</Button>}</Card>;
}

const styles = StyleSheet.create({ field: { gap: spacing.xs }, timeRow: { flexDirection: "row", gap: spacing.sm }, timeField: { flex: 1, gap: spacing.xs } });
