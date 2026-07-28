import { useState } from "react";
import { Image, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffLeaveRequestTypes, type StaffLeaveRequestType } from "@daycare/core";
import type { StaffLeaveRequest } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";

type FormState = { type: StaffLeaveRequestType; startsOn: string; endsOn: string; reason: string; evidence: PickedImage | null };

const maximumEvidenceBytes = 5 * 1024 * 1024;
const defaultForm = (): FormState => {
  const today = formatIsoDate(new Date());
  return { type: "LEAVE", startsOn: today, endsOn: today, reason: "", evidence: null };
};

export default function StaffLeaveRequestsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const imagePicker = useImagePicker();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canCreate = membership?.role === "STAFF" && membership.active;
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<StaffLeaveRequest | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const requests = useQuery({ queryKey: ["staff-leave-requests", organizationId], queryFn: () => api.staffLeaveRequests(), enabled: membership?.role === "STAFF" && Boolean(organizationId) });
  const evidence = useQuery({ queryKey: ["staff-leave-evidence", organizationId, evidenceId], queryFn: () => api.staffLeaveRequestEvidence(evidenceId!), enabled: Boolean(evidenceId) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["staff-leave-requests", organizationId] });
  const create = useMutation({ mutationFn: async (input: FormState) => api.createStaffLeaveRequest({ type: input.type, startsOn: input.startsOn, endsOn: input.endsOn, reason: input.reason.trim(), evidence: input.evidence ? { contentType: input.evidence.mimeType === "image/png" ? "image/png" : "image/jpeg", dataBase64: await encodeLocalFileBase64(input.evidence.uri) } : undefined }), onSuccess: () => { invalidate(); setForm(null); } });
  const cancel = useMutation({ mutationFn: (request: StaffLeaveRequest) => api.cancelStaffLeaveRequest(request.id), onSuccess: () => { invalidate(); setCancelling(null); } });

  if (!profile) return null;
  if (membership?.role !== "STAFF") return <Redirect href="/home" />;

  const selectEvidence = async (source: "library" | "camera") => {
    const image = source === "library" ? (await imagePicker.pickFromLibrary())[0] ?? null : await imagePicker.takePhoto();
    if (!image) return;
    if ((image.fileSizeBytes ?? 0) > maximumEvidenceBytes) { setFormError(t("staffLeave.evidenceTooLarge")); return; }
    setForm((current) => current ? { ...current, evidence: image } : current);
  };
  const submit = async () => {
    if (!form) return;
    if (!form.reason.trim()) { setFormError(t("staffLeave.reasonRequired")); return; }
    setFormError(null);
    try { await create.mutateAsync(form); }
    catch (error) { setFormError(error instanceof Error ? error.message : t("staffLeave.submitFailed")); }
  };
  const submitCancel = async () => {
    if (!cancelling) return;
    setCancelError(null);
    try { await cancel.mutateAsync(cancelling); }
    catch (error) { setCancelError(error instanceof Error ? error.message : t("staffLeave.cancelFailed")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("staffLeave.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canCreate ? <FloatingActionButton accessibilityLabel={t("staffLeave.add")} onPress={() => { setForm(defaultForm()); setFormError(null); }}>+ {t("staffLeave.add")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("staffLeave.description")}</AppText>
    {!membership.active && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {requests.isLoading && <ShimmerList />}
    {requests.isError && <Button variant="secondary" onPress={() => requests.refetch()}>{t("common.retry")}</Button>}
    {!requests.isLoading && !requests.isError && requests.data?.map((request) => <View key={request.id} style={styles.card}>
      <AppText variant="heading">{t(typeKey(request.type))}</AppText>
      <AppText tone="muted">{formatDate(request.startsOn)} – {formatDate(request.endsOn)}</AppText>
      <AppText>{request.reason}</AppText>
      <AppText variant="caption" tone="muted">{t(statusKey(request.status))}</AppText>
      {request.rejectionReason && <AppText tone="danger">{request.rejectionReason}</AppText>}
      {request.hasEvidence && <Button variant="secondary" onPress={() => setEvidenceId(request.id)}>{t("staffLeave.viewEvidence")}</Button>}
      {canCreate && request.status === "PENDING" && <Button variant="danger" onPress={() => { setCancelling(request); setCancelError(null); }}>{t("staffLeave.cancel")}</Button>}
    </View>)}
    {!requests.isLoading && !requests.isError && requests.data?.length === 0 && <AppText tone="muted">{t("staffLeave.empty")}</AppText>}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("staffLeave.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("staffLeave.submit"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <AppText accessibilityRole="alert" tone="danger">{formError}</AppText>}
      <View style={styles.field}><AppText variant="label">{t("staffLeave.type")}</AppText><View style={styles.options}>{staffLeaveRequestTypes.map((type) => <Button key={type} variant={form?.type === type ? "primary" : "secondary"} onPress={() => setForm((current) => current ? { ...current, type } : current)}>{t(typeKey(type))}</Button>)}</View></View>
      <View style={styles.field}><AppText variant="label">{t("staffLeave.startDate")}</AppText><DatePicker placeholder={t("staffLeave.startDate")} value={form?.startsOn ?? ""} minimumDate={formatIsoDate(new Date())} maximumDate={form?.endsOn || undefined} onChange={(startsOn) => setForm((current) => current ? { ...current, startsOn, endsOn: current.endsOn < startsOn ? startsOn : current.endsOn } : current)} /></View>
      <View style={styles.field}><AppText variant="label">{t("staffLeave.endDate")}</AppText><DatePicker placeholder={t("staffLeave.endDate")} value={form?.endsOn ?? ""} minimumDate={form?.startsOn || formatIsoDate(new Date())} onChange={(endsOn) => setForm((current) => current ? { ...current, endsOn } : current)} /></View>
      <View style={styles.field}><AppText variant="label">{t("staffLeave.reason")}</AppText><TextInput style={styles.input} multiline maxLength={2_000} placeholder={t("staffLeave.reason")} value={form?.reason ?? ""} onChangeText={(reason) => setForm((current) => current ? { ...current, reason } : current)} /></View>
      <View style={styles.field}><AppText variant="label">{t("staffLeave.evidenceOptional")}</AppText><View style={styles.options}><Button variant="secondary" onPress={() => void selectEvidence("library")}>{t("staffLeave.upload")}</Button><Button variant="secondary" onPress={() => void selectEvidence("camera")}>{t("staffLeave.camera")}</Button></View>{form?.evidence && <Image source={{ uri: form.evidence.uri }} style={styles.preview} resizeMode="contain" />}{imagePicker.error && <AppText accessibilityRole="alert" tone="danger">{imagePicker.error.message}</AppText>}</View>
    </BottomSheet>

    <BottomSheet visible={cancelling !== null} onClose={() => setCancelling(null)} closeAccessibilityLabel={t("common.close")} title={t("staffLeave.cancel")} negativeAction={{ label: t("common.cancel"), onPress: () => setCancelling(null) }} positiveAction={{ label: t("staffLeave.cancel"), variant: "danger", loading: cancel.isPending, onPress: () => void submitCancel() }}>
      {cancelError && <AppText accessibilityRole="alert" tone="danger">{cancelError}</AppText>}<AppText tone="muted">{t("staffLeave.cancelConfirm")}</AppText>
    </BottomSheet>

    <BottomSheet visible={evidenceId !== null} onClose={() => setEvidenceId(null)} closeAccessibilityLabel={t("common.close")} title={t("staffLeave.evidence")}>
      {evidence.isLoading && <AppText tone="muted">{t("staffLeave.evidenceLoading")}</AppText>}
      {evidence.isError && <AppText accessibilityRole="alert" tone="danger">{t("staffLeave.evidenceLoadFailed")}</AppText>}
      {evidence.data && <Image source={{ uri: `data:${evidence.data.contentType};base64,${evidence.data.dataBase64}` }} style={styles.preview} resizeMode="contain" />}
    </BottomSheet>
  </AppScreen>;
}

function typeKey(type: StaffLeaveRequestType): TranslationKey { return `staffLeave.type.${type}` as TranslationKey; }
function statusKey(status: StaffLeaveRequest["status"]): TranslationKey { return `staffLeave.status.${status}` as TranslationKey; }

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  field: { gap: spacing.xs },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 96, padding: spacing.sm, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
