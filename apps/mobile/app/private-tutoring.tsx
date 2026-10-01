import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServicePlanType } from "@daycare/core";
import type { PrivateTutoringRequest, PrivateTutoringService } from "@daycare/api-client";
import { AppText, Badge, BackButton, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, NavigationCard, SearchField, SectionHeader, ShimmerList, TextField, colors, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { statusTone } from "@/ui/statusTone";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useParentChildrenAcrossTenants } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { pricingOptions } from "@/private-tutoring/pricingOptions";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { useAnyMembershipHasOffering } from "@/education/useUiAccessContext";

export default function PrivateTutoringScreen() {
  const router = useRouter(); const { api, profile } = useAuth(); const { t, formatCurrency, formatDate } = useI18n(); const client = useQueryClient();
  // A Parent's children can belong to different tenants; the child picked below decides which
  // tenant's services/requests load and which tenant a request targets — no active-tenant switch
  // is needed for any of it (per-action tenant resolution, docs/business-rules.md §1).
  const parentMemberships = (profile?.memberships ?? []).filter((item) => item.role === "PARENT" && item.active);
  const showsTenantLabel = parentMemberships.length > 1;
  const children = useParentChildrenAcrossTenants(parentMemberships, true);
  const [childId, setChildId] = useState<string>(); const [search, setSearch] = useState(""); const [selected, setSelected] = useState<PrivateTutoringService>(); const [pricingType, setPricingType] = useState<ServicePlanType>(); const [preferredDate, setPreferredDate] = useState(""); const [preferredTime, setPreferredTime] = useState(""); const [note, setNote] = useState("");
  const selectedOrganizationId = children.data.find((child) => child.id === childId)?.organizationId;
  // Whether the Parent can use private tutoring AT ALL is checked across every tenant they belong
  // to, not just the active one, so this entry gate can't block a tenant that isn't currently
  // active (the same cross-tenant principle applied to LegacyDaycareRouteGuard).
  const access = useAnyMembershipHasOffering(parentMemberships, "ACADEMIC_CURRICULUM", Boolean(profile));
  const canUsePrivateTutoring = access.hasCapability;
  const services = useQuery({ queryKey: ["private-tutoring-services", selectedOrganizationId, childId], queryFn: () => api.parentPrivateTutoringServices(childId!, selectedOrganizationId), enabled: Boolean(selectedOrganizationId && childId) });
  const requests = useQuery({ queryKey: ["private-tutoring-requests", selectedOrganizationId], queryFn: () => api.parentPrivateTutoringRequests(selectedOrganizationId), enabled: Boolean(selectedOrganizationId) });
  const refresh = (targetOrganizationId?: string) => { for (const resource of ["private-tutoring-services", "private-tutoring-requests", "invoices"]) void client.invalidateQueries({ queryKey: [resource, targetOrganizationId] }); };
  const create = useMutation({ mutationFn: ({ serviceId, organizationId, input }: { serviceId: string; organizationId?: string; input: { childId: string; pricingType: ServicePlanType; preferredAt?: string; note?: string } }) => api.createParentPrivateTutoringRequest(serviceId, input, organizationId), onSuccess: (_, variables) => refresh(variables.organizationId) });
  const cancel = useMutation({ mutationFn: ({ requestId, organizationId }: { requestId: string; organizationId?: string }) => api.cancelParentPrivateTutoringRequest(requestId, organizationId), onSuccess: (_, variables) => refresh(variables.organizationId) });
  const visibleServices = useMemo(() => services.data?.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [], [search, services.data]);
  if (!profile) return null; if (parentMemberships.length === 0 || (!access.isLoading && !canUsePrivateTutoring)) return <Redirect href="/home" />;
  const openService = (service: PrivateTutoringService) => { setSelected(service); setPricingType(pricingOptions(service)[0]?.type); };
  const closeSheet = () => { setSelected(undefined); setPricingType(undefined); setPreferredDate(""); setPreferredTime(""); setNote(""); };
  const submit = async () => { if (!selected || !childId || !pricingType || !selectedOrganizationId) return; try { await create.mutateAsync({ serviceId: selected.id, organizationId: selectedOrganizationId, input: { childId, pricingType, preferredAt: preferredDate && preferredTime ? `${preferredDate}T${preferredTime}` : undefined, note: note.trim() || undefined } }); closeSheet(); } catch (error) { notify(t("privateTutoring.submitFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); } };
  const cancelRequest = async (request: PrivateTutoringRequest) => { try { await cancel.mutateAsync({ requestId: request.id, organizationId: selectedOrganizationId }); } catch (error) { notify(t("privateTutoring.cancelFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); } };
  return <AppScreen showBottomNavigation={false} title={t("privateTutoring.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText tone="muted">{t("privateTutoring.description")}</AppText><SectionHeader title={t("privateTutoring.child")} />
    <ChipGroup accessibilityLabel={t("privateTutoring.child")}>{children.data.map((child) => <Chip key={child.id} label={showsTenantLabel ? `${child.fullName} (${child.organizationName})` : child.fullName} selected={childId === child.id} onPress={() => setChildId(child.id)} />)}</ChipGroup>
    {!childId && children.data?.length ? <AppText variant="caption" tone="muted">{t("privateTutoring.chooseChildFirst")}</AppText> : null}
    {childId && <><SearchField accessibilityLabel={t("privateTutoring.search")} placeholder={t("privateTutoring.search")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} /><SectionHeader title={t("privateTutoring.services")} />
      {services.isFetching && <ShimmerList />}{!services.isFetching && visibleServices.map((service) => <NavigationCard key={service.id} accessibilityLabel={service.name} onPress={() => openService(service)}><AppText variant="h5">{service.name}</AppText><AppText tone="muted">{service.description}</AppText><View style={styles.meta}><Badge icon="happy-outline" label={t("privateTutoring.age", { min: service.minAgeMonths, max: service.maxAgeMonths })} /><Badge icon="time-outline" label={t("privateTutoring.duration", { count: service.durationMinutes })} /></View>{pricingOptions(service).map((option) => <AppText key={option.type} variant="label" style={styles.price}>{formatCurrency(option.price)} · {t(servicePlanTypeKey(option.type))}</AppText>)}</NavigationCard>)}
      {!services.isFetching && visibleServices.length === 0 && <EmptyState compact icon="school-outline" title={t("privateTutoring.empty")} />}</>}
    <SectionHeader title={t("privateTutoring.requests")} />{requests.isFetching && <ShimmerList />}{requests.data?.map((request) => <Card key={request.id} title={request.serviceName} subtitle={request.childName} trailing={<Badge tone={statusTone(request.status)} label={requestStatus(t, request.status)} />}>{request.providerName && <AppText tone="muted">{t("privateTutoring.provider", { name: request.providerName })}</AppText>}{request.scheduledAt && <AppText tone="muted">{formatDate(request.scheduledAt.slice(0, 10))}</AppText>}{request.status === "PENDING_PAYMENT" && request.invoiceId && <Button onPress={() => router.push({ pathname: "/parent-payment", params: { invoiceId: request.invoiceId, ...(selectedOrganizationId ? { organizationId: selectedOrganizationId } : {}) } })}>{t("privateTutoring.pay")}</Button>}{["PENDING_APPROVAL", "PENDING_PAYMENT"].includes(request.status) && <Button variant="secondary" onPress={() => void cancelRequest(request)}>{t("privateTutoring.cancel")}</Button>}</Card>)}{!requests.isFetching && requests.data?.length === 0 && <EmptyState compact icon="document-text-outline" title={t("privateTutoring.noRequests")} />}
    <BottomSheet visible={Boolean(selected)} onClose={closeSheet} closeAccessibilityLabel={t("common.close")} title={selected?.name ?? ""} negativeAction={{ label: t("common.cancel"), onPress: closeSheet }} positiveAction={{ label: t("privateTutoring.submit"), disabled: !pricingType, loading: create.isPending, onPress: () => void submit() }}><View style={styles.sheet}>
      <AppText variant="label">{t("privateTutoring.pricingType")}</AppText>
      <ChipGroup accessibilityLabel={t("privateTutoring.pricingType")}>{selected && pricingOptions(selected).map((option) => <Chip key={option.type} label={`${formatCurrency(option.price)} · ${t(servicePlanTypeKey(option.type))}`} selected={pricingType === option.type} onPress={() => setPricingType(option.type)} />)}</ChipGroup>
      <AppText variant="label">{t("privateTutoring.preferredSchedule")}</AppText>
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleField}><DatePicker mode="date" placeholder={t("privateTutoring.preferredDate")} value={preferredDate} minimumDate={formatIsoDate(new Date())} onChange={setPreferredDate} onClear={() => setPreferredDate("")} clearAccessibilityLabel={t("common.clear")} /></View>
        <View style={styles.scheduleField}><DatePicker mode="time" placeholder={t("privateTutoring.preferredTime")} value={preferredTime} onChange={setPreferredTime} onClear={() => setPreferredTime("")} clearAccessibilityLabel={t("common.clear")} /></View>
      </View>
      <TextField label={t("privateTutoring.note")} multiline value={note} onChangeText={setNote} />
    </View></BottomSheet>
  </View></AppScreen>;
}

function requestStatus(t: ReturnType<typeof useI18n>["t"], status: PrivateTutoringRequest["status"]) { const keys = { PENDING_APPROVAL: "privateTutoring.pendingApproval", PENDING_PAYMENT: "privateTutoring.pendingPayment", CONFIRMED: "privateTutoring.confirmed", REJECTED: "privateTutoring.rejected", CANCELLED: "privateTutoring.cancelled" } as const; return t(keys[status]); }
const styles = StyleSheet.create({ content: { gap: spacing.md }, meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, price: { color: colors.primary }, sheet: { gap: spacing.md }, scheduleRow: { flexDirection: "row", gap: spacing.sm }, scheduleField: { flex: 1 } });
