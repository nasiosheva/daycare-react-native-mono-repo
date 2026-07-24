import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { GoalIndicator, UpsertGoalTemplateInput } from "@daycare/api-client";

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
  const [openInfo, setOpenInfo] = useState<string | null>(null);

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
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["goal-templates", organizationId] });
      if (!editingTemplateId) router.replace({ pathname: "/goal-template", params: { templateId: saved.id } });
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

  const [indicatorSheet, setIndicatorSheet] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<GoalIndicator | null>(null);
  const [indicatorName, setIndicatorName] = useState("");
  const refreshTemplates = () => void queryClient.invalidateQueries({ queryKey: ["goal-templates", organizationId] });
  const createIndicator = useMutation({ mutationFn: (indicatorInput: { name: string }) => api.createGoalIndicator(editingTemplateId!, indicatorInput), onSuccess: refreshTemplates });
  const updateIndicator = useMutation({ mutationFn: ({ indicatorId, indicatorInput }: { indicatorId: string; indicatorInput: { name: string; displayOrder: number } }) => api.updateGoalIndicator(editingTemplateId!, indicatorId, indicatorInput), onSuccess: refreshTemplates });
  const archiveIndicator = useMutation({ mutationFn: (indicatorId: string) => api.archiveGoalIndicator(editingTemplateId!, indicatorId), onSuccess: refreshTemplates });
  const openAddIndicator = () => { setEditingIndicator(null); setIndicatorName(""); setIndicatorSheet(true); };
  const openEditIndicator = (indicator: GoalIndicator) => { setEditingIndicator(indicator); setIndicatorName(indicator.name); setIndicatorSheet(true); };
  const closeIndicatorSheet = () => { setIndicatorSheet(false); setEditingIndicator(null); setIndicatorName(""); };
  const saveIndicator = async () => {
    if (!indicatorName.trim()) return;
    try {
      if (editingIndicator) await updateIndicator.mutateAsync({ indicatorId: editingIndicator.id, indicatorInput: { name: indicatorName.trim(), displayOrder: editingIndicator.displayOrder } });
      else await createIndicator.mutateAsync({ name: indicatorName.trim() });
      closeIndicatorSheet();
    } catch (error) { Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const activeIndicatorCount = template?.indicators.filter((indicator) => indicator.active).length ?? 0;

  if (!profile) return null;
  if (!canAdmin) return <Redirect href="/home" />;
  if (editingTemplateId && templates.isSuccess && !template) return <Redirect href="/goals" />;

  return <AppScreen showBottomNavigation={false} title={t(editingTemplateId ? "goals.editTemplate" : "goals.addTemplate")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <GoalFormField id="name" label={t("goals.templateName")} info={t("goals.templateNameInfo")} infoAction={t(openInfo === "name" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "name"} onToggle={() => setOpenInfo((current) => current === "name" ? null : "name")}><TextInput style={styles.input} placeholder={t("goals.templateName")} value={name} onChangeText={setName} /></GoalFormField>
    <GoalFormField id="description" label={t("goals.templateDescription")} info={t("goals.templateDescriptionInfo")} infoAction={t(openInfo === "description" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "description"} onToggle={() => setOpenInfo((current) => current === "description" ? null : "description")}><TextInput style={styles.input} placeholder={t("goals.templateDescription")} value={description} onChangeText={setDescription} /></GoalFormField>
    <GoalFormField id="level" label={t("goals.learningLevel")} info={t("goals.learningLevelInfo")} infoAction={t(openInfo === "level" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "level"} onToggle={() => setOpenInfo((current) => current === "level" ? null : "level")}><View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={learningLevelId === level.id ? "primary" : "secondary"} onPress={() => { setLearningLevelId(level.id); setClassroomId(undefined); }}>{level.name}</Button>)}</View></GoalFormField>
    <GoalFormField id="classroom" label={t("goals.classroomOptional")} info={t("goals.classroomInfo")} infoAction={t(openInfo === "classroom" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "classroom"} onToggle={() => setOpenInfo((current) => current === "classroom" ? null : "classroom")}><View style={styles.options}>{classrooms.data?.filter((classroom) => classroom.active && (!learningLevelId || classroom.learningLevelId === learningLevelId)).map((classroom) => <Button key={classroom.id} variant={classroomId === classroom.id ? "primary" : "secondary"} onPress={() => { setClassroomId(classroom.id); setLearningLevelId(classroom.learningLevelId ?? undefined); }}>{classroom.name}</Button>)}</View></GoalFormField>
    <GoalFormField id="duration" label={t("goals.durationDays")} info={t("goals.durationDaysInfo")} infoAction={t(openInfo === "duration" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "duration"} onToggle={() => setOpenInfo((current) => current === "duration" ? null : "duration")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.durationDays")} value={durationDays} onChangeText={setDurationDays} /></GoalFormField>
    <GoalFormField id="percent" label={t("goals.minimumPercent")} info={t("goals.minimumPercentInfo")} infoAction={t(openInfo === "percent" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "percent"} onToggle={() => setOpenInfo((current) => current === "percent" ? null : "percent")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumPercent")} value={minimumPercent} onChangeText={setMinimumPercent} /></GoalFormField>
    <GoalFormField id="streak" label={t("goals.minimumStreak")} info={t("goals.minimumStreakInfo")} infoAction={t(openInfo === "streak" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "streak"} onToggle={() => setOpenInfo((current) => current === "streak" ? null : "streak")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumStreak")} value={minimumStreak} onChangeText={setMinimumStreak} /></GoalFormField>
    <Button loading={saveTemplate.isPending} onPress={save}>{t("common.save")}</Button>

    {editingTemplateId && template && <View style={styles.field}>
      <View style={styles.fieldHeader}><AppText variant="label">{t("goals.indicators")}</AppText><Button variant="secondary" onPress={openAddIndicator}>{t("goals.addIndicator")}</Button></View>
      <AppText variant="caption" tone="muted">{t("goals.indicatorsInfo")}</AppText>
      {template.indicators.map((indicator) => <View key={indicator.id} style={[styles.indicatorRow, !indicator.active && styles.indicatorRowArchived]}>
        <AppText style={styles.indicatorName}>{indicator.name}</AppText>
        {!indicator.active && <AppText variant="caption" tone="muted">{t("learning.archived")}</AppText>}
        <View style={styles.indicatorActions}>
          <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("common.edit")} onPress={() => openEditIndicator(indicator)} />
          {indicator.active && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("goals.archive")} disabled={activeIndicatorCount <= 1} onPress={() => void archiveIndicator.mutateAsync(indicator.id).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")))} />}
        </View>
      </View>)}
    </View>}

    <BottomSheet
      visible={indicatorSheet}
      onClose={closeIndicatorSheet}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingIndicator ? "goals.editIndicator" : "goals.addIndicator")}
      negativeAction={{ label: t("common.cancel"), onPress: closeIndicatorSheet }}
      positiveAction={{ label: t("common.save"), loading: createIndicator.isPending || updateIndicator.isPending, disabled: !indicatorName.trim(), onPress: () => void saveIndicator() }}
    >
      <TextInput style={styles.input} placeholder={t("goals.indicatorName")} value={indicatorName} onChangeText={setIndicatorName} />
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

type GoalFormFieldProps = { id: string; label: string; info: string; infoAction: string; expanded: boolean; onToggle: () => void; children: ReactNode };

function GoalFormField({ id, label, info, infoAction, expanded, onToggle, children }: GoalFormFieldProps) {
  return <View style={styles.field}>
    <View style={styles.fieldHeader}><AppText variant="label">{label}</AppText><Pressable accessibilityRole="button" accessibilityLabel={`${infoAction}: ${label}`} accessibilityState={{ expanded }} onPress={onToggle} style={({ pressed }) => [styles.infoToggle, pressed && styles.pressed]}><AppText variant="caption" tone="muted">ⓘ {infoAction}</AppText></Pressable></View>
    {expanded && <View nativeID={`${id}-info`} style={styles.info}><AppText variant="caption" tone="muted">{info}</AppText></View>}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  info: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  infoToggle: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  indicatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  indicatorRowArchived: { opacity: 0.7 },
  indicatorName: { flex: 1 },
  indicatorActions: { flexDirection: "row", gap: spacing.sm },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
