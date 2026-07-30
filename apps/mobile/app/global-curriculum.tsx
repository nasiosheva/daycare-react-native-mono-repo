import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurriculumProgram } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { goalPickerLabel } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import { AppScreen } from "@/navigation/AppScreen";

export default function GlobalCurriculumScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const programs = useQuery({ queryKey: ["global-curriculum-programs"], queryFn: () => api.globalCurriculumPrograms(true), enabled: Boolean(profile?.isPlatformAdmin) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["global-curriculum-programs"] });
  const createProgram = useMutation({ mutationFn: api.createGlobalCurriculumProgram.bind(api), onSuccess: refresh });
  const updateProgram = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateGlobalCurriculumProgram>[1] }) => api.updateGlobalCurriculumProgram(id, input), onSuccess: refresh });
  const setActive = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setGlobalCurriculumProgramActive(id, active), onSuccess: refresh });
  const seedReferenceData = useMutation({
    mutationFn: () => api.seedGlobalCurriculum(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["global-development-programs"] });
      const params = { levels: result.learningLevelCount, programs: result.developmentProgramCount, items: result.developmentProgramItemCount };
      notify(t(result.alreadySeeded ? "globalCurriculum.seedAlreadyDone" : "globalCurriculum.seedSuccess", params));
    },
    onError: (error) => notify(t("globalCurriculum.seedFailed"), error instanceof Error ? error.message : t("auth.tryAgain")),
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CurriculumProgram>();
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [goalSearch, setGoalSearch] = useState(""); const [debouncedGoalSearch, setDebouncedGoalSearch] = useState(""); const [developmentProgramIds, setDevelopmentProgramIds] = useState<string[]>([]);
  useEffect(() => { const handle = setTimeout(() => setDebouncedGoalSearch(goalSearch.trim()), 300); return () => clearTimeout(handle); }, [goalSearch]);
  const goals = useQuery({ queryKey: ["global-development-programs", debouncedGoalSearch], queryFn: () => api.globalDevelopmentPrograms(debouncedGoalSearch || undefined), enabled: Boolean(profile?.isPlatformAdmin) });

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;
  const closeSheet = () => { setSheetOpen(false); setEditing(undefined); setName(""); setDescription(""); setGoalSearch(""); setDevelopmentProgramIds([]); };
  const openAdd = () => { closeSheet(); setSheetOpen(true); };
  const openEdit = (program: CurriculumProgram) => { setEditing(program); setName(program.name); setDescription(program.description); setDevelopmentProgramIds(program.developmentProgramIds); setSheetOpen(true); };
  const save = async () => {
    if (!name.trim()) return Alert.alert(t("globalCurriculum.required"));
    const input = { name: name.trim(), description: description.trim(), developmentProgramIds };
    try { if (editing) await updateProgram.mutateAsync({ id: editing.id, input }); else await createProgram.mutateAsync(input); closeSheet(); }
    catch (error) { Alert.alert(t("globalCurriculum.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const visibleGoals = goals.data?.filter((goal) => goal.active) ?? [];
  const toggleGoal = (id: string) => setDevelopmentProgramIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);

  return <AppScreen showBottomNavigation={false} title={t("globalCurriculum.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton accessibilityLabel={t("globalCurriculum.add")} onPress={openAdd}>+ {t("globalCurriculum.add")}</FloatingActionButton>}>
    <AppText tone="muted">{t("globalCurriculum.subtitle")}</AppText>
    <Button variant="secondary" loading={seedReferenceData.isPending} onPress={() => void seedReferenceData.mutateAsync()}>{t("globalCurriculum.seed")}</Button>
    {programs.isFetching ? <ShimmerList /> : programs.data?.filter((program) => program.active).map((program) => <ProgramCard key={program.id} program={program} t={t} onEdit={() => openEdit(program)} onActiveChange={(active) => void setActive.mutateAsync({ id: program.id, active })} />)}
    {!programs.isFetching && programs.data?.filter((program) => program.active).length === 0 && <AppText tone="muted">{t("globalCurriculum.empty")}</AppText>}
    {programs.data?.some((program) => !program.active) && <View style={styles.archivedSection}><AppText variant="label">{t("learning.archived")}</AppText>{programs.data.filter((program) => !program.active).map((program) => <ProgramCard key={program.id} program={program} t={t} onEdit={() => openEdit(program)} onActiveChange={(active) => void setActive.mutateAsync({ id: program.id, active })} />)}</View>}
    <BottomSheet visible={sheetOpen} onClose={closeSheet} closeAccessibilityLabel={t("common.close")} title={t(editing ? "common.edit" : "globalCurriculum.add")} negativeAction={{ label: t("common.cancel"), onPress: closeSheet }} positiveAction={{ label: t("common.save"), loading: createProgram.isPending || updateProgram.isPending, disabled: !name.trim(), onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={name} onChangeText={setName} />
      <TextInput style={[styles.input, styles.description]} placeholder={t("academic.description")} value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">{t("academic.programGoals", { count: developmentProgramIds.length })}</AppText>
      <TextInput style={styles.input} placeholder={t("academic.searchProgramGoals")} value={goalSearch} onChangeText={setGoalSearch} />
      {goals.isFetching && <ShimmerList />}
      {visibleGoals.map((goal) => <Button key={goal.id} variant={developmentProgramIds.includes(goal.id) ? "primary" : "secondary"} onPress={() => toggleGoal(goal.id)}>{goalPickerLabel(t, goal.domain, goal.name)}</Button>)}
      {!goals.isFetching && visibleGoals.length === 0 && <AppText tone="muted">{t("academic.noProgramGoals")}</AppText>}
    </BottomSheet>
  </AppScreen>;
}

function ProgramCard({ program, t, onEdit, onActiveChange }: { program: CurriculumProgram; t: ReturnType<typeof useI18n>["t"]; onEdit: () => void; onActiveChange: (active: boolean) => void }) {
  return <View style={[styles.card, !program.active && styles.archivedCard]}><AppText variant="label">{program.name}</AppText>{program.description && <AppText tone="muted">{program.description}</AppText>}<AppText variant="caption" tone="muted">{t("academic.programGoals", { count: program.developmentProgramIds.length })}</AppText><View style={styles.actions}><Button variant="secondary" onPress={onEdit}>{t("common.edit")}</Button><Button variant="secondary" onPress={() => onActiveChange(!program.active)}>{t(program.active ? "learning.archive" : "learning.active")}</Button></View></View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  archivedCard: { opacity: 0.72 },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  description: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  archivedSection: { gap: spacing.sm },
});
