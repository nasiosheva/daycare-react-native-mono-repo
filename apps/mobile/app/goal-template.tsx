import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { UpsertGoalTemplateInput } from "@daycare/api-client";

export default function GoalTemplateScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canAdmin = membership?.role === "STAFF_ADMIN" && membership.active;
  const templates = useQuery({ queryKey: ["goal-templates", organizationId], queryFn: () => api.goalTemplates(), enabled: canAdmin });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: canAdmin });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: canAdmin });
  const editingTemplateId = typeof templateId === "string" ? templateId : null;
  const template = editingTemplateId ? templates.data?.find((item) => item.id === editingTemplateId) : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState("100");
  const [minimumPercent, setMinimumPercent] = useState("90");
  const [minimumStreak, setMinimumStreak] = useState("14");
  const [learningLevelId, setLearningLevelId] = useState<string>();
  const [classroomId, setClassroomId] = useState<string>();

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setDescription(template.description);
    setDurationDays(String(template.durationDays));
    setMinimumPercent(String(template.minimumYesPercent));
    setMinimumStreak(String(template.minimumYesStreak));
    setLearningLevelId(template.learningLevelId ?? undefined);
    setClassroomId(template.classroomId ?? undefined);
  }, [template]);

  const saveTemplate = useMutation({
    mutationFn: (input: UpsertGoalTemplateInput) => editingTemplateId ? api.updateGoalTemplate(editingTemplateId, input) : api.createGoalTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goal-templates", organizationId] });
      router.back();
    },
  });
  const save = () => {
    const duration = Number(durationDays);
    const percent = Number(minimumPercent);
    const streak = Number(minimumStreak);
    if (!name.trim() || (!learningLevelId && !classroomId) || !Number.isInteger(duration) || duration < 1 || !Number.isInteger(percent) || percent < 0 || percent > 100 || !Number.isInteger(streak) || streak < 0) {
      Alert.alert(t("goals.templateRequired"));
      return;
    }
    const input: UpsertGoalTemplateInput = { learningLevelId, classroomId, name: name.trim(), description: description.trim(), durationDays: duration, minimumYesPercent: percent, minimumYesStreak: streak };
    void saveTemplate.mutateAsync(input).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  };

  if (!profile) return null;
  if (!canAdmin) return <Redirect href="/home" />;
  if (editingTemplateId && templates.isSuccess && !template) return <Redirect href="/goals" />;

  return <AppScreen showBottomNavigation={false} title={t(editingTemplateId ? "goals.editTemplate" : "goals.addTemplate")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <TextInput style={styles.input} placeholder={t("goals.templateName")} value={name} onChangeText={setName} />
    <TextInput style={styles.input} placeholder={t("goals.templateDescription")} value={description} onChangeText={setDescription} />
    <AppText variant="label">{t("goals.learningLevel")}</AppText>
    <View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={learningLevelId === level.id ? "primary" : "secondary"} onPress={() => { setLearningLevelId(level.id); setClassroomId(undefined); }}>{level.name}</Button>)}</View>
    <AppText variant="label">{t("goals.classroomOptional")}</AppText>
    <View style={styles.options}>{classrooms.data?.filter((classroom) => classroom.active && (!learningLevelId || classroom.learningLevelId === learningLevelId)).map((classroom) => <Button key={classroom.id} variant={classroomId === classroom.id ? "primary" : "secondary"} onPress={() => { setClassroomId(classroom.id); setLearningLevelId(classroom.learningLevelId ?? undefined); }}>{classroom.name}</Button>)}</View>
    <TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.durationDays")} value={durationDays} onChangeText={setDurationDays} />
    <TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumPercent")} value={minimumPercent} onChangeText={setMinimumPercent} />
    <TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumStreak")} value={minimumStreak} onChangeText={setMinimumStreak} />
    <Button loading={saveTemplate.isPending} onPress={save}>{t("common.save")}</Button>
  </AppScreen>;
}

const styles = StyleSheet.create({
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
});
