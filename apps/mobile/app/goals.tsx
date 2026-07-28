import { useEffect, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildListFilter, CurriculumProgram, DevelopmentProgram, GoalCheckInAudioInput, GoalCheckInPhotoInput, GoalIndicator, UpsertDevelopmentProgramInput } from "@daycare/api-client";
import { childGoalOutcomes, goalDomains, goalCheckInOutcomes, type ChildGoalOutcome, type GoalDomain } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";
import { goalDomainKey } from "@/i18n/translations";
import { formatIsoDate } from "@/date-picker/date";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";
import { resolveSelectedChildId } from "@/development/selectedChild";
import { ageInMonths } from "@/development/childAge";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { useAudioRecording, useAudioPlayback } from "@/audio";
import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";
import { checkInAudioPlaybackUri } from "@/development/checkInAudioUri";

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
  const [programSearch, setProgramSearch] = useState("");
  const [debouncedProgramSearch, setDebouncedProgramSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedProgramSearch(programSearch.trim()), 300);
    return () => clearTimeout(handle);
  }, [programSearch]);
  const programs = useQuery({ queryKey: ["development-programs", organizationId, debouncedProgramSearch], queryFn: () => api.developmentPrograms(debouncedProgramSearch || undefined), enabled: canWrite });
  const curriculumPrograms = useQuery({ queryKey: ["curriculum-programs", organizationId], queryFn: () => api.curriculumPrograms(), enabled: canWrite });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: canWrite });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: canWrite });
  const goals = useQuery({ queryKey: ["child-goals", organizationId, childId], queryFn: () => api.childGoals(childId!), enabled: Boolean(selectedChild && membership) });
  const refreshGoals = () => { void queryClient.invalidateQueries({ queryKey: ["development-programs", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["child-goals", organizationId, childId] }); };
  const [sheet, setSheet] = useState<Sheet>(null);
  const [curriculumProgramId, setCurriculumProgramId] = useState<string>(); const [programId, setProgramId] = useState<string>(); const [finalGoalId, setFinalGoalId] = useState<string>(); const [finalOutcome, setFinalOutcome] = useState<ChildGoalOutcome>("ACHIEVED"); const [finalSummary, setFinalSummary] = useState("");
  const assignPrograms = useQuery({ queryKey: ["development-programs", organizationId, curriculumProgramId, debouncedProgramSearch], queryFn: () => api.developmentPrograms(debouncedProgramSearch || undefined, curriculumProgramId), enabled: canWrite && Boolean(curriculumProgramId) });
  const assign = useMutation({ mutationFn: () => api.assignChildGoal(childId!, { curriculumProgramId: curriculumProgramId!, programId: programId! }), onSuccess: () => { refreshGoals(); setSheet(null); setCurriculumProgramId(undefined); setProgramId(undefined); } });
  const finalize = useMutation({ mutationFn: () => api.finalizeChildGoal(finalGoalId!, { outcome: finalOutcome, summary: finalSummary.trim() }), onSuccess: () => { refreshGoals(); setSheet(null); setFinalGoalId(undefined); setFinalSummary(""); } });
  const checkIn = useMutation({
    mutationFn: ({ goalId, indicatorId, outcome, note, photo, audio }: { goalId: string; indicatorId: string; outcome: (typeof goalCheckInOutcomes)[number]; note?: string; photo?: GoalCheckInPhotoInput; audio?: GoalCheckInAudioInput }) =>
      api.recordGoalCheckIn(goalId, formatIsoDate(new Date()), indicatorId, outcome, { note, photo, audio }),
    onSuccess: refreshGoals,
  });
  const [expandedDetailKey, setExpandedDetailKey] = useState<string | null>(null);
  const selectedClassroom = classrooms.data?.find((classroom) => classroom.id === selectedChild?.classroomId);
  const selectedChildAgeMonths = selectedChild ? ageInMonths(selectedChild.dateOfBirth) : null;
  const matchesGlobalAgeRange = (program: DevelopmentProgram) => program.minAgeMonths == null || program.maxAgeMonths == null || selectedChildAgeMonths == null
    || (selectedChildAgeMonths >= program.minAgeMonths && selectedChildAgeMonths <= program.maxAgeMonths);
  const availablePrograms = assignPrograms.data?.filter((program) => program.active
    && (program.source === "GLOBAL" ? matchesGlobalAgeRange(program) : program.learningLevelId === selectedClassroom?.learningLevelId)) ?? [];
  const availableCurriculumPrograms = curriculumPrograms.data?.filter((program) => program.active) ?? [];

  const [goalsListOpen, setGoalsListOpen] = useState(false);
  const [programFormOpen, setProgramFormOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string>();
  const editingProgram = editingProgramId ? programs.data?.find((item) => item.id === editingProgramId) : null;
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [programDurationDays, setProgramDurationDays] = useState("100");
  const [programMinimumPercent, setProgramMinimumPercent] = useState("90");
  const [programMinimumStreak, setProgramMinimumStreak] = useState("14");
  const [programLearningLevelId, setProgramLearningLevelId] = useState<string>();
  const [programDomain, setProgramDomain] = useState<GoalDomain>();
  const [newIndicatorNames, setNewIndicatorNames] = useState<string[]>([""]);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [indicatorSheetOpen, setIndicatorSheetOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<GoalIndicator | null>(null);
  const [indicatorName, setIndicatorName] = useState("");

  useEffect(() => {
    if (!editingProgram) return;
    setProgramName(editingProgram.name);
    setProgramDescription(editingProgram.description);
    setProgramDurationDays(String(editingProgram.durationDays));
    setProgramMinimumPercent(String(editingProgram.minimumYesPercent));
    setProgramMinimumStreak(String(editingProgram.minimumYesStreak));
    setProgramLearningLevelId(editingProgram.learningLevelId);
    setProgramDomain(editingProgram.domain);
  }, [editingProgram]);

  const saveProgram = useMutation({
    mutationFn: (input: UpsertDevelopmentProgramInput) => editingProgramId ? api.updateDevelopmentProgram(editingProgramId, input) : api.createDevelopmentProgram(input),
    onSuccess: (saved) => { refreshGoals(); if (!editingProgramId) setEditingProgramId(saved.id); },
  });
  const createIndicator = useMutation({ mutationFn: (indicatorInput: { name: string }) => api.createGoalIndicator(editingProgramId!, indicatorInput), onSuccess: refreshGoals });
  const updateIndicatorMutation = useMutation({ mutationFn: ({ indicatorId, indicatorInput }: { indicatorId: string; indicatorInput: { name: string; displayOrder: number } }) => api.updateGoalIndicator(editingProgramId!, indicatorId, indicatorInput), onSuccess: refreshGoals });
  const archiveIndicatorMutation = useMutation({ mutationFn: (indicatorId: string) => api.archiveGoalIndicator(editingProgramId!, indicatorId), onSuccess: refreshGoals });

  if (!profile || !membership) return null;

  const resetProgramForm = () => { setProgramName(""); setProgramDescription(""); setProgramDurationDays("100"); setProgramMinimumPercent("90"); setProgramMinimumStreak("14"); setProgramLearningLevelId(undefined); setProgramDomain(undefined); setNewIndicatorNames([""]); setOpenInfo(null); };
  const openCreateProgram = () => { setEditingProgramId(undefined); resetProgramForm(); setProgramFormOpen(true); };
  const closeProgramForm = () => { setProgramFormOpen(false); setEditingProgramId(undefined); resetProgramForm(); };
  const updateNewIndicatorName = (index: number, value: string) => setNewIndicatorNames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  const addNewIndicatorField = () => setNewIndicatorNames((current) => [...current, ""]);
  const removeNewIndicatorField = (index: number) => setNewIndicatorNames((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current);
  const submitProgramForm = () => {
    const duration = Number(programDurationDays);
    const percent = Number(programMinimumPercent);
    const streak = Number(programMinimumStreak);
    if (!programName.trim() || !programLearningLevelId || !programDomain || !Number.isInteger(duration) || duration < 1 || !Number.isInteger(percent) || percent < 0 || percent > 100 || !Number.isInteger(streak) || streak < 0) {
      Alert.alert(t("goals.templateRequired"));
      return;
    }
    const input: UpsertDevelopmentProgramInput = { learningLevelId: programLearningLevelId, name: programName.trim(), description: programDescription.trim(), durationDays: duration, minimumYesPercent: percent, minimumYesStreak: streak, domain: programDomain };
    if (!editingProgramId) input.indicatorNames = newIndicatorNames.map((name) => name.trim()).filter(Boolean);
    void saveProgram.mutateAsync(input).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
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
  const activeIndicatorCount = editingProgram?.indicators.filter((indicator) => indicator.active).length ?? 0;
  const totalMissedDays = goals.data?.filter((goal) => goal.status === "ACTIVE").reduce((sum, goal) => sum + goal.missedDays, 0) ?? 0;
  const openAssignment = () => { setGoalsListOpen(false); setCurriculumProgramId(undefined); setProgramId(undefined); setProgramSearch(""); setSheet("assign"); };
  const selectCurriculumProgram = (program: CurriculumProgram) => { setCurriculumProgramId(program.id); setProgramId(undefined); };
  const goalsListContent = <>
    {selectedChild && canWrite && <Button onPress={openAssignment}>{t("goals.assign")}</Button>}
    {goals.isFetching && <ShimmerList />}
    {!goals.isFetching && goals.data?.map((goal) => <View key={goal.id} style={styles.card}>
      <AppText variant="label">{goal.name}</AppText>
      <AppText tone="muted" variant="caption">{t("academic.program")}: {goal.curriculumProgramName ?? t("common.noData")}</AppText>
      <AppText tone="muted">{formatDate(goal.startsOn)} – {formatDate(goal.targetEndsOn)}</AppText>
      <AppText>{t("goals.progress", { yes: goal.yesDays, recorded: goal.recordedDays, percent: goal.yesPercent ?? 0, streak: goal.longestYesStreak })}</AppText>
      <AppText tone="muted">{t(goal.meetsYesPercent && goal.meetsYesStreak ? "goals.targetsMet" : "goals.targetsPending")}</AppText>
      {goal.status === "ACTIVE" && goal.missedDays > 0 && <View style={styles.missedBadge}><AppText tone="danger" variant="caption">{t("goals.missedDays", { count: goal.missedDays })}</AppText></View>}
      <View style={styles.checkIns}>{goal.checkIns.map((checkInItem) => <View key={`${checkInItem.date}-${checkInItem.indicatorId}`}>
        <View style={styles.checkIn}><AppText tone="muted">{formatDate(checkInItem.date)} · {goal.indicators.find((indicator) => indicator.id === checkInItem.indicatorId)?.name}</AppText><AppText>{t(checkInItem.outcome === "YES" ? "goals.yes" : "goals.no")}</AppText></View>
        {checkInItem.note && <AppText tone="muted" variant="caption">{checkInItem.note}</AppText>}
      </View>)}</View>
      {goal.status === "ACTIVE" && canWrite && <View style={styles.indicators}>{goal.indicators.filter((indicator) => indicator.active).map((indicator) => {
        const todayIso = formatIsoDate(new Date());
        const todayCheckIn = goal.checkIns.find((item) => item.indicatorId === indicator.id && item.date === todayIso);
        const detailKey = `${goal.id}:${indicator.id}`;
        const detailExpanded = expandedDetailKey === detailKey;
        return <View key={indicator.id} style={styles.indicator}>
          <AppText variant="label">{indicator.name}</AppText>
          <View style={styles.options}>{goalCheckInOutcomes.map((outcome) => <Button key={outcome} variant="secondary" loading={checkIn.isPending} onPress={() => void checkIn.mutateAsync({ goalId: goal.id, indicatorId: indicator.id, outcome }).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")))}>{t(outcome === "YES" ? "goals.yes" : "goals.no")}</Button>)}</View>
          {todayCheckIn && <Pressable accessibilityRole="button" accessibilityLabel={t(detailExpanded ? "goals.hideDetail" : "goals.addDetail")} accessibilityState={{ expanded: detailExpanded }} onPress={() => setExpandedDetailKey((current) => current === detailKey ? null : detailKey)} style={({ pressed }) => [styles.infoToggle, pressed && styles.pressed]}>
            <AppText variant="caption" tone="muted">ⓘ {t(detailExpanded ? "goals.hideDetail" : "goals.addDetail")}</AppText>
          </Pressable>}
          {todayCheckIn && detailExpanded && <CheckInDetailPanel
            goalId={goal.id}
            date={todayIso}
            indicatorId={indicator.id}
            existingNote={todayCheckIn.note}
            hasPhoto={todayCheckIn.hasPhoto}
            hasAudio={todayCheckIn.hasAudio}
            pending={checkIn.isPending}
            onSubmit={(detail) => checkIn.mutateAsync({ goalId: goal.id, indicatorId: indicator.id, outcome: todayCheckIn.outcome, ...detail })}
          />}
        </View>;
      })}</View>}
      {goal.status === "ACTIVE" && canWrite && <Button onPress={() => { setGoalsListOpen(false); setFinalGoalId(goal.id); setSheet("finalize"); }}>{t("goals.finalize")}</Button>}
      {goal.status === "COMPLETED" && <><AppText>{t(goal.finalOutcome === "ACHIEVED" ? "goals.achieved" : "goals.notAchieved")}</AppText><AppText tone="muted">{goal.finalSummary}</AppText></>}
    </View>)}
    {selectedChild && goals.data?.length === 0 && <AppText tone="muted">{t("goals.empty")}</AppText>}
  </>;

  return <AppScreen showBottomNavigation={false} title={t("goals.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canAdmin ? <FloatingActionButton accessibilityLabel={t("goals.addTemplate")} onPress={openCreateProgram}>+ {t("goals.addTemplate")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("goals.subtitle")}</AppText>

    <View style={styles.section}>
      <View style={styles.row}><AppText variant="heading">{t("goals.childGoals")}</AppText>{isStaffAdmin && <Button variant="secondary" onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}</View>
      {isStaffAdmin && (childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
      {hasFixedChild && selectedChild && <AppText variant="heading">{selectedChild.fullName}</AppText>}
      {!hasFixedChild && children.isFetching && <ShimmerList variant="tile" />}
      {!hasFixedChild && !children.isFetching && <View style={styles.options}>{children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>}
      {hasFixedChild && !children.isLoading && !selectedChild && <AppText tone="muted">{t("children.empty")}</AppText>}
      {selectedChild && !hasFixedChild && <NavigationCard accessibilityLabel={t("goals.childGoals")} onPress={() => setGoalsListOpen(true)}>
        <AppText variant="h5">{selectedChild.fullName}</AppText>
        <AppText tone={goals.data?.length ? "default" : "muted"}>{goals.data?.length ? t("goals.goalsSummary", { count: goals.data.length }) : t("goals.empty")}</AppText>
        {totalMissedDays > 0 && <AppText tone="danger" variant="caption">{t("goals.missedDays", { count: totalMissedDays })}</AppText>}
      </NavigationCard>}
      {selectedChild && hasFixedChild && goalsListContent}
    </View>

    {!hasFixedChild && <BottomSheet visible={goalsListOpen} onClose={() => setGoalsListOpen(false)} closeAccessibilityLabel={t("common.close")} title={selectedChild?.fullName ?? t("goals.childGoals")}>
      {goalsListContent}
    </BottomSheet>}

    <BottomSheet visible={sheet === "assign"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("goals.assign")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("goals.assign"), disabled: !curriculumProgramId || !programId, loading: assign.isPending, onPress: () => void assign.mutateAsync().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) ) }}>
      <AppText variant="label">{t("academic.program")}</AppText>
      {curriculumPrograms.isFetching && <ShimmerList variant="tile" />}
      {!curriculumPrograms.isFetching && <View style={styles.options}>{availableCurriculumPrograms.map((program) => <Button key={program.id} variant={curriculumProgramId === program.id ? "primary" : "secondary"} onPress={() => selectCurriculumProgram(program)}>{program.name}</Button>)}</View>}
      {curriculumPrograms.isError && <Button variant="secondary" onPress={() => void curriculumPrograms.refetch()}>{t("common.retry")}</Button>}
      {!curriculumPrograms.isFetching && !curriculumPrograms.isError && availableCurriculumPrograms.length === 0 && <AppText tone="muted">{t("academic.noPrograms")}</AppText>}
      {curriculumProgramId && <><AppText variant="label">{t("goals.templates")}</AppText><TextInput accessibilityLabel={t("goals.searchTemplates")} style={styles.input} placeholder={t("goals.searchTemplates")} value={programSearch} onChangeText={setProgramSearch} />{assignPrograms.isFetching && <ShimmerList variant="tile" />}{!assignPrograms.isFetching && <View style={styles.options}>{availablePrograms.map((program) => <Button key={program.id} variant={programId === program.id ? "primary" : "secondary"} onPress={() => setProgramId(program.id)}>{program.name}</Button>)}</View>}{assignPrograms.isError && <Button variant="secondary" onPress={() => void assignPrograms.refetch()}>{t("common.retry")}</Button>}{!assignPrograms.isFetching && !assignPrograms.isError && availablePrograms.length === 0 && <AppText tone="muted">{t("goals.notInAgeRange")}</AppText>}</>}
    </BottomSheet>
    <BottomSheet visible={sheet === "finalize"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("goals.finalize")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("goals.finalize"), disabled: !finalSummary.trim(), loading: finalize.isPending, onPress: () => void finalize.mutateAsync().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) ) }}><View style={styles.options}>{childGoalOutcomes.map((outcome) => <Button key={outcome} variant={finalOutcome === outcome ? "primary" : "secondary"} onPress={() => setFinalOutcome(outcome)}>{t(outcome === "ACHIEVED" ? "goals.achieved" : "goals.notAchieved")}</Button>)}</View><TextInput style={[styles.input, styles.summaryInput]} multiline placeholder={t("goals.finalSummary")} value={finalSummary} onChangeText={setFinalSummary} /></BottomSheet>

    <BottomSheet
      visible={programFormOpen}
      onClose={closeProgramForm}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingProgramId ? "goals.editTemplate" : "goals.addTemplate")}
      negativeAction={{ label: t("common.cancel"), onPress: closeProgramForm }}
      positiveAction={{ label: t("common.save"), loading: saveProgram.isPending, onPress: submitProgramForm }}
    >
      <GoalFormField id="name" label={t("goals.templateName")} info={t("goals.templateNameInfo")} infoAction={t(openInfo === "name" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "name"} onToggle={() => setOpenInfo((current) => current === "name" ? null : "name")}><TextInput style={styles.input} placeholder={t("goals.templateName")} value={programName} onChangeText={setProgramName} /></GoalFormField>
      <GoalFormField id="description" label={t("goals.templateDescription")} info={t("goals.templateDescriptionInfo")} infoAction={t(openInfo === "description" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "description"} onToggle={() => setOpenInfo((current) => current === "description" ? null : "description")}><TextInput style={styles.input} placeholder={t("goals.templateDescription")} value={programDescription} onChangeText={setProgramDescription} /></GoalFormField>
      <GoalFormField id="level" label={t("goals.learningLevel")} info={t("goals.learningLevelInfo")} infoAction={t(openInfo === "level" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "level"} onToggle={() => setOpenInfo((current) => current === "level" ? null : "level")}><View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={programLearningLevelId === level.id ? "primary" : "secondary"} onPress={() => setProgramLearningLevelId(level.id)}>{level.name}</Button>)}</View></GoalFormField>
      <GoalFormField id="domain" label={t("goals.categoryOptional")} info={t("goals.categoryInfo")} infoAction={t(openInfo === "domain" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "domain"} onToggle={() => setOpenInfo((current) => current === "domain" ? null : "domain")}><View style={styles.options}>{goalDomains.map((domain) => <Button key={domain} variant={programDomain === domain ? "primary" : "secondary"} onPress={() => setProgramDomain(domain)}>{t(goalDomainKey(domain))}</Button>)}</View></GoalFormField>
      <GoalFormField id="duration" label={t("goals.durationDays")} info={t("goals.durationDaysInfo")} infoAction={t(openInfo === "duration" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "duration"} onToggle={() => setOpenInfo((current) => current === "duration" ? null : "duration")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.durationDays")} value={programDurationDays} onChangeText={setProgramDurationDays} /></GoalFormField>
      <GoalFormField id="percent" label={t("goals.minimumPercent")} info={t("goals.minimumPercentInfo")} infoAction={t(openInfo === "percent" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "percent"} onToggle={() => setOpenInfo((current) => current === "percent" ? null : "percent")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumPercent")} value={programMinimumPercent} onChangeText={setProgramMinimumPercent} /></GoalFormField>
      <GoalFormField id="streak" label={t("goals.minimumStreak")} info={t("goals.minimumStreakInfo")} infoAction={t(openInfo === "streak" ? "goals.hideInfo" : "goals.showInfo")} expanded={openInfo === "streak"} onToggle={() => setOpenInfo((current) => current === "streak" ? null : "streak")}><TextInput style={styles.input} inputMode="numeric" placeholder={t("goals.minimumStreak")} value={programMinimumStreak} onChangeText={setProgramMinimumStreak} /></GoalFormField>

      {!editingProgramId && <View style={styles.field}>
        <View style={styles.fieldHeader}><AppText variant="label">{t("goals.indicators")}</AppText><Button variant="secondary" onPress={addNewIndicatorField}>{t("goals.addIndicator")}</Button></View>
        <AppText variant="caption" tone="muted">{t("goals.indicatorsInfo")}</AppText>
        {newIndicatorNames.map((name, index) => <View key={index} style={styles.indicatorRow}>
          <TextInput style={[styles.input, styles.indicatorName]} placeholder={t("goals.indicatorName")} value={name} onChangeText={(value) => updateNewIndicatorName(index, value)} />
          {newIndicatorNames.length > 1 && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("common.delete")} onPress={() => removeNewIndicatorField(index)} />}
        </View>)}
      </View>}

      {editingProgramId && editingProgram && <View style={styles.field}>
        <View style={styles.fieldHeader}><AppText variant="label">{t("goals.indicators")}</AppText><Button variant="secondary" onPress={openAddIndicator}>{t("goals.addIndicator")}</Button></View>
        <AppText variant="caption" tone="muted">{t("goals.indicatorsInfo")}</AppText>
        {editingProgram.indicators.map((indicator) => <View key={indicator.id} style={[styles.indicatorRow, !indicator.active && styles.indicatorRowArchived]}>
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

type CheckInDetailPanelProps = {
  goalId: string;
  date: string;
  indicatorId: string;
  existingNote?: string | null;
  hasPhoto: boolean;
  hasAudio: boolean;
  pending: boolean;
  onSubmit: (detail: { note?: string; photo?: GoalCheckInPhotoInput; audio?: GoalCheckInAudioInput }) => Promise<unknown>;
};

function CheckInDetailPanel({ goalId, date, indicatorId, existingNote, hasPhoto, hasAudio, pending, onSubmit }: CheckInDetailPanelProps) {
  const { api } = useAuth();
  const { t } = useI18n();
  const [note, setNote] = useState(existingNote ?? "");
  const imagePicker = useImagePicker();
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const audioRecording = useAudioRecording();
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const playback = useAudioPlayback(audioUri);

  const pickPhoto = async () => setPhoto((await imagePicker.pickFromLibrary())[0] ?? null);
  const takePhoto = async () => setPhoto(await imagePicker.takePhoto());
  const loadPhoto = async () => {
    setLoadingMedia(true);
    try {
      const result = await api.goalCheckInPhoto(goalId, date, indicatorId);
      setViewPhoto(`data:${result.contentType};base64,${result.dataBase64}`);
    } finally {
      setLoadingMedia(false);
    }
  };
  const loadAudio = async () => {
    setLoadingMedia(true);
    try {
      const result = await api.goalCheckInAudio(goalId, date, indicatorId);
      setAudioUri(await checkInAudioPlaybackUri(result.dataBase64));
    } finally {
      setLoadingMedia(false);
    }
  };
  const submit = async () => {
    const detail: { note?: string; photo?: GoalCheckInPhotoInput; audio?: GoalCheckInAudioInput } = {};
    if (note.trim() !== (existingNote ?? "")) detail.note = note.trim();
    if (photo) detail.photo = { contentType: photo.mimeType === "image/png" ? "image/png" : "image/jpeg", dataBase64: await encodeLocalFileBase64(photo.uri) };
    if (audioRecording.recording) detail.audio = { contentType: audioRecording.recording.mimeType, dataBase64: await encodeLocalFileBase64(audioRecording.recording.uri), durationMs: audioRecording.recording.durationMs };
    await onSubmit(detail);
    setPhoto(null);
    await audioRecording.clear();
  };

  return <View style={styles.detailPanel}>
    <TextInput style={styles.input} multiline placeholder={t("goals.checkInNote")} value={note} onChangeText={setNote} />
    {photo && <Image source={{ uri: photo.uri }} style={styles.detailPreview} resizeMode="contain" />}
    <View style={styles.options}>
      <Button variant="secondary" onPress={() => void pickPhoto()}>{t("goals.pickPhoto")}</Button>
      <Button variant="secondary" onPress={() => void takePhoto()}>{t("goals.takePhoto")}</Button>
      {audioRecording.status !== "unsupported" && (audioRecording.status === "recording"
        ? <Button variant="secondary" onPress={() => void audioRecording.stop()}>{t("goals.stopRecording")}</Button>
        : <Button variant="secondary" onPress={() => void audioRecording.start()}>{t("goals.recordAudio")}</Button>)}
    </View>
    {audioRecording.recording && <AppText tone="muted" variant="caption">{t("goals.audioReady", { seconds: Math.round(audioRecording.recording.durationMs / 1000) })}</AppText>}
    {audioRecording.error && <AppText tone="muted" variant="caption">{audioRecording.error.message}</AppText>}

    <View style={styles.options}>
      {hasPhoto && !photo && <Button variant="secondary" loading={loadingMedia} onPress={() => void loadPhoto()}>{t("goals.viewPhoto")}</Button>}
      {hasAudio && <Button variant="secondary" loading={loadingMedia} onPress={() => audioUri ? (playback.status === "playing" ? playback.pause() : playback.play()) : void loadAudio()}>{t(audioUri && playback.status === "playing" ? "goals.pauseAudio" : "goals.playAudio")}</Button>}
    </View>
    {viewPhoto && <Image source={{ uri: viewPhoto }} style={styles.detailPreview} resizeMode="contain" />}

    <Button loading={pending} onPress={() => void submit().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")))}>{t("common.save")}</Button>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  indicators: { gap: spacing.sm },
  indicator: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  checkIns: { gap: spacing.xs },
  checkIn: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  missedBadge: { alignSelf: "flex-start", paddingVertical: spacing.xs / 2, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
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
  detailPanel: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  detailPreview: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
