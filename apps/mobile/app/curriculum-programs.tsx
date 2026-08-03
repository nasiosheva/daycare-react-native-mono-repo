import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurriculumProgram } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { goalPickerLabel } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

type Translate = ReturnType<typeof useI18n>["t"];

export default function CurriculumProgramsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const access = useUiAccessContext(Boolean(membership));
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: hasAcademicOffering });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [goalSearch, setGoalSearch] = useState("");
  const [debouncedGoalSearch, setDebouncedGoalSearch] = useState("");
  useEffect(() => { const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(handle); }, [search]);
  useEffect(() => { const handle = setTimeout(() => setDebouncedGoalSearch(goalSearch.trim()), 300); return () => clearTimeout(handle); }, [goalSearch]);
  const programs = useQuery({ queryKey: ["curriculum-programs", organizationId, debouncedSearch], queryFn: () => api.curriculumPrograms(debouncedSearch || undefined, true), enabled: hasAcademicOffering });
  const developmentProgramsQuery = useQuery({ queryKey: ["development-programs", organizationId, debouncedGoalSearch], queryFn: () => api.developmentPrograms(debouncedGoalSearch || undefined), enabled: hasAcademicOffering && canManage });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["curriculum-programs", organizationId] });
  const createProgram = useMutation({ mutationFn: api.createCurriculumProgram.bind(api), onSuccess: refresh });
  const updateProgram = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateCurriculumProgram>[1] }) => api.updateCurriculumProgram(id, input), onSuccess: refresh });
  const setProgramActive = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setCurriculumProgramActive(id, active), onSuccess: refresh });
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<CurriculumProgram>();
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [periodId, setPeriodId] = useState<string | undefined>(); const [developmentProgramIds, setDevelopmentProgramIds] = useState<string[]>([]);

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  if (!access.isLoading && !hasAcademicOffering) return <Redirect href="/academic" />;

  const close = () => { setVisible(false); setEditing(undefined); setName(""); setDescription(""); setPeriodId(undefined); setDevelopmentProgramIds([]); setGoalSearch(""); };
  const openAdd = () => { close(); setVisible(true); };
  const openEdit = (program: CurriculumProgram) => { setEditing(program); setName(program.name); setDescription(program.description); setPeriodId(program.academicYearId ?? undefined); setDevelopmentProgramIds(program.developmentProgramIds); setVisible(true); };
  const save = async () => {
    if (!name.trim()) return Alert.alert(t("academic.programRequired"));
    const input = { academicYearId: periodId, name: name.trim(), description: description.trim(), developmentProgramIds };
    try { if (editing) await updateProgram.mutateAsync({ id: editing.id, input }); else await createProgram.mutateAsync(input); close(); }
    catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const toggleGoal = (id: string) => setDevelopmentProgramIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const selectedGoalCount = developmentProgramIds.length;
  const activePrograms = programs.data?.filter((program) => program.active) ?? [];
  const archivedPrograms = programs.data?.filter((program) => !program.active) ?? [];

  return <AppScreen showBottomNavigation={false} title={t("academic.program")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton accessibilityLabel={t("academic.addProgram")} onPress={openAdd}>+ {t("academic.addProgram")}</FloatingActionButton> : undefined}>
    <AppText variant="bodySmall" tone="muted">{t("academic.addProgramDescription")}</AppText>
    <TextInput style={styles.input} placeholder={t("academic.searchPrograms")} value={search} onChangeText={setSearch} />
    {programs.isFetching && <ShimmerList />}
    {programs.isError && <Button variant="secondary" onPress={() => programs.refetch()}>{t("common.retry")}</Button>}
    {!programs.isFetching && activePrograms.map((program) => <ProgramCard key={program.id} program={program} periodName={periods.data?.find((period) => period.id === program.academicYearId)?.name} canManage={canManage} t={t} onEdit={() => openEdit(program)} onActiveChange={(active) => void setProgramActive.mutateAsync({ id: program.id, active })} />)}
    {!programs.isFetching && !programs.isError && activePrograms.length === 0 && <AppText tone="muted">{t("academic.noPrograms")}</AppText>}
    {archivedPrograms.length > 0 && <View style={styles.archivedSection}><AppText variant="label">{t("learning.archived")}</AppText>{archivedPrograms.map((program) => <ProgramCard key={program.id} program={program} periodName={periods.data?.find((period) => period.id === program.academicYearId)?.name} canManage={canManage} t={t} onEdit={() => openEdit(program)} onActiveChange={(active) => void setProgramActive.mutateAsync({ id: program.id, active })} />)}</View>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t(editing ? "common.edit" : "academic.addProgram")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("common.save"), loading: createProgram.isPending || updateProgram.isPending, onPress: () => void save() }}>
      <View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={periodId === period.id ? "primary" : "secondary"} onPress={() => setPeriodId((current) => current === period.id ? undefined : period.id)}>{period.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={name} onChangeText={setName} />
      <TextInput style={[styles.input, styles.description]} placeholder={t("academic.description")} value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">{t("academic.programGoals", { count: selectedGoalCount })}</AppText>
      <TextInput style={styles.input} placeholder={t("academic.searchProgramGoals")} value={goalSearch} onChangeText={setGoalSearch} />
      {developmentProgramsQuery.isFetching && <ShimmerList />}
      {developmentProgramsQuery.data?.filter((goal) => goal.active).map((goal) => <Button key={goal.id} variant={developmentProgramIds.includes(goal.id) ? "primary" : "secondary"} onPress={() => toggleGoal(goal.id)}>{goalPickerLabel(t, goal.domain, goal.name)}</Button>)}
      {!developmentProgramsQuery.isFetching && developmentProgramsQuery.data?.filter((goal) => goal.active).length === 0 && <AppText tone="muted">{t("academic.noProgramGoals")}</AppText>}
    </BottomSheet>
  </AppScreen>;
}

function ProgramCard({ program, periodName, canManage, t, onEdit, onActiveChange }: { program: CurriculumProgram; periodName?: string; canManage: boolean; t: Translate; onEdit: () => void; onActiveChange: (active: boolean) => void }) {
  return <View style={[styles.card, !program.active && styles.archivedCard]}><AppText variant="label">{program.name}</AppText>{program.description ? <AppText tone="muted">{program.description}</AppText> : null}<AppText variant="caption" tone="muted">{periodName ?? t("common.noData")}{program.source === "GLOBAL" ? ` · ${t("globalCurriculum.global")}` : ""} · {t("academic.programGoals", { count: program.developmentProgramIds.length })}</AppText>{canManage && program.source !== "GLOBAL" && <View style={styles.actions}><Button variant="secondary" onPress={onEdit}>{t("common.edit")}</Button><Button variant="secondary" onPress={() => onActiveChange(!program.active)}>{t(program.active ? "learning.archive" : "learning.active")}</Button></View>}</View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  archivedCard: { opacity: 0.72 },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  description: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  archivedSection: { gap: spacing.sm },
});
