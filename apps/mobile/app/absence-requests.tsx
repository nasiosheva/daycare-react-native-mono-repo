import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { childAbsencePurposes, type ChildAbsencePurpose } from "@daycare/core";
import type { ChildAbsenceRequest } from "@daycare/api-client";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";

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
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isParent = membership?.role === "PARENT";
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const isStaff = membership?.role === "STAFF";
  const readOnly = membership?.active === false;
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
    queryFn: () => api.childAbsenceRequests(isParent ? { childId } : isStaffAdmin ? { branchId: filterBranchId } : {}),
    enabled: Boolean(organizationId) && ((isParent && Boolean(childId)) || isStaff || isStaffAdmin),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["child-absence-requests", organizationId] });
  const create = useMutation({ mutationFn: (input: FormState) => api.createChildAbsenceRequest({ childId: childId!, purpose: input.purpose, startDate: input.startDate, endDate: input.endDate, note: input.note.trim() || undefined }), onSuccess: () => { invalidate(); setForm(null); } });
  const decide = useMutation({ mutationFn: ({ request, approved, reason }: { request: ChildAbsenceRequest; approved: boolean; reason: string }) => api.decideChildAbsenceRequest(request.id, { approved, rejectionReason: reason.trim() || undefined }), onSuccess: () => { invalidate(); setDecision(null); } });
  const cancel = useMutation({ mutationFn: (request: ChildAbsenceRequest) => api.cancelChildAbsenceRequest(request.id), onSuccess: () => { invalidate(); setCancelRequest(null); } });

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
  return <AppScreen showBottomNavigation={false} title={t("absence.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("absence.description")}</AppText>
    {readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {isParent && !readOnly && <Button onPress={openForm}>{t("absence.add")}</Button>}
    {isStaffAdmin && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <BranchTab label={t("absence.allBranches")} selected={!filterBranchId} onPress={() => setFilterBranchId(undefined)} />
      {branches.data?.filter((branch) => branch.active).map((branch) => <BranchTab key={branch.id} label={branch.name} selected={filterBranchId === branch.id} onPress={() => setFilterBranchId(branch.id)} />)}
    </ScrollView>}
    {requests.isLoading && <ShimmerList />}
    {requests.isError && <Button variant="secondary" onPress={() => requests.refetch()}>{t("common.retry")}</Button>}
    {!requests.isLoading && !requests.isError && requests.data?.map((request) => <RequestCard key={request.id} request={request} formatDate={formatDate} purposeLabel={t(purposeKeys[request.purpose])} statusLabel={t(`status.${request.status}` as Parameters<typeof t>[0])} cancelLabel={t("absence.cancelRequest")} approveLabel={t("absence.approve")} rejectLabel={t("absence.reject")} isParent={isParent} canCancel={isParent && !readOnly} canDecide={!readOnly && (isStaff || isStaffAdmin)} onCancel={() => { setCancelRequest(request); setCancelError(null); }} onApprove={() => openDecision(request, true)} onReject={() => openDecision(request, false)} />)}
    {!requests.isLoading && !requests.isError && requests.data?.length === 0 && <AppText tone="muted">{isParent ? t("absence.empty") : t("absence.noPending")}</AppText>}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("absence.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("absence.submit"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <AppText accessibilityRole="alert" tone="danger">{formError}</AppText>}
      <View style={styles.field}><AppText variant="label">{t("absence.purpose")}</AppText><View style={styles.purposeList}>{childAbsencePurposes.map((purpose) => <Button key={purpose} variant={form?.purpose === purpose ? "primary" : "secondary"} onPress={() => setForm((current) => current ? { ...current, purpose } : current)}>{t(purposeKeys[purpose])}</Button>)}</View></View>
      <View style={styles.field}><AppText variant="label">{t("absence.startDate")}</AppText><DatePicker placeholder={t("absence.startDate")} value={form?.startDate ?? ""} minimumDate={formatIsoDate(new Date())} maximumDate={form?.endDate || undefined} onChange={(startDate) => setForm((current) => current ? { ...current, startDate, endDate: current.endDate < startDate ? startDate : current.endDate } : current)} /></View>
      <View style={styles.field}><AppText variant="label">{t("absence.endDate")}</AppText><DatePicker placeholder={t("absence.endDate")} value={form?.endDate ?? ""} minimumDate={form?.startDate || formatIsoDate(new Date())} onChange={(endDate) => setForm((current) => current ? { ...current, endDate } : current)} /></View>
      <View style={styles.field}><AppText variant="label">{t("absence.note")}</AppText><TextInput style={styles.input} multiline maxLength={500} placeholder={t("absence.note")} value={form?.note ?? ""} onChangeText={(note) => setForm((current) => current ? { ...current, note } : current)} /></View>
    </BottomSheet>

    <BottomSheet visible={decision !== null} onClose={() => setDecision(null)} closeAccessibilityLabel={t("common.close")} title={t("absence.review")} negativeAction={{ label: t("common.cancel"), onPress: () => setDecision(null) }} positiveAction={{ label: t(decision?.approved ? "absence.approve" : "absence.reject"), variant: decision?.approved ? "primary" : "danger", loading: decide.isPending, onPress: () => void submitDecision() }}>
      {decisionError && <AppText accessibilityRole="alert" tone="danger">{decisionError}</AppText>}
      {decision && <RequestSummary request={decision.request} formatDate={formatDate} purposeLabel={t(purposeKeys[decision.request.purpose])} />}
      {!decision?.approved && <View style={styles.field}><AppText variant="label">{t("absence.rejectReason")}</AppText><TextInput style={styles.input} multiline maxLength={500} placeholder={t("absence.rejectReason")} value={rejectionReason} onChangeText={setRejectionReason} /></View>}
    </BottomSheet>

    <BottomSheet visible={cancelRequest !== null} onClose={() => setCancelRequest(null)} closeAccessibilityLabel={t("common.close")} title={t("absence.cancelRequest")} negativeAction={{ label: t("common.cancel"), onPress: () => setCancelRequest(null) }} positiveAction={{ label: t("absence.cancelRequest"), variant: "danger", loading: cancel.isPending, onPress: () => void submitCancel() }}>
      {cancelError && <AppText accessibilityRole="alert" tone="danger">{cancelError}</AppText>}
      <AppText tone="muted">{t("absence.cancelConfirm")}</AppText>
    </BottomSheet>
  </AppScreen>;
}

function BranchTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}><AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText></Pressable>;
}

function RequestCard({ request, formatDate, purposeLabel, statusLabel, cancelLabel, approveLabel, rejectLabel, isParent, canCancel, canDecide, onCancel, onApprove, onReject }: { request: ChildAbsenceRequest; formatDate: (value: string) => string; purposeLabel: string; statusLabel: string; cancelLabel: string; approveLabel: string; rejectLabel: string; isParent: boolean; canCancel: boolean; canDecide: boolean; onCancel: () => void; onApprove: () => void; onReject: () => void }) {
  return <View style={styles.card}>
    <RequestSummary request={request} formatDate={formatDate} purposeLabel={purposeLabel} />
    <AppText variant="caption" tone="muted">{statusLabel}</AppText>
    {request.rejectionReason && <AppText tone="danger">{request.rejectionReason}</AppText>}
    {canCancel && request.status === "PENDING" && <Button variant="danger" onPress={onCancel}>{cancelLabel}</Button>}
    {!isParent && canDecide && request.status === "PENDING" && <View style={styles.actions}><Button style={styles.action} onPress={onApprove}>{approveLabel}</Button><Button style={styles.action} variant="danger" onPress={onReject}>{rejectLabel}</Button></View>}
  </View>;
}

function RequestSummary({ request, formatDate, purposeLabel }: { request: ChildAbsenceRequest; formatDate: (value: string) => string; purposeLabel: string }) {
  return <View style={styles.summary}><AppText variant="heading">{request.childName}</AppText><AppText>{purposeLabel}</AppText><AppText tone="muted">{formatDate(request.startDate)} – {formatDate(request.endDate)}</AppText>{request.note && <AppText tone="muted">{request.note}</AppText>}</View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  summary: { gap: spacing.xs },
  field: { gap: spacing.xs },
  input: { minHeight: 48, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, textAlignVertical: "top" },
  purposeList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
});
