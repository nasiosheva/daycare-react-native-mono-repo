import { useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServicePlanType } from "@daycare/core";
import type { PrivateTutoringRequest, PrivateTutoringService } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { pricingOptions } from "@/private-tutoring/pricingOptions";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";

export default function PrivateTutoringScreen() {
  const router = useRouter(); const { api, profile, organizationId } = useAuth(); const { t, formatCurrency, formatDate } = useI18n(); const client = useQueryClient();
  const children = useChildren(); const [childId, setChildId] = useState<string>(); const [search, setSearch] = useState(""); const [selected, setSelected] = useState<PrivateTutoringService>(); const [pricingType, setPricingType] = useState<ServicePlanType>(); const [preferredDate, setPreferredDate] = useState(""); const [preferredTime, setPreferredTime] = useState(""); const [note, setNote] = useState("");
  const services = useQuery({ queryKey: ["private-tutoring-services", organizationId, childId], queryFn: () => api.parentPrivateTutoringServices(childId!), enabled: Boolean(organizationId && childId) });
  const requests = useQuery({ queryKey: ["private-tutoring-requests", organizationId], queryFn: () => api.parentPrivateTutoringRequests(), enabled: Boolean(organizationId) });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["private-tutoring-services", organizationId] }); void client.invalidateQueries({ queryKey: ["private-tutoring-requests", organizationId] }); void client.invalidateQueries({ queryKey: ["invoices", organizationId] }); };
  const create = useMutation({ mutationFn: ({ serviceId, input }: { serviceId: string; input: { childId: string; pricingType: ServicePlanType; preferredAt?: string; note?: string } }) => api.createParentPrivateTutoringRequest(serviceId, input), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: (requestId: string) => api.cancelParentPrivateTutoringRequest(requestId), onSuccess: refresh });
  const visibleServices = useMemo(() => services.data?.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [], [search, services.data]);
  if (!profile) return null; if (!profile.memberships.some((item) => item.organizationId === organizationId && item.role === "PARENT" && item.active)) return <Redirect href="/home" />;
  const openService = (service: PrivateTutoringService) => { setSelected(service); setPricingType(pricingOptions(service)[0]?.type); };
  const closeSheet = () => { setSelected(undefined); setPricingType(undefined); setPreferredDate(""); setPreferredTime(""); setNote(""); };
  const submit = async () => { if (!selected || !childId || !pricingType) return; try { await create.mutateAsync({ serviceId: selected.id, input: { childId, pricingType, preferredAt: preferredDate && preferredTime ? `${preferredDate}T${preferredTime}` : undefined, note: note.trim() || undefined } }); closeSheet(); } catch (error) { Alert.alert(t("privateTutoring.submitFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const cancelRequest = async (request: PrivateTutoringRequest) => { try { await cancel.mutateAsync(request.id); } catch (error) { Alert.alert(t("privateTutoring.cancelFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  return <AppScreen showBottomNavigation={false} title={t("privateTutoring.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText tone="muted">{t("privateTutoring.description")}</AppText><AppText variant="heading">{t("privateTutoring.child")}</AppText>
    <View style={styles.options}>{children.data?.map((child) => <Button key={child.id} variant={childId === child.id ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>
    {childId && <><TextInput style={styles.input} placeholder={t("privateTutoring.search")} value={search} onChangeText={setSearch} /><AppText variant="heading">{t("privateTutoring.services")}</AppText>
      {services.isFetching && <ShimmerList />}{!services.isFetching && visibleServices.map((service) => <NavigationCard key={service.id} accessibilityLabel={service.name} onPress={() => openService(service)}><AppText variant="h5">{service.name}</AppText><AppText tone="muted">{service.description}</AppText><AppText variant="caption" tone="muted">{t("privateTutoring.age", { min: service.minAgeMonths, max: service.maxAgeMonths })} · {t("privateTutoring.duration", { count: service.durationMinutes })}</AppText>{pricingOptions(service).map((option) => <AppText key={option.type}>{formatCurrency(option.price)} · {t(servicePlanTypeKey(option.type))}</AppText>)}</NavigationCard>)}
      {!services.isFetching && visibleServices.length === 0 && <AppText tone="muted">{t("privateTutoring.empty")}</AppText>}</>}
    <AppText variant="heading">{t("privateTutoring.requests")}</AppText>{requests.isFetching && <ShimmerList />}{requests.data?.map((request) => <View key={request.id} style={styles.card}><AppText variant="label">{request.serviceName} · {request.childName}</AppText><AppText tone="muted">{requestStatus(t, request.status)}</AppText>{request.providerName && <AppText tone="muted">{t("privateTutoring.provider", { name: request.providerName })}</AppText>}{request.scheduledAt && <AppText tone="muted">{formatDate(request.scheduledAt.slice(0, 10))}</AppText>}{request.status === "PENDING_PAYMENT" && request.invoiceId && <Button onPress={() => router.push({ pathname: "/parent-payment", params: { invoiceId: request.invoiceId, ...(organizationId ? { organizationId } : {}) } })}>{t("privateTutoring.pay")}</Button>}{["PENDING_APPROVAL", "PENDING_PAYMENT"].includes(request.status) && <Button variant="secondary" onPress={() => void cancelRequest(request)}>{t("privateTutoring.cancel")}</Button>}</View>)}{!requests.isFetching && requests.data?.length === 0 && <AppText tone="muted">{t("privateTutoring.noRequests")}</AppText>}
    <BottomSheet visible={Boolean(selected)} onClose={closeSheet} closeAccessibilityLabel={t("common.close")} title={selected?.name ?? ""} negativeAction={{ label: t("common.cancel"), onPress: closeSheet }} positiveAction={{ label: t("privateTutoring.submit"), disabled: !pricingType, loading: create.isPending, onPress: () => void submit() }}><View style={styles.sheet}>
      <AppText variant="label">{t("privateTutoring.pricingType")}</AppText>
      <View style={styles.options}>{selected && pricingOptions(selected).map((option) => <Button key={option.type} variant={pricingType === option.type ? "primary" : "secondary"} onPress={() => setPricingType(option.type)}>{`${formatCurrency(option.price)} · ${t(servicePlanTypeKey(option.type))}`}</Button>)}</View>
      <AppText variant="caption" tone="muted">{t("privateTutoring.preferredSchedule")}</AppText>
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleField}><DatePicker mode="date" placeholder={t("privateTutoring.preferredDate")} value={preferredDate} minimumDate={formatIsoDate(new Date())} onChange={setPreferredDate} onClear={() => setPreferredDate("")} clearAccessibilityLabel={t("common.clear")} /></View>
        <View style={styles.scheduleField}><DatePicker mode="time" placeholder={t("privateTutoring.preferredTime")} value={preferredTime} onChange={setPreferredTime} onClear={() => setPreferredTime("")} clearAccessibilityLabel={t("common.clear")} /></View>
      </View>
      <TextInput style={[styles.input, styles.note]} multiline placeholder={t("privateTutoring.note")} value={note} onChangeText={setNote} />
    </View></BottomSheet>
  </View></AppScreen>;
}

function requestStatus(t: ReturnType<typeof useI18n>["t"], status: PrivateTutoringRequest["status"]) { const keys = { PENDING_APPROVAL: "privateTutoring.pendingApproval", PENDING_PAYMENT: "privateTutoring.pendingPayment", CONFIRMED: "privateTutoring.confirmed", REJECTED: "privateTutoring.rejected", CANCELLED: "privateTutoring.cancelled" } as const; return t(keys[status]); }
const styles = StyleSheet.create({ content: { gap: spacing.md }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, note: { minHeight: 96, paddingVertical: spacing.sm, textAlignVertical: "top" }, sheet: { gap: spacing.sm }, scheduleRow: { flexDirection: "row", gap: spacing.sm }, scheduleField: { flex: 1 } });
