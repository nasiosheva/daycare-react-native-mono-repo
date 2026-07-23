import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

type Sheet = "edit" | "assessment" | null;

export default function CurriculumActivityDetailScreen() {
  const router = useRouter();
  const { activityId: rawActivityId } = useLocalSearchParams<{ activityId?: string }>();
  const activityId = typeof rawActivityId === "string" ? rawActivityId : null;
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const activities = useQuery({ queryKey: ["curriculum-activities", organizationId], queryFn: () => api.curriculumActivities(), enabled: Boolean(membership) });
  const activity = activities.data?.find((item) => item.id === activityId);
  const assessments = useQuery({ queryKey: ["curriculum-activity-assessments", organizationId, activityId], queryFn: () => api.curriculumActivityAssessments(activityId!), enabled: Boolean(membership && activityId) });
  const refreshActivities = () => queryClient.invalidateQueries({ queryKey: ["curriculum-activities", organizationId] });
  const updateActivity = useMutation({ mutationFn: (input: { name: string; description: string }) => api.updateCurriculumActivity(activityId!, input), onSuccess: refreshActivities });
  const archiveActivity = useMutation({ mutationFn: () => api.archiveCurriculumActivity(activityId!), onSuccess: refreshActivities });
  const createAssessment = useMutation({ mutationFn: (input: { name: string; description?: string }) => api.createCurriculumActivityAssessment(activityId!, input), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["curriculum-activity-assessments", organizationId, activityId] }) });
  const removeAssessment = useMutation({ mutationFn: (assessmentId: string) => api.removeCurriculumActivityAssessment(activityId!, assessmentId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["curriculum-activity-assessments", organizationId, activityId] }) });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");

  useEffect(() => {
    if (!activity) return;
    setName(activity.name);
    setDescription(activity.description);
  }, [activity]);

  if (!profile) return null;
  if (!activityId || !membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  const closeEditSheet = () => setSheet(null);
  const saveActivity = async () => {
    if (!name.trim()) return Alert.alert(t("learning.activityRequired"));
    try {
      await updateActivity.mutateAsync({ name: name.trim(), description: description.trim() });
      closeEditSheet();
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const archive = () => {
    Alert.alert(t("learning.archive"), t("learning.activityArchived"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("learning.archive"), style: "destructive", onPress: () => void archiveActivity.mutateAsync().catch((error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))) },
    ]);
  };
  const closeAssessmentSheet = () => { setSheet(null); setAssessmentName(""); setAssessmentDescription(""); };
  const saveAssessment = async () => {
    if (!assessmentName.trim()) return Alert.alert(t("learning.activityRequired"));
    try {
      await createAssessment.mutateAsync({ name: assessmentName.trim(), description: assessmentDescription.trim() || undefined });
      closeAssessmentSheet();
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("learning.activityDetailTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {!activity ? <AppText>{t("academic.title")}...</AppText> : <View style={styles.content}>
      <View style={styles.card}>
        <AppText variant="title">{activity.name}</AppText>
        {activity.description ? <AppText tone="muted">{activity.description}</AppText> : null}
        {!activity.active && <AppText tone="muted">{t("learning.activityArchived")}</AppText>}
        {canManage && <View style={styles.options}>
          <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("learning.editActivity")} onPress={() => setSheet("edit")} />
          {activity.active && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.archive")} onPress={archive} />}
        </View>}
      </View>

      <AppText variant="heading">{t("learning.assessments")}</AppText>
      {assessments.data?.map((assessment) => <View key={assessment.id} style={styles.item}>
        <View style={styles.itemContent}>
          <AppText variant="label">{assessment.name}</AppText>
          {assessment.description ? <AppText variant="bodySmall" tone="muted">{assessment.description}</AppText> : null}
        </View>
        {canManage && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.removeAssessment")} onPress={() => void removeAssessment.mutateAsync(assessment.id)} />}
      </View>)}
      {assessments.data?.length === 0 && <AppText tone="muted">{t("learning.noAssessments")}</AppText>}
      {canManage && <Button variant="secondary" onPress={() => setSheet("assessment")}>{t("learning.addAssessment")}</Button>}
    </View>}

    <BottomSheet visible={sheet === "edit"} onClose={closeEditSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.editActivity")} negativeAction={{ label: t("common.cancel"), onPress: closeEditSheet }} positiveAction={{ label: t("common.save"), loading: updateActivity.isPending, onPress: () => void saveActivity() }}>
      <TextInput style={styles.input} placeholder={t("learning.activityName")} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t("academic.description")} value={description} onChangeText={setDescription} />
    </BottomSheet>

    <BottomSheet visible={sheet === "assessment"} onClose={closeAssessmentSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.addAssessment")} negativeAction={{ label: t("common.cancel"), onPress: closeAssessmentSheet }} positiveAction={{ label: t("common.save"), loading: createAssessment.isPending, disabled: !assessmentName.trim(), onPress: () => void saveAssessment() }}>
      <TextInput style={styles.input} placeholder={t("learning.assessmentName")} value={assessmentName} onChangeText={setAssessmentName} />
      <TextInput style={styles.input} placeholder={t("learning.assessmentDescription")} value={assessmentDescription} onChangeText={setAssessmentDescription} />
    </BottomSheet>
  </AppScreen>;
}

function IconButton({ icon, tone = "secondary", onPress, accessibilityLabel, disabled }: { icon: keyof typeof Ionicons.glyphMap; tone?: "secondary" | "danger"; onPress: () => void; accessibilityLabel: string; disabled?: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, tone === "danger" && styles.iconButtonDanger, pressed && !disabled && styles.iconButtonPressed, disabled && styles.iconButtonDisabled]}
  >
    <Ionicons name={icon} size={18} color={tone === "danger" ? colors.danger : colors.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  itemContent: { flex: 1, gap: spacing.xs },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
