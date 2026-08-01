import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
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
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [emergencyInstructions, setEmergencyInstructions] = useState("");

  useEffect(() => {
    if (!record.data) return;
    setBloodType(record.data.bloodType ?? "");
    setAllergies(record.data.allergies ?? "");
    setMedicalConditions(record.data.medicalConditions ?? "");
    setMedications(record.data.medications ?? "");
    setEmergencyInstructions(record.data.emergencyInstructions ?? "");
  }, [record.data]);

  if (!profile || !childId) return null;

  const save = () => void upsert.mutateAsync({
    bloodType: bloodType.trim() || undefined,
    allergies: allergies.trim() || undefined,
    medicalConditions: medicalConditions.trim() || undefined,
    medications: medications.trim() || undefined,
    emergencyInstructions: emergencyInstructions.trim() || undefined,
  }).catch((error: unknown) => notify(t("health.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));

  return <AppScreen showBottomNavigation={false} title={t("health.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {record.isFetching && <ShimmerList variant="row" />}
    {!record.isFetching && !canEdit && !record.data && <AppText tone="muted">{t("health.empty")}</AppText>}
    {!record.isFetching && (canEdit || record.data) && <View style={styles.form}>
      {record.data?.updatedAt && <AppText variant="caption" tone="muted">{t("health.lastUpdated", { date: formatDateTime(record.data.updatedAt) })}</AppText>}
      <AppText variant="label">{t("health.bloodType")}</AppText>
      {canEdit ? <TextInput style={styles.input} value={bloodType} onChangeText={setBloodType} /> : <AppText tone={bloodType ? "default" : "muted"}>{bloodType || t("common.noData")}</AppText>}
      <AppText variant="label">{t("health.allergies")}</AppText>
      {canEdit ? <TextInput style={[styles.input, styles.multiline]} value={allergies} onChangeText={setAllergies} multiline /> : <AppText tone={allergies ? "default" : "muted"}>{allergies || t("common.noData")}</AppText>}
      <AppText variant="label">{t("health.medicalConditions")}</AppText>
      {canEdit ? <TextInput style={[styles.input, styles.multiline]} value={medicalConditions} onChangeText={setMedicalConditions} multiline /> : <AppText tone={medicalConditions ? "default" : "muted"}>{medicalConditions || t("common.noData")}</AppText>}
      <AppText variant="label">{t("health.medications")}</AppText>
      {canEdit ? <TextInput style={[styles.input, styles.multiline]} value={medications} onChangeText={setMedications} multiline /> : <AppText tone={medications ? "default" : "muted"}>{medications || t("common.noData")}</AppText>}
      <AppText variant="label">{t("health.emergencyInstructions")}</AppText>
      {canEdit ? <TextInput style={[styles.input, styles.multiline]} value={emergencyInstructions} onChangeText={setEmergencyInstructions} multiline /> : <AppText tone={emergencyInstructions ? "default" : "muted"}>{emergencyInstructions || t("common.noData")}</AppText>}
      {canEdit && <Button loading={upsert.isPending} onPress={save}>{t("common.save")}</Button>}
    </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  multiline: { minHeight: 80, paddingTop: spacing.sm, textAlignVertical: "top" },
});
