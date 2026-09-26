import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildIncidentReport, IncidentCategory, IncidentSeverity } from "@daycare/api-client";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, Badge, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, colors, radius, spacing, type Tone } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";

const severities: IncidentSeverity[] = ["MINOR", "MODERATE", "SERIOUS"];
const categories: IncidentCategory[] = ["INJURY", "ILLNESS", "BEHAVIOR", "OTHER"];
const severityTones: Record<IncidentSeverity, Tone> = { MINOR: "info", MODERATE: "warning", SERIOUS: "danger" };

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

  return <AppScreen showBottomNavigation={false} title={t("incident.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canCreate ? <FloatingActionButton icon="add" accessibilityLabel={t("incident.add")} onPress={openForm}>{t("incident.add")}</FloatingActionButton> : undefined}>
    {reports.isLoading && <ShimmerList />}
    {reports.isError && !reports.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void reports.refetch()} />}
    {!reports.isLoading && !reports.isError && reports.data?.map((report) => <Card key={report.id} icon="bandage-outline" title={categoryLabel(report.category)} subtitle={formatDateTime(report.occurredAt)} trailing={<Badge tone={severityTones[report.severity]} label={severityLabel(report.severity)} />}>
      <AppText>{report.description}</AppText>
      {report.actionTaken && <AppText tone="muted">{t("incident.actionTakenLabel", { action: report.actionTaken })}</AppText>}
      {report.hasPhoto && <Button variant="secondary" leadingIcon={<Ionicons name="image-outline" size={18} color={colors.primary} />} onPress={() => setPhotoEntry(report)}>{t("incident.viewPhoto")}</Button>}
      {canAcknowledge && (report.acknowledgedByMe ? <Badge tone="success" icon="checkmark-circle" label={t("incident.acknowledged")} /> : <Button loading={acknowledge.isPending} onPress={() => void acknowledge.mutateAsync(report.id)}>{t("incident.acknowledge")}</Button>)}
    </Card>)}
    {!reports.isLoading && !reports.isError && reports.data?.length === 0 && <EmptyState icon="shield-checkmark-outline" title={t("incident.empty")} />}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("incident.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("common.save"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <Banner tone="danger" title={formError} />}
      <View style={styles.field}><AppText variant="label">{t("incident.severity")}</AppText><ChipGroup accessibilityLabel={t("incident.severity")}>{severities.map((severity) => <Chip key={severity} label={severityLabel(severity)} selected={form?.severity === severity} onPress={() => setForm((current) => current ? { ...current, severity } : current)} />)}</ChipGroup></View>
      <View style={styles.field}><AppText variant="label">{t("incident.category")}</AppText><ChipGroup accessibilityLabel={t("incident.category")}>{categories.map((category) => <Chip key={category} label={categoryLabel(category)} selected={form?.category === category} onPress={() => setForm((current) => current ? { ...current, category } : current)} />)}</ChipGroup></View>
      <TextField label={t("incident.description")} required value={form?.description ?? ""} onChangeText={(description) => setForm((current) => current ? { ...current, description } : current)} multiline maxLength={2_000} />
      <TextField label={t("incident.actionTaken")} value={form?.actionTaken ?? ""} onChangeText={(actionTaken) => setForm((current) => current ? { ...current, actionTaken } : current)} multiline maxLength={2_000} />
      {photo && <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="contain" />}
      <View style={styles.options}>
        <Button variant="secondary" leadingIcon={<Ionicons name="images-outline" size={18} color={colors.primary} />} onPress={() => void imagePicker.pickFromLibrary().then((images) => setPhoto(images[0] ?? null))}>{t("goals.pickPhoto")}</Button>
        <Button variant="secondary" leadingIcon={<Ionicons name="camera-outline" size={18} color={colors.primary} />} onPress={() => void imagePicker.takePhoto().then(setPhoto)}>{t("goals.takePhoto")}</Button>
      </View>
    </BottomSheet>

    <BottomSheet visible={photoEntry !== null} onClose={() => setPhotoEntry(null)} closeAccessibilityLabel={t("common.close")} title={t("incident.viewPhoto")}>
      {photoQuery.isFetching && <ShimmerList variant="tile" />}
      {photoQuery.data && <Image source={{ uri: `data:${photoQuery.data.contentType};base64,${photoQuery.data.dataBase64}` }} style={styles.photoPreview} resizeMode="contain" />}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoPreview: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
