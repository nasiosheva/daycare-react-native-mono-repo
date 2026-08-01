import { useState } from "react";
import { Image, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildIncidentReport, IncidentCategory, IncidentSeverity } from "@daycare/api-client";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";

const severities: IncidentSeverity[] = ["MINOR", "MODERATE", "SERIOUS"];
const categories: IncidentCategory[] = ["INJURY", "ILLNESS", "BEHAVIOR", "OTHER"];

type FormState = { severity: IncidentSeverity; category: IncidentCategory; description: string; actionTaken: string };
const defaultForm = (): FormState => ({ severity: "MINOR", category: "INJURY", description: "", actionTaken: "" });

export default function IncidentReportsScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isParent = membership?.role === "PARENT";
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const isStaff = membership?.role === "STAFF";
  const canCreate = membership?.active === true && (isStaffAdmin || isStaff);
  const canAcknowledge = isParent && membership?.active === true;
  const imagePicker = useImagePicker();
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [photoEntry, setPhotoEntry] = useState<ChildIncidentReport | null>(null);

  const reports = useQuery({ queryKey: ["child-incident-reports", organizationId, childId], queryFn: () => api.childIncidentReports(childId!), enabled: Boolean(organizationId && childId && membership) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["child-incident-reports", organizationId, childId] });
  const create = useMutation({
    mutationFn: async (input: FormState) => api.createChildIncidentReport(childId!, {
      severity: input.severity, category: input.category, description: input.description.trim(), actionTaken: input.actionTaken.trim() || undefined,
      occurredAt: new Date().toISOString(),
      photo: photo ? { contentType: photo.mimeType === "image/png" ? "image/png" : "image/jpeg", dataBase64: await encodeLocalFileBase64(photo.uri) } : undefined,
    }),
    onSuccess: () => { invalidate(); setForm(null); setPhoto(null); },
  });
  const acknowledge = useMutation({ mutationFn: (incidentId: string) => api.acknowledgeChildIncidentReport(childId!, incidentId), onSuccess: invalidate });
  const photoQuery = useQuery({ queryKey: ["child-incident-report-photo", organizationId, childId, photoEntry?.id], queryFn: () => api.childIncidentReportPhoto(childId!, photoEntry!.id), enabled: Boolean(childId && photoEntry) });

  if (!profile) return null;
  if ((!isParent && !isStaff && !isStaffAdmin) || !childId) return <Redirect href="/home" />;

  const severityLabel = (value: IncidentSeverity) => t(`incident.severity${value.charAt(0)}${value.slice(1).toLowerCase()}` as Parameters<typeof t>[0]);
  const categoryLabel = (value: IncidentCategory) => t(`incident.category${value.charAt(0)}${value.slice(1).toLowerCase()}` as Parameters<typeof t>[0]);
  const openForm = () => { setForm(defaultForm()); setFormError(null); setPhoto(null); };
  const submit = async () => {
    if (!form || !form.description.trim()) return setFormError(t("incident.descriptionRequired"));
    setFormError(null);
    try { await create.mutateAsync(form); }
    catch (error) { setFormError(error instanceof Error ? error.message : t("incident.saveFailed")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("incident.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {canCreate && <Button onPress={openForm}>{t("incident.add")}</Button>}
    {reports.isLoading && <ShimmerList />}
    {reports.isError && <Button variant="secondary" onPress={() => reports.refetch()}>{t("common.retry")}</Button>}
    {!reports.isLoading && !reports.isError && reports.data?.map((report) => <View key={report.id} style={styles.card}>
      <View style={styles.row}><AppText variant="label">{severityLabel(report.severity)}</AppText><AppText tone="muted">{categoryLabel(report.category)}</AppText></View>
      <AppText tone="muted">{formatDateTime(report.occurredAt)}</AppText>
      <AppText>{report.description}</AppText>
      {report.actionTaken && <AppText tone="muted">{t("incident.actionTakenLabel", { action: report.actionTaken })}</AppText>}
      {report.hasPhoto && <Button variant="secondary" onPress={() => setPhotoEntry(report)}>{t("incident.viewPhoto")}</Button>}
      {canAcknowledge && (report.acknowledgedByMe ? <AppText variant="caption" tone="muted">{t("incident.acknowledged")}</AppText> : <Button variant="secondary" loading={acknowledge.isPending} onPress={() => void acknowledge.mutateAsync(report.id)}>{t("incident.acknowledge")}</Button>)}
    </View>)}
    {!reports.isLoading && !reports.isError && reports.data?.length === 0 && <AppText tone="muted">{t("incident.empty")}</AppText>}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("incident.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("common.save"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <AppText accessibilityRole="alert" tone="danger">{formError}</AppText>}
      <AppText variant="label">{t("incident.severity")}</AppText>
      <View style={styles.options}>{severities.map((severity) => <Button key={severity} variant={form?.severity === severity ? "primary" : "secondary"} onPress={() => setForm((current) => current ? { ...current, severity } : current)}>{severityLabel(severity)}</Button>)}</View>
      <AppText variant="label">{t("incident.category")}</AppText>
      <View style={styles.options}>{categories.map((category) => <Button key={category} variant={form?.category === category ? "primary" : "secondary"} onPress={() => setForm((current) => current ? { ...current, category } : current)}>{categoryLabel(category)}</Button>)}</View>
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("incident.description")} value={form?.description ?? ""} onChangeText={(description) => setForm((current) => current ? { ...current, description } : current)} multiline maxLength={2_000} />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("incident.actionTaken")} value={form?.actionTaken ?? ""} onChangeText={(actionTaken) => setForm((current) => current ? { ...current, actionTaken } : current)} multiline maxLength={2_000} />
      {photo && <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="contain" />}
      <View style={styles.options}>
        <Button variant="secondary" onPress={() => void imagePicker.pickFromLibrary().then((images) => setPhoto(images[0] ?? null))}>{t("goals.pickPhoto")}</Button>
        <Button variant="secondary" onPress={() => void imagePicker.takePhoto().then(setPhoto)}>{t("goals.takePhoto")}</Button>
      </View>
    </BottomSheet>

    <BottomSheet visible={photoEntry !== null} onClose={() => setPhotoEntry(null)} closeAccessibilityLabel={t("common.close")} title={t("incident.viewPhoto")}>
      {photoQuery.isFetching && <ShimmerList variant="tile" />}
      {photoQuery.data && <Image source={{ uri: `data:${photoQuery.data.contentType};base64,${photoQuery.data.dataBase64}` }} style={styles.photoPreview} resizeMode="contain" />}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 48, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, textAlignVertical: "top" },
  multiline: { minHeight: 80 },
  photoPreview: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
