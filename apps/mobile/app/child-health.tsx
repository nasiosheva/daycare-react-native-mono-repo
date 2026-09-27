import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, Card, EmptyState, FloatingActionButton, InfoRow, SectionHeader, ShimmerList, TextField, colors, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";

export default function ChildHealthScreen() {
  const router = useRouter();
  const { childId: rawChildId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canEdit = Boolean(membership?.active && (membership.role === "STAFF_ADMIN" || membership.role === "STAFF"));
  const record = useQuery({ queryKey: ["child-health-record", organizationId, childId], queryFn: () => api.childHealthRecord(childId!, organizationId), enabled: Boolean(childId && membership) });
  const upsert = useMutation({
    mutationFn: (input: Parameters<typeof api.upsertChildHealthRecord>[1]) => api.upsertChildHealthRecord(childId!, input, organizationId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["child-health-record", organizationId, childId] }); notify(t("health.saved"), undefined, "success"); },
  });
  const notes = useQuery({ queryKey: ["child-health-notes", organizationId, childId], queryFn: () => api.childHealthNotes(childId!, organizationId), enabled: Boolean(childId && membership) });
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const addNote = useMutation({
    mutationFn: () => api.createChildHealthNote(childId!, { note: noteText.trim() }, organizationId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["child-health-notes", organizationId, childId] }); notify(t("health.noteSaved"), undefined, "success"); setNoteText(""); setAddNoteOpen(false); },
  });
  const submitNote = () => void addNote.mutateAsync().catch((error: unknown) => notify(t("health.noteSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
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
  }).then(() => setEditOpen(false)).catch((error: unknown) => notify(t("health.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));

  return <AppScreen showBottomNavigation={false} title={t("health.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canEdit ? <FloatingActionButton icon="add" accessibilityLabel={t("health.addNote")} onPress={() => setAddNoteOpen(true)}>{t("health.addNote")}</FloatingActionButton> : undefined}>
    {record.isFetching && <ShimmerList variant="row" />}
    {!record.isFetching && !record.data && <EmptyState icon="medkit-outline" title={t("health.empty")} action={canEdit ? { label: t("health.fillRecord"), onPress: openEdit } : undefined} />}
    {!record.isFetching && record.data && <Card icon="medkit-outline" title={t("health.title")} subtitle={t("health.lastUpdated", { date: formatDateTime(record.data.updatedAt) })} trailing={canEdit ? <Button variant="ghost" accessibilityLabel={t("common.edit")} leadingIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />} onPress={openEdit}>{t("common.edit")}</Button> : undefined}>
      {record.data.allergies && <View style={styles.allergy}><Ionicons name="warning" size={18} color={colors.danger} /><View style={styles.grow}><AppText variant="label" tone="danger">{t("health.allergies")}</AppText><AppText>{record.data.allergies}</AppText></View></View>}
      <HealthRow icon="water-outline" label={t("health.bloodType")} value={record.data.bloodType} empty={t("common.noData")} />
      {!record.data.allergies && <HealthRow icon="warning-outline" label={t("health.allergies")} value={record.data.allergies} empty={t("common.noData")} />}
      <HealthRow icon="fitness-outline" label={t("health.medicalConditions")} value={record.data.medicalConditions} empty={t("common.noData")} />
      <HealthRow icon="medical-outline" label={t("health.medications")} value={record.data.medications} empty={t("common.noData")} />
      <HealthRow icon="alert-circle-outline" label={t("health.emergencyInstructions")} value={record.data.emergencyInstructions} empty={t("common.noData")} />
    </Card>}

    <View style={styles.section}>
      <SectionHeader title={t("health.notesSection")} />
      {notes.isFetching && <ShimmerList variant="row" />}
      {!notes.isFetching && !notes.data?.length && <EmptyState compact icon="document-text-outline" title={t("health.notesEmpty")} />}
      {!notes.isFetching && notes.data?.map((item) => <Card key={item.id} subtitle={`${item.authorName} · ${formatDateTime(item.recordedAt)}`}>
        <AppText>{item.note}</AppText>
      </Card>)}
    </View>

    <BottomSheet
      visible={editOpen}
      onClose={() => setEditOpen(false)}
      closeAccessibilityLabel={t("common.close")}
      title={t("health.title")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setEditOpen(false) }}
      positiveAction={{ label: t("common.save"), loading: upsert.isPending, onPress: save }}
    >
      <TextField label={t("health.bloodType")} leadingIcon="water-outline" placeholder="A / B / AB / O" autoCapitalize="characters" value={bloodType} onChangeText={setBloodType} />
      <TextField label={t("health.allergies")} multiline value={allergies} onChangeText={setAllergies} />
      <TextField label={t("health.medicalConditions")} multiline value={medicalConditions} onChangeText={setMedicalConditions} />
      <TextField label={t("health.medications")} multiline value={medications} onChangeText={setMedications} />
      <TextField label={t("health.emergencyInstructions")} multiline value={emergencyInstructions} onChangeText={setEmergencyInstructions} />
    </BottomSheet>

    <BottomSheet
      visible={addNoteOpen}
      onClose={() => setAddNoteOpen(false)}
      closeAccessibilityLabel={t("common.close")}
      title={t("health.addNote")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setAddNoteOpen(false) }}
      positiveAction={{ label: t("common.save"), disabled: !noteText.trim(), loading: addNote.isPending, onPress: submitNote }}
    >
      <TextField label={t("health.addNote")} required placeholder={t("health.notePlaceholder")} value={noteText} onChangeText={setNoteText} multiline />
    </BottomSheet>
  </AppScreen>;
}

function HealthRow({ icon, label, value, empty }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null; empty: string }) {
  return <InfoRow icon={icon} label={label} value={value ? value : <AppText variant="label" tone="muted">{empty}</AppText>} />;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  allergy: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.sm, borderRadius: spacing.sm, backgroundColor: colors.dangerSoft },
  section: { gap: spacing.sm, marginTop: spacing.sm },
});
