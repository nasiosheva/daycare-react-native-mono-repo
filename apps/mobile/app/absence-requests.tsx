import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { childAbsencePurposes, type ChildAbsencePurpose } from "@daycare/core";
import type { ChildAbsenceRequest } from "@daycare/api-client";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, Badge, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TabBar, TextField, spacing, type Tone } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { useParentOperationalChild } from "@/parent/useParentOperationalChild";

type FormState = { purpose: ChildAbsencePurpose; startDate: string; endDate: string; note: string };
type DecisionState = { request: ChildAbsenceRequest; approved: boolean };

const purposeKeys: Record<ChildAbsencePurpose, "absence.purpose.SICK" | "absence.purpose.OUT_OF_TOWN" | "absence.purpose.FAMILY_EVENT" | "absence.purpose.EMERGENCY" | "absence.purpose.OTHER"> = {
  SICK: "absence.purpose.SICK",
  OUT_OF_TOWN: "absence.purpose.OUT_OF_TOWN",
  FAMILY_EVENT: "absence.purpose.FAMILY_EVENT",
  EMERGENCY: "absence.purpose.EMERGENCY",
  OTHER: "absence.purpose.OTHER",
};

const defaultForm = (): FormState => {
  const today = formatIsoDate(new Date());
  return { purpose: "SICK", startDate: today, endDate: today, note: "" };
};

export default function AbsenceRequestsScreen() {
  const router = useRouter();
  const { childId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  // A Parent can open this screen for a child in a tenant that isn't the active one; Staff/Staff
  // Admin never pass this param, so they keep resolving to the active tenant as before.
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isParent = membership?.role === "PARENT";
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const isStaff = membership?.role === "STAFF";
  const readOnly = membership?.active === false;
  const { hasActiveEntitlement } = useParentOperationalChild(childId, organizationId);
  const parentCanMutate = isParent && !readOnly && hasActiveEntitlement;
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancelRequest, setCancelRequest] = useState<ChildAbsenceRequest | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [filterBranchId, setFilterBranchId] = useState<string>();

  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: isStaffAdmin && Boolean(organizationId) });
  const requests = useQuery({
    queryKey: ["child-absence-requests", organizationId, isParent ? childId : undefined, isStaffAdmin ? filterBranchId : undefined],
    queryFn: () => api.childAbsenceRequests(isParent ? { childId } : isStaffAdmin ? { branchId: filterBranchId } : {}, organizationId),
    enabled: Boolean(organizationId) && ((isParent && Boolean(childId)) || isStaff || isStaffAdmin),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["child-absence-requests", organizationId] });
  const create = useMutation({ mutationFn: (input: FormState) => api.createChildAbsenceRequest({ childId: childId!, purpose: input.purpose, startDate: input.startDate, endDate: input.endDate, note: input.note.trim() || undefined }, organizationId), onSuccess: () => { invalidate(); setForm(null); } });
  const decide = useMutation({ mutationFn: ({ request, approved, reason }: { request: ChildAbsenceRequest; approved: boolean; reason: string }) => api.decideChildAbsenceRequest(request.id, { approved, rejectionReason: reason.trim() || undefined }, organizationId), onSuccess: () => { invalidate(); setDecision(null); } });
  const cancel = useMutation({ mutationFn: (request: ChildAbsenceRequest) => api.cancelChildAbsenceRequest(request.id, organizationId), onSuccess: () => { invalidate(); setCancelRequest(null); } });

  if (!profile) return null;
  if ((!isParent && !isStaff && !isStaffAdmin) || (isParent && !childId)) return <Redirect href="/home" />;

  const openForm = () => { setForm(defaultForm()); setFormError(null); };
  const submit = async () => {
    if (!form) return;
    if (form.purpose === "OTHER" && !form.note.trim()) { setFormError(t("absence.noteRequired")); return; }
    setFormError(null);
    try { await create.mutateAsync(form); }
    catch (error) { setFormError(error instanceof Error ? error.message : t("absence.submitFailed")); }
  };
  const openDecision = (request: ChildAbsenceRequest, approved: boolean) => { setDecision({ request, approved }); setDecisionError(null); setRejectionReason(""); };
  const submitDecision = async () => {
    if (!decision) return;
    if (!decision.approved && !rejectionReason.trim()) { setDecisionError(t("absence.rejectionRequired")); return; }
    setDecisionError(null);
    try { await decide.mutateAsync({ request: decision.request, approved: decision.approved, reason: rejectionReason }); }
    catch (error) { setDecisionError(error instanceof Error ? error.message : t("absence.decisionFailed")); }
  };
  const submitCancel = async () => {
    if (!cancelRequest) return;
    setCancelError(null);
    try { await cancel.mutateAsync(cancelRequest); }
    catch (error) { setCancelError(error instanceof Error ? error.message : t("absence.cancelFailed")); }
  };
  return <AppScreen showBottomNavigation={false} title={t("absence.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={parentCanMutate ? <FloatingActionButton icon="add" accessibilityLabel={t("absence.add")} onPress={openForm}>{t("absence.add")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("absence.description")}</AppText>
    {readOnly && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    {isStaffAdmin && <TabBar accessibilityLabel={t("absence.allBranches")} selected={filterBranchId ?? ""} onSelect={(key) => setFilterBranchId(key || undefined)} items={[{ key: "", label: t("absence.allBranches") }, ...(branches.data?.filter((branch) => branch.active).map((branch) => ({ key: branch.id, label: branch.name })) ?? [])]} />}
    {requests.isLoading && <ShimmerList />}
    {requests.isError && !requests.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void requests.refetch()} />}
    {!requests.isLoading && !requests.isError && requests.data?.map((request) => <RequestCard key={request.id} request={request} formatDate={formatDate} purposeLabel={t(purposeKeys[request.purpose])} statusLabel={t(`status.${request.status}` as Parameters<typeof t>[0])} statusTone={statusTone(request.status)} cancelLabel={t("absence.cancelRequest")} approveLabel={t("absence.approve")} rejectLabel={t("absence.reject")} isParent={isParent} canCancel={parentCanMutate} canDecide={!readOnly && (isStaff || isStaffAdmin)} onCancel={() => { setCancelRequest(request); setCancelError(null); }} onApprove={() => openDecision(request, true)} onReject={() => openDecision(request, false)} />)}
    {!requests.isLoading && !requests.isError && requests.data?.length === 0 && <EmptyState icon="calendar-outline" title={isParent ? t("absence.empty") : t("absence.noPending")} action={parentCanMutate ? { label: t("absence.add"), onPress: openForm } : undefined} />}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("absence.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("absence.submit"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <Banner tone="danger" title={formError} />}
      <View style={styles.field}><AppText variant="label">{t("absence.purpose")}</AppText><ChipGroup accessibilityLabel={t("absence.purpose")}>{childAbsencePurposes.map((purpose) => <Chip key={purpose} label={t(purposeKeys[purpose])} selected={form?.purpose === purpose} onPress={() => setForm((current) => current ? { ...current, purpose } : current)} />)}</ChipGroup></View>
      <View style={styles.field}><AppText variant="label">{t("absence.startDate")}</AppText><DatePicker placeholder={t("absence.startDate")} value={form?.startDate ?? ""} minimumDate={formatIsoDate(new Date())} maximumDate={form?.endDate || undefined} onChange={(startDate) => setForm((current) => current ? { ...current, startDate, endDate: current.endDate < startDate ? startDate : current.endDate } : current)} /></View>
      <View style={styles.field}><AppText variant="label">{t("absence.endDate")}</AppText><DatePicker placeholder={t("absence.endDate")} value={form?.endDate ?? ""} minimumDate={form?.startDate || formatIsoDate(new Date())} onChange={(endDate) => setForm((current) => current ? { ...current, endDate } : current)} /></View>
      <TextField label={t("absence.note")} required={form?.purpose === "OTHER"} hint={form?.purpose === "OTHER" ? t("absence.noteRequired") : undefined} multiline maxLength={500} value={form?.note ?? ""} onChangeText={(note) => setForm((current) => current ? { ...current, note } : current)} />
    </BottomSheet>

    <BottomSheet visible={decision !== null} onClose={() => setDecision(null)} closeAccessibilityLabel={t("common.close")} title={t("absence.review")} negativeAction={{ label: t("common.cancel"), onPress: () => setDecision(null) }} positiveAction={{ label: t(decision?.approved ? "absence.approve" : "absence.reject"), variant: decision?.approved ? "primary" : "danger", loading: decide.isPending, onPress: () => void submitDecision() }}>
      {decisionError && <Banner tone="danger" title={decisionError} />}
      {decision && <RequestSummary request={decision.request} formatDate={formatDate} purposeLabel={t(purposeKeys[decision.request.purpose])} />}
      {!decision?.approved && <TextField label={t("absence.rejectReason")} required multiline maxLength={500} value={rejectionReason} onChangeText={setRejectionReason} />}
    </BottomSheet>

    <BottomSheet visible={cancelRequest !== null} onClose={() => setCancelRequest(null)} closeAccessibilityLabel={t("common.close")} title={t("absence.cancelRequest")} negativeAction={{ label: t("common.cancel"), onPress: () => setCancelRequest(null) }} positiveAction={{ label: t("absence.cancelRequest"), variant: "danger", loading: cancel.isPending, onPress: () => void submitCancel() }}>
      {cancelError && <Banner tone="danger" title={cancelError} />}
      <AppText tone="muted">{t("absence.cancelConfirm")}</AppText>
    </BottomSheet>
  </AppScreen>;
}

function RequestCard({ request, formatDate, purposeLabel, statusLabel, statusTone: tone, cancelLabel, approveLabel, rejectLabel, isParent, canCancel, canDecide, onCancel, onApprove, onReject }: { request: ChildAbsenceRequest; formatDate: (value: string) => string; purposeLabel: string; statusLabel: string; statusTone: Tone; cancelLabel: string; approveLabel: string; rejectLabel: string; isParent: boolean; canCancel: boolean; canDecide: boolean; onCancel: () => void; onApprove: () => void; onReject: () => void }) {
  return <Card>
    <View style={styles.cardHeader}><View style={styles.grow}><RequestSummary request={request} formatDate={formatDate} purposeLabel={purposeLabel} /></View><Badge tone={tone} label={statusLabel} /></View>
    {request.rejectionReason && <Banner tone="danger" title={request.rejectionReason} />}
    {canCancel && request.status === "PENDING" && <Button variant="danger" onPress={onCancel}>{cancelLabel}</Button>}
    {!isParent && canDecide && request.status === "PENDING" && <View style={styles.actions}><Button style={styles.action} variant="secondary" onPress={onReject}>{rejectLabel}</Button><Button style={styles.action} onPress={onApprove}>{approveLabel}</Button></View>}
  </Card>;
}

function RequestSummary({ request, formatDate, purposeLabel }: { request: ChildAbsenceRequest; formatDate: (value: string) => string; purposeLabel: string }) {
  return <View style={styles.summary}><AppText variant="heading">{request.childName}</AppText><AppText>{purposeLabel}</AppText><AppText tone="muted">{formatDate(request.startDate)} – {formatDate(request.endDate)}</AppText>{request.note && <AppText tone="muted">{request.note}</AppText>}</View>;
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  grow: { flex: 1 },
  summary: { gap: spacing.xs },
  field: { gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
});
