import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";

export default function ChildHealthScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canEdit = Boolean(membership?.active && (membership.role === "STAFF_ADMIN" || membership.role === "STAFF"));
  const record = useQuery({ queryKey: ["child-health-record", organizationId, childId], queryFn: () => api.childHealthRecord(childId!), enabled: Boolean(childId && membership) });
  const upsert = useMutation({
    mutationFn: (input: Parameters<typeof api.upsertChildHealthRecord>[1]) => api.upsertChildHealthRecord(childId!, input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["child-health-record", organizationId, childId] }); notify(t("health.saved")); },
  });
  const notes = useQuery({ queryKey: ["child-health-notes", organizationId, childId], queryFn: () => api.childHealthNotes(childId!), enabled: Boolean(childId && membership) });
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const addNote = useMutation({
    mutationFn: () => api.createChildHealthNote(childId!, { note: noteText.trim() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["child-health-notes", organizationId, childId] }); notify(t("health.noteSaved")); setNoteText(""); setAddNoteOpen(false); },
  });
  const submitNote = () => void addNote.mutateAsync().catch((error: unknown) => notify(t("health.noteSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  const [editOpen, setEditOpen] = useState(false);
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [emergencyInstructions, setEmergencyInstructions] = useState("");

  if (!profile || !childId) return null;

  const openEdit = () => {
    setBloodType(record.data?.bloodType ?? "");
    setAllergies(record.data?.allergies ?? "");
    setMedicalConditions(record.data?.medicalConditions ?? "");
    setMedications(record.data?.medications ?? "");
    setEmergencyInstructions(record.data?.emergencyInstructions ?? "");
    setEditOpen(true);
  };
  const save = () => void upsert.mutateAsync({
    bloodType: bloodType.trim() || undefined,
    allergies: allergies.trim() || undefined,
    medicalConditions: medicalConditions.trim() || undefined,
    medications: medications.trim() || undefined,
    emergencyInstructions: emergencyInstructions.trim() || undefined,
  }).then(() => setEditOpen(false)).catch((error: unknown) => notify(t("health.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));

  return <AppScreen showBottomNavigation={false} title={t("health.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canEdit ? <FloatingActionButton accessibilityLabel={t("health.addNote")} onPress={() => setAddNoteOpen(true)}>+ {t("health.addNote")}</FloatingActionButton> : undefined}>
    {record.isFetching && <ShimmerList variant="row" />}
    {!record.isFetching && !canEdit && !record.data && <AppText tone="muted">{t("health.empty")}</AppText>}
    {!record.isFetching && !record.data && canEdit && <View style={styles.form}>
      <AppText tone="muted">{t("health.empty")}</AppText>
      <Button variant="secondary" onPress={openEdit}>{t("common.edit")}</Button>
    </View>}
    {!record.isFetching && record.data && <View style={styles.form}>
      <View style={styles.row}>
        <AppText variant="caption" tone="muted">{t("health.lastUpdated", { date: formatDateTime(record.data.updatedAt) })}</AppText>
        {canEdit && <Button variant="secondary" onPress={openEdit}>{t("common.edit")}</Button>}
      </View>
      <AppText variant="label">{t("health.bloodType")}</AppText>
      <AppText tone={record.data.bloodType ? "default" : "muted"}>{record.data.bloodType || t("common.noData")}</AppText>
      <AppText variant="label">{t("health.allergies")}</AppText>
      <AppText tone={record.data.allergies ? "default" : "muted"}>{record.data.allergies || t("common.noData")}</AppText>
      <AppText variant="label">{t("health.medicalConditions")}</AppText>
      <AppText tone={record.data.medicalConditions ? "default" : "muted"}>{record.data.medicalConditions || t("common.noData")}</AppText>
      <AppText variant="label">{t("health.medications")}</AppText>
      <AppText tone={record.data.medications ? "default" : "muted"}>{record.data.medications || t("common.noData")}</AppText>
      <AppText variant="label">{t("health.emergencyInstructions")}</AppText>
      <AppText tone={record.data.emergencyInstructions ? "default" : "muted"}>{record.data.emergencyInstructions || t("common.noData")}</AppText>
    </View>}

    <View style={styles.section}>
      <AppText variant="heading">{t("health.notesSection")}</AppText>
      {notes.isFetching && <ShimmerList variant="row" />}
      {!notes.isFetching && !notes.data?.length && <AppText tone="muted">{t("health.notesEmpty")}</AppText>}
      {!notes.isFetching && notes.data?.map((item) => <View key={item.id} style={styles.card}>
        <AppText>{item.note}</AppText>
        <AppText variant="caption" tone="muted">{item.authorName} · {formatDateTime(item.recordedAt)}</AppText>
      </View>)}
    </View>

    <BottomSheet
      visible={editOpen}
      onClose={() => setEditOpen(false)}
      closeAccessibilityLabel={t("common.close")}
      title={t("health.title")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setEditOpen(false) }}
      positiveAction={{ label: t("common.save"), loading: upsert.isPending, onPress: save }}
    >
      <AppText variant="label">{t("health.bloodType")}</AppText>
      <TextInput style={styles.input} value={bloodType} onChangeText={setBloodType} />
      <AppText variant="label">{t("health.allergies")}</AppText>
      <TextInput style={[styles.input, styles.multiline]} value={allergies} onChangeText={setAllergies} multiline />
      <AppText variant="label">{t("health.medicalConditions")}</AppText>
      <TextInput style={[styles.input, styles.multiline]} value={medicalConditions} onChangeText={setMedicalConditions} multiline />
      <AppText variant="label">{t("health.medications")}</AppText>
      <TextInput style={[styles.input, styles.multiline]} value={medications} onChangeText={setMedications} multiline />
      <AppText variant="label">{t("health.emergencyInstructions")}</AppText>
      <TextInput style={[styles.input, styles.multiline]} value={emergencyInstructions} onChangeText={setEmergencyInstructions} multiline />
    </BottomSheet>

    <BottomSheet
      visible={addNoteOpen}
      onClose={() => setAddNoteOpen(false)}
      closeAccessibilityLabel={t("common.close")}
      title={t("health.addNote")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setAddNoteOpen(false) }}
      positiveAction={{ label: t("common.save"), disabled: !noteText.trim(), loading: addNote.isPending, onPress: submitNote }}
    >
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("health.notePlaceholder")} value={noteText} onChangeText={setNoteText} multiline />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  multiline: { minHeight: 80, paddingTop: spacing.sm, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.md },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
