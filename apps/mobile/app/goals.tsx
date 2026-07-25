import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildListFilter, GoalIndicator, GoalTemplate, UpsertGoalTemplateInput } from "@daycare/api-client";
import { childGoalOutcomes, goalCategories, goalCheckInOutcomes, type ChildGoalOutcome } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";
import { goalCategoryKey } from "@/i18n/translations";
import { formatIsoDate } from "@/date-picker/date";
import { ageInMonths } from "@/development/childAge";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";
import { resolveSelectedChildId } from "@/development/selectedChild";

type Sheet = "assign" | "finalize" | null;

export default function GoalsScreen() {
  const router = useRouter();
  const { childId: routeChildId } = useLocalSearchParams<{ childId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const canAdmin = isStaffAdmin && membership.active;
  const canWrite = Boolean(membership?.active && (membership.role === "STAFF_ADMIN" || membership.role === "STAFF"));
  const [filterVisible, setFilterVisible] = useState(false);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const [childId, setChildId] = useState<string | null>(typeof routeChildId === "string" ? routeChildId : null);
  const hasFixedChild = typeof routeChildId === "string";
  useEffect(() => {
    setChildId((currentChildId) => resolveSelectedChildId(children.data ?? [], currentChildId, hasFixedChild ? routeChildId : undefined, hasFixedChild));
  }, [children.data, hasFixedChild, routeChildId]);
  const selectedChild = children.data?.find((child) => child.id === childId) ?? null;
  const templates = useQuery({ queryKey: ["goal-templates", organizationId], queryFn: () => api.goalTemplates(), enabled: canAdmin });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: canAdmin });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: canAdmin });
  const goals = useQuery({ queryKey: ["child-goals", organizationId, childId], queryFn: () => api.childGoals(childId!), enabled: Boolean(selectedChild && membership) });
  const refreshGoals = () => { void queryClient.invalidateQueries({ queryKey: ["goal-templates", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["child-goals", organizationId, childId] }); };
  const [sheet, setSheet] = useState<Sheet>(null);
  const [templateId, setTemplateId] = useState<string>(); const [finalGoalId, setFinalGoalId] = useState<string>(); const [finalOutcome, setFinalOutcome] = useState<ChildGoalOutcome>("ACHIEVED"); const [finalSummary, setFinalSummary] = useState("");
  const assign = useMutation({ mutationFn: () => api.assignChildGoal(childId!, { templateId: templateId! }), onSuccess: () => { refreshGoals(); setSheet(null); setTemplateId(undefined); } });
  const finalize = useMutation({ mutationFn: () => api.finalizeChildGoal(finalGoalId!, { outcome: finalOutcome, summary: finalSummary.trim() }), onSuccess: () => { refreshGoals(); setSheet(null); setFinalGoalId(undefined); setFinalSummary(""); } });
  const checkIn = useMutation({ mutationFn: ({ goalId, indicatorId, outcome }: { goalId: string; indicatorId: string; outcome: (typeof goalCheckInOutcomes)[number] }) => api.recordGoalCheckIn(goalId, formatIsoDate(new Date()), indicatorId, outcome), onSuccess: refreshGoals });
  const archiveTemplate = useMutation({ mutationFn: api.archiveGoalTemplate.bind(api), onSuccess: refreshGoals });
  const selectedClassroom = classrooms.data?.find((classroom) => classroom.id === selectedChild?.classroomId);
  const selectedChildAgeMonths = selectedChild ? ageInMonths(selectedChild.dateOfBirth) : null;
  const matchesChildAge = (template: GoalTemplate) => template.minAgeMonths == null || template.maxAgeMonths == null || selectedChildAgeMonths == null
    || (selectedChildAgeMonths >= template.minAgeMonths && selectedChildAgeMonths <= template.maxAgeMonths);
  const availableTemplates = templates.data?.filter((template) => template.active && matchesChildAge(template)
    && (template.source === "GLOBAL"
      || ((!template.classroomId || template.classroomId === selectedChild?.classroomId)
        && (!template.learningLevelId || template.learningLevelId === selectedClassroom?.learningLevelId)))) ?? [];

  const [templatesListOpen, setTemplatesListOpen] = useState(false);
  const [goalsListOpen, setGoalsListOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string>();
  const editingTemplate = editingTemplateId ? templates.data?.find((item) => item.id === editingTemplateId) : null;
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateDurationDays, setTemplateDurationDays] = useState("100");
  const [templateMinimumPercent, setTemplateMinimumPercent] = useState("90");
  const [templateMinimumStreak, setTemplateMinimumStreak] = useState("14");
  const [templateLearningLevelId, setTemplateLearningLevelId] = useState<string>();
  const [templateClassroomId, setTemplateClassroomId] = useState<string>();
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [indicatorSheetOpen, setIndicatorSheetOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<GoalIndicator | null>(null);
  const [indicatorName, setIndicatorName] = useState("");

  useEffect(() => {
    if (!editingTemplate) return;
    setTemplateName(editingTemplate.name);
    setTemplateDescription(editingTemplate.description);
    setTemplateDurationDays(String(editingTemplate.durationDays));
    setTemplateMinimumPercent(String(editingTemplate.minimumYesPercent));
    setTemplateMinimumStreak(String(editingTemplate.minimumYesStreak));
    setTemplateLearningLevelId(editingTemplate.learningLevelId ?? undefined);
    setTemplateClassroomId(editingTemplate.classroomId ?? undefined);
  }, [editingTemplate]);

  const saveTemplate = useMutation({
    mutationFn: (input: UpsertGoalTemplateInput) => editingTemplateId ? api.updateGoalTemplate(editingTemplateId, input) : api.createGoalTemplate(input),
    onSuccess: (saved) => { refreshGoals(); if (!editingTemplateId) setEditingTemplateId(saved.id); },
  });
  const createIndicator = useMutation({ mutationFn: (indicatorInput: { name: string }) => api.createGoalIndicator(editingTemplateId!, indicatorInput), onSuccess: refreshGoals });
  const updateIndicatorMutation = useMutation({ mutationFn: ({ indicatorId, indicatorInput }: { indicatorId: string; indicatorInput: { name: string; displayOrder: number } }) => api.updateGoalIndicator(editingTemplateId!, indicatorId, indicatorInput), onSuccess: refreshGoals });
  const archiveIndicatorMutation = useMutation({ mutationFn: (indicatorId: string) => api.archiveGoalIndicator(editingTemplateId!, indicatorId), onSuccess: refreshGoals });

  if (!profile || !membership) return null;

  const resetTemplateForm = () => { setTemplateName(""); setTemplateDescription(""); setTemplateDurationDays("100"); setTemplateMinimumPercent("90"); setTemplateMinimumStreak("14"); setTemplateLearningLevelId(undefined); setTemplateClassroomId(undefined); setOpenInfo(null); };
  const openCreateTemplate = () => { setTemplatesListOpen(false); setEditingTemplateId(undefined); resetTemplateForm(); setTemplateFormOpen(true); };
  const openEditTemplateForm = (id: string) => { setTemplatesListOpen(false); setEditingTemplateId(id); setTemplateFormOpen(true); };
  const closeTemplateForm = () => { setTemplateFormOpen(false); setEditingTemplateId(undefined); resetTemplateForm(); };
  const submitTemplateForm = () => {
    const duration = Number(templateDurationDays);
    const percent = Number(templateMinimumPercent);
    const streak = Number(templateMinimumStreak);
    if (!templateName.trim() || (!templateLearningLevelId && !templateClassroomId) || !Number.isInteger(duration) || duration < 1 || !Number.isInteger(percent) || percent < 0 || percent > 100 || !Number.isInteger(streak) || streak < 0) {
      Alert.alert(t("goals.templateRequired"));
      return;
    }
    const input: UpsertGoalTemplateInput = { learningLevelId: templateLearningLevelId, classroomId: templateClassroomId, name: templateName.trim(), description: templateDescription.trim(), durationDays: duration, minimumYesPercent: percent, minimumYesStreak: streak };
    void saveTemplate.mutateAsync(input).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  };
  const openAddIndicator = () => { setEditingIndicator(null); setIndicatorName(""); setIndicatorSheetOpen(true); };
  const openEditIndicatorForm = (indicator: GoalIndicator) => { setEditingIndicator(indicator); setIndicatorName(indicator.name); setIndicatorSheetOpen(true); };
  const closeIndicatorSheet = () => { setIndicatorSheetOpen(false); setEditingIndicator(null); setIndicatorName(""); };
  const saveIndicator = async () => {
    if (!indicatorName.trim()) return;
    try {
      if (editingIndicator) await updateIndicatorMutation.mutateAsync({ indicatorId: editingIndicator.id, indicatorInput: { name: indicatorName.trim(), displayOrder: editingIndicator.displayOrder } });
      else await createIndicator.mutateAsync({ name: indicatorName.trim() });
      closeIndicatorSheet();
    } catch (error) { Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const activeIndicatorCount = editingTemplate?.indicators.filter((indicator) => indicator.active).length ?? 0;
  const goalsListContent = <>
    {selectedChild && canAdmin && <Button onPress={() => { setGoalsListOpen(false); setSheet("assign"); }}>{t("goals.assign")}</Button>}
    {goals.data?.map((goal) => <View key={goal.id} style={styles.card}>
      <AppText variant="label">{goal.name}</AppText>
      <AppText tone="muted">{formatDate(goal.startsOn)} – {formatDate(goal.targetEndsOn)}</AppText>
      <AppText>{t("goals.progress", { yes: goal.yesDays, recorded: goal.recordedDays, percent: goal.yesPercent ?? 0, streak: goal.longestYesStreak })}</AppText>
      <AppText tone="muted">{t(goal.meetsYesPercent && goal.meetsYesStreak ? "goals.targetsMet" : "goals.targetsPending")}</AppText>
      <View style={styles.checkIns}>{goal.checkIns.map((checkInItem) => <View key={`${checkInItem.date}-${checkInItem.indicatorId}`} style={styles.checkIn}><AppText tone="muted">{formatDate(checkInItem.date)} · {goal.indicators.find((indicator) => indicator.id === checkInItem.indicatorId)?.name}</AppText><AppText>{t(checkInItem.outcome === "YES" ? "goals.yes" : "goals.no")}</AppText></View>)}</View>
      {goal.status === "ACTIVE" && canWrite && <View style={styles.indicators}>{goal.indicators.filter((indicator) => indicator.active).map((indicator) => <View key={indicator.id} style={styles.indicator}><AppText variant="label">{indicator.name}</AppText><View style={styles.options}>{goalCheckInOutcomes.map((outcome) => <Button key={outcome} variant="secondary" loading={checkIn.isPending} onPress={() => void checkIn.mutateAsync({ goalId: goal.id, indicatorId: indicator.id, outcome }).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")))}>{t(outcome === "YES" ? "goals.yes" : "goals.no")}</Button>)}</View></View>)}<Button onPress={() => { setGoalsListOpen(false); setFinalGoalId(goal.id); setSheet("finalize"); }}>{t("goals.finalize")}</Button></View>}
      {goal.status === "COMPLETED" && <><AppText>{t(goal.finalOutcome === "ACHIEVED" ? "goals.achieved" : "goals.notAchieved")}</AppText><AppText tone="muted">{goal.finalSummary}</AppText></>}
    </View>)}
    {selectedChild && goals.data?.length === 0 && <AppText tone="muted">{t("goals.empty")}</AppText>}
  </>;

  return <AppScreen showBottomNavigation={false} title={t("goals.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("goals.subtitle")}</AppText>

    {canAdmin && <NavigationCard accessibilityLabel={t("goals.templates")} onPress={() => setTemplatesListOpen(true)}>
      <AppText variant="h5">{t("goals.templates")}</AppText>
      <AppText tone={templates.data?.length ? "default" : "muted"}>{templates.data?.length ? t("goals.templatesSummary", { count: templates.data.length }) : t("goals.noTemplates")}</AppText>
    </NavigationCard>}

    <View style={styles.section}>
      <View style={styles.row}><AppText variant="heading">{t("goals.childGoals")}</AppText>{isStaffAdmin && <Button variant="secondary" onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}</View>
      {isStaffAdmin && (childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
      {hasFixedChild && selectedChild && <AppText variant="heading">{selectedChild.fullName}</AppText>}
      {!hasFixedChild && <View style={styles.options}>{children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>}
      {hasFixedChild && !children.isLoading && !selectedChild && <AppText tone="muted">{t("children.empty")}</AppText>}
      {selectedChild && !hasFixedChild && <NavigationCard accessibilityLabel={t("goals.childGoals")} onPress={() => setGoalsListOpen(true)}>
        <AppText variant="h5">{selectedChild.fullName}</AppText>
        <AppText tone={goals.data?.length ? "default" : "muted"}>{goals.data?.length ? t("goals.goalsSummary", { count: goals.data.length }) : t("goals.empty")}</AppText>
      </NavigationCard>}
      {selectedChild && hasFixedChild && goalsListContent}
    </View>

    <BottomSheet visible={templatesListOpen} onClose={() => setTemplatesListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("goals.templates")}>
      <Button onPress={openCreateTemplate}>{t("goals.addTemplate")}</Button>
      {goalCategories.map((category) => {
        const categoryTemplates = templates.data?.filter((template) => template.category === category) ?? [];
        if (categoryTemplates.length === 0) return null;
        return <View key={category} style={styles.categorySection}>
          <AppText variant="heading">{t(goalCategoryKey(category))}</AppText>
          {categoryTemplates.map((template) => <TemplateCard key={template.id} template={template} onEdit={() => openEditTemplateForm(template.id)} onArchive={() => void archiveTemplate.mutateAsync(template.id)} />)}
        </View>;
      })}
      {(templates.data?.filter((template) => !template.category) ?? []).map((template) => <TemplateCard key={template.id} template={template} onEdit={() => openEditTemplateForm(template.id)} onArchive={() => void archiveTemplate.mutateAsync(template.id)} />)}
      {templates.data?.length === 0 && <AppText tone="muted">{t("goals.noTemplates")}</AppText>}
    </BottomSheet>

    {!hasFixedChild && <BottomSheet visible={goalsListOpen} onClose={() => setGoalsListOpen(false)} closeAccessibilityLabel={t("common.close")} title={selectedChild?.fullName ?? t("goals.childGoals")}>
      {goalsListContent}
    </BottomSheet>}

    <BottomSheet visible={sheet === "assign"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("goals.assign")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("goals.assign"), disabled: !templateId, loading: assign.isPending, onPress: () => void assign.mutateAsync().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) ) }}><View style={styles.options}>{availableTemplates.map((template) => <Button key={template.id} variant={templateId === template.id ? "primary" : "secondary"} onPress={() => setTemplateId(template.id)}>{template.name}</Button>)}</View></BottomSheet>
    <BottomSheet visible={sheet === "finalize"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("goals.finalize")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("goals.finalize"), disabled: !finalSummary.trim(), loading: finalize.isPending, onPress: () => void finalize.mutateAsync().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) ) }}><View style={styles.options}>{childGoalOutcomes.map((outcome) => <Button key={outcome} variant={finalOutcome === outcome ? "primary" : "secondary"} onPress={() => setFinalOutcome(outcome)}>{t(outcome === "ACHIEVED" ? "goals.achieved" : "goals.notAchieved")}</Button>)}</View><TextInput style={[styles.input, styles.summaryInput]} multiline placeholder={t("goals.finalSummary")} value={finalSummary} onChangeText={setFinalSummary} /></BottomSheet>

    <BottomSheet
      visible={templateFormOpen}
      onClose={closeTemplateForm}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingTemplateId ? "goals.editTemplate" : "goals.addTemplate")}
      negativeAction={{ label: t("common.cancel"), onPress: closeTemplateForm }}
      positiveAction={{ label: t("common.save"), loading: saveTemplate.isPending, onPress: submitTemplateForm }}
    >
      <GoalFormField id="name" label={t("goals.templateName")} info={t("goals.templateNameInfo")} infoAction={t(openInfo === "name" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "name"} onToggle={() => setOpenInfo((current) => current === "name" ? null : "name")}><TextInput style={styles.input} placeholder={t("goals.templateName")} value={templateName} onChangeText={setTemplateName} /></GoalFormField>
      <GoalFormField id="description" label={t("goals.templateDescription")} info={t("goals.templateDescriptionInfo")} infoAction={t(openInfo === "description" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "description"} onToggle={() => setOpenInfo((current) => current === "description" ? null : "description")}><TextInput style={styles.input} placeholder={t("goals.templateDescription")} value={templateDescription} onChangeText={setTemplateDescription} /></GoalFormField>
      <GoalFormField id="level" label={t("goals.learningLevel")} info={t("goals.learningLevelInfo")} infoAction={t(openInfo === "level" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "level"} onToggle={() => setOpenInfo((current) => current === "level" ? null : "level")}><View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={templateLearningLevelId === level.id ? "primary" : "secondary"} onPress={() => { setTemplateLearningLevelId(level.id); setTemplateClassroomId(undefined); }}>{level.name}</Button>)}</View></GoalFormField>
      <GoalFormField id="classroom" label={t("goals.classroomOptional")} info={t("goals.classroomInfo")} infoAction={t(openInfo === "classroom" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "classroom"} onToggle={() => setOpenInfo((current) => current === "classroom" ? null : "classroom")}><View style={styles.options}>{classrooms.data?.filter((classroom) => classroom.active && (!templateLearningLevelId || classroom.learningLevelId === templateLearningLevelId)).map((classroom) => <Button key={classroom.id} variant={templateClassroomId === classroom.id ? "primary" : "secondary"} onPress={() => { setTemplateClassroomId(classroom.id); setTemplateLearningLevelId(classroom.learningLevelId ?? undefined); }}>{classroom.name}</Button>)}</View></GoalFormField>
      <GoalFormField id="duration" label={t("goals.durationDays")} info={t("goals.durationDaysInfo")} infoAction={t(openInfo === "duration" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "duration"} onToggle={() => setOpenInfo((current) => current === "duration" ? null : "duration")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.durationDays")} value={templateDurationDays} onChangeText={setTemplateDurationDays} /></GoalFormField>
      <GoalFormField id="percent" label={t("goals.minimumPercent")} info={t("goals.minimumPercentInfo")} infoAction={t(openInfo === "percent" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "percent"} onToggle={() => setOpenInfo((current) => current === "percent" ? null : "percent")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumPercent")} value={templateMinimumPercent} onChangeText={setTemplateMinimumPercent} /></GoalFormField>
      <GoalFormField id="streak" label={t("goals.minimumStreak")} info={t("goals.minimumStreakInfo")} infoAction={t(openInfo === "streak" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "streak"} onToggle={() => setOpenInfo((current) => current === "streak" ? null : "streak")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumStreak")} value={templateMinimumStreak} onChangeText={setTemplateMinimumStreak} /></GoalFormField>

      {editingTemplateId && editingTemplate && <View style={styles.field}>
        <View style={styles.fieldHeader}><AppText variant="label">{t("goals.indicators")}</AppText><Button variant="secondary" onPress={openAddIndicator}>{t("goals.addIndicator")}</Button></View>
        <AppText variant="caption" tone="muted">{t("goals.indicatorsInfo")}</AppText>
        {editingTemplate.indicators.map((indicator) => <View key={indicator.id} style={[styles.indicatorRow, !indicator.active && styles.indicatorRowArchived]}>
          <AppText style={styles.indicatorName}>{indicator.name}</AppText>
          {!indicator.active && <AppText variant="caption" tone="muted">{t("learning.archived")}</AppText>}
          <View style={styles.indicatorActions}>
            <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("common.edit")} onPress={() => openEditIndicatorForm(indicator)} />
            {indicator.active && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("goals.archive")} disabled={activeIndicatorCount <= 1} onPress={() => void archiveIndicatorMutation.mutateAsync(indicator.id).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")))} />}
          </View>
        </View>)}
      </View>}
    </BottomSheet>

    <BottomSheet
      visible={indicatorSheetOpen}
      onClose={closeIndicatorSheet}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingIndicator ? "goals.editIndicator" : "goals.addIndicator")}
      negativeAction={{ label: t("common.cancel"), onPress: closeIndicatorSheet }}
      positiveAction={{ label: t("common.save"), loading: createIndicator.isPending || updateIndicatorMutation.isPending, disabled: !indicatorName.trim(), onPress: () => void saveIndicator() }}
    >
      <TextInput style={styles.input} placeholder={t("goals.indicatorName")} value={indicatorName} onChangeText={setIndicatorName} />
    </BottomSheet>

    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}

function TemplateCard({ template, onEdit, onArchive }: { template: GoalTemplate; onEdit: () => void; onArchive: () => void }) {
  const { t } = useI18n();
  return <View style={styles.card}>
    <AppText variant="label">{template.name}{template.source === "GLOBAL" ? ` · ${t("globalCurriculum.global")}` : ""}</AppText>
    <AppText tone="muted">{t("goals.target", { days: template.durationDays, percent: template.minimumYesPercent, streak: template.minimumYesStreak })}</AppText>
    {template.minAgeMonths != null && template.maxAgeMonths != null && <AppText variant="caption" tone="muted">{t("goals.ageRangeYears", { min: template.minAgeMonths / 12, max: template.maxAgeMonths / 12 })}</AppText>}
    {template.source === "TENANT" && <View style={styles.options}>
      <Button variant="secondary" onPress={onEdit}>{t("common.edit")}</Button>
      {template.active && <Button variant="danger" onPress={onArchive}>{t("goals.archive")}</Button>}
    </View>}
  </View>;
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
  section: { gap: spacing.sm },
  categorySection: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  indicators: { gap: spacing.sm },
  indicator: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  checkIns: { gap: spacing.xs },
  checkIn: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  summaryInput: { minHeight: 100, paddingTop: spacing.sm, textAlignVertical: "top" },
  field: { gap: spacing.xs },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  info: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  infoToggle: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.7 },
  indicatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  indicatorRowArchived: { opacity: 0.7 },
  indicatorName: { flex: 1 },
  indicatorActions: { flexDirection: "row", gap: spacing.sm },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
