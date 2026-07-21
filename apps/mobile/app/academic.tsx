import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import type { Classroom } from "@daycare/api-client";

const assignmentRoles = ["STAFF", "NURSE", "MISS"] as const;

export default function AcademicScreen() {
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(membership) });
  const programs = useQuery({ queryKey: ["curriculum-programs", organizationId], queryFn: () => api.curriculumPrograms(), enabled: Boolean(membership) });
  const templates = useQuery({ queryKey: ["learning-level-templates", organizationId], queryFn: () => api.learningLevelTemplates(), enabled: Boolean(membership) });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: Boolean(membership) });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: Boolean(membership) });
  const branches = useQuery({ queryKey: ["learning-branches", organizationId], queryFn: () => api.learningBranches(), enabled: Boolean(membership) });
  const refresh = (...keys: string[]) => keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key, organizationId] }));
  const createPeriod = useMutation({ mutationFn: api.createAcademicYear.bind(api), onSuccess: () => refresh("learning-periods") });
  const createProgram = useMutation({ mutationFn: api.createCurriculumProgram.bind(api), onSuccess: () => refresh("curriculum-programs") });
  const createLevel = useMutation({ mutationFn: api.createLearningLevel.bind(api), onSuccess: () => refresh("learning-levels") });
  const archiveLevel = useMutation({ mutationFn: api.archiveLearningLevel.bind(api), onSuccess: () => refresh("learning-levels", "classrooms") });
  const createClassroom = useMutation({ mutationFn: api.createClassroom.bind(api), onSuccess: () => refresh("classrooms") });
  const archiveClassroom = useMutation({ mutationFn: api.archiveClassroom.bind(api), onSuccess: () => refresh("classrooms") });
  const [periodName, setPeriodName] = useState(""); const [periodStart, setPeriodStart] = useState(""); const [periodEnd, setPeriodEnd] = useState("");
  const [programName, setProgramName] = useState(""); const [programDescription, setProgramDescription] = useState(""); const [programPeriodId, setProgramPeriodId] = useState<string | undefined>();
  const [levelName, setLevelName] = useState(""); const [minAge, setMinAge] = useState(""); const [maxAge, setMaxAge] = useState(""); const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [classroomName, setClassroomName] = useState(""); const [classroomLevelId, setClassroomLevelId] = useState<string>(); const [classroomBranchId, setClassroomBranchId] = useState<string>(); const [classroomPeriodId, setClassroomPeriodId] = useState<string>(); const [capacity, setCapacity] = useState("");
  useEffect(() => { if (!classroomBranchId && branches.data?.[0]) setClassroomBranchId(branches.data[0].id); }, [branches.data, classroomBranchId]);
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  const failure = (error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
  const addPeriod = async () => { if (!periodName.trim() || !periodStart || !periodEnd) return Alert.alert(t("academic.yearRequired")); try { await createPeriod.mutateAsync({ name: periodName.trim(), startsOn: periodStart, endsOn: periodEnd }); setPeriodName(""); setPeriodStart(""); setPeriodEnd(""); } catch (error) { failure(error); } };
  const addProgram = async () => { if (!programName.trim()) return Alert.alert(t("academic.programRequired")); try { await createProgram.mutateAsync({ academicYearId: programPeriodId, name: programName.trim(), description: programDescription.trim() }); setProgramName(""); setProgramDescription(""); } catch (error) { failure(error); } };
  const useTemplate = (name: string, minimum?: number | null, maximum?: number | null) => { setLevelName(name); setMinAge(minimum?.toString() ?? ""); setMaxAge(maximum?.toString() ?? ""); };
  const addLevel = async () => { if (!levelName.trim()) return Alert.alert(t("learning.selectLevel")); try { await createLevel.mutateAsync({ name: levelName.trim(), minAgeMonths: minAge ? Number(minAge) : undefined, maxAgeMonths: maxAge ? Number(maxAge) : undefined, displayOrder: levels.data?.length ?? 0, curriculumProgramIds: selectedPrograms }); setLevelName(""); setMinAge(""); setMaxAge(""); setSelectedPrograms([]); } catch (error) { failure(error); } };
  const addClassroom = async () => { if (!classroomName.trim() || !classroomLevelId || !classroomBranchId) return Alert.alert(t("learning.selectLevel")); try { await createClassroom.mutateAsync({ name: classroomName.trim(), learningLevelId: classroomLevelId, branchId: classroomBranchId, learningPeriodId: classroomPeriodId, capacity: capacity ? Number(capacity) : undefined }); setClassroomName(""); setCapacity(""); } catch (error) { failure(error); } };
  const toggleProgram = (id: string) => setSelectedPrograms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <AppScreen><AppText variant="title">{t("learning.title")}</AppText><AppText tone="muted">{t("learning.subtitle")}</AppText>{membership.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {canManage && <View style={styles.form}><AppText variant="heading">{t("academic.year")}</AppText><TextInput style={styles.input} placeholder={t("academic.yearExample")} value={periodName} onChangeText={setPeriodName} /><TextInput style={styles.input} placeholder={t("academic.start")} value={periodStart} onChangeText={setPeriodStart} /><TextInput style={styles.input} placeholder={t("academic.end")} value={periodEnd} onChangeText={setPeriodEnd} /><Button loading={createPeriod.isPending} onPress={() => void addPeriod()}>{t("academic.addYear")}</Button></View>}
    {canManage && <View style={styles.form}><AppText variant="heading">{t("academic.program")}</AppText><View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={programPeriodId === period.id ? "primary" : "secondary"} onPress={() => setProgramPeriodId(period.id)}>{period.name}</Button>)}</View><TextInput style={styles.input} placeholder={t("academic.programName")} value={programName} onChangeText={setProgramName} /><TextInput style={styles.input} placeholder={t("academic.description")} value={programDescription} onChangeText={setProgramDescription} /><Button loading={createProgram.isPending} onPress={() => void addProgram()}>{t("academic.addProgram")}</Button></View>}
    {canManage && <View style={styles.form}><AppText variant="heading">{t("learning.level")}</AppText><AppText variant="label">{t("learning.templates")}</AppText><View style={styles.options}>{templates.data?.map((template) => <Button key={template.code} variant="secondary" onPress={() => useTemplate(template.name, template.minAgeMonths, template.maxAgeMonths)}>{template.name}</Button>)}</View><TextInput style={styles.input} placeholder={t("learning.levelName")} value={levelName} onChangeText={setLevelName} /><TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.minAge")} value={minAge} onChangeText={setMinAge} /><TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.maxAge")} value={maxAge} onChangeText={setMaxAge} /><View style={styles.options}>{programs.data?.map((program) => <Button key={program.id} variant={selectedPrograms.includes(program.id) ? "primary" : "secondary"} onPress={() => toggleProgram(program.id)}>{program.name}</Button>)}</View><Button loading={createLevel.isPending} onPress={() => void addLevel()}>{t("learning.addLevel")}</Button></View>}
    <AppText variant="heading">{t("learning.level")}</AppText>{levels.data?.map((level) => <View key={level.id} style={styles.card}><AppText variant="label">{level.name}</AppText><AppText tone="muted">{t("learning.ageMonths", { min: level.minAgeMonths ?? "–", max: level.maxAgeMonths ?? "–" })}</AppText>{canManage && level.active && <Button variant="danger" onPress={() => void archiveLevel.mutateAsync(level.id)}>{t("learning.archive")}</Button>}</View>)}{levels.data?.length === 0 && <AppText tone="muted">{t("learning.noLevels")}</AppText>}
    {canManage && <View style={styles.form}><AppText variant="heading">{t("learning.classroom")}</AppText><View style={styles.options}>{branches.data?.map((branch) => <Button key={branch.id} variant={classroomBranchId === branch.id ? "primary" : "secondary"} onPress={() => setClassroomBranchId(branch.id)}>{branch.name}</Button>)}</View><View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={classroomLevelId === level.id ? "primary" : "secondary"} onPress={() => setClassroomLevelId(level.id)}>{level.name}</Button>)}</View><View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={classroomPeriodId === period.id ? "primary" : "secondary"} onPress={() => setClassroomPeriodId(period.id)}>{period.name}</Button>)}</View><TextInput style={styles.input} placeholder={t("learning.classroomName")} value={classroomName} onChangeText={setClassroomName} /><TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.capacity")} value={capacity} onChangeText={setCapacity} /><Button loading={createClassroom.isPending} onPress={() => void addClassroom()}>{t("learning.addClassroom")}</Button></View>}
    <AppText variant="heading">{t("learning.classroom")}</AppText>{classrooms.data?.map((classroom) => <ClassroomCard key={classroom.id} classroom={classroom} levelName={levels.data?.find((level) => level.id === classroom.learningLevelId)?.name} canManage={canManage} onArchive={() => void archiveClassroom.mutateAsync(classroom.id)} />)}{classrooms.data?.length === 0 && <AppText tone="muted">{t("learning.noClassrooms")}</AppText>}
  </AppScreen>;
}

function ClassroomCard({ classroom, levelName, canManage, onArchive }: { classroom: Classroom; levelName?: string; canManage: boolean; onArchive: () => void }) {
  const { api, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ["classroom-staff", organizationId, classroom.id], queryFn: () => api.classroomStaffAssignments(classroom.id) });
  const programs = useQuery({ queryKey: ["classroom-programs", organizationId, classroom.id], queryFn: () => api.classroomPrograms(classroom.id) });
  const tenantUsers = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: canManage });
  const assign = useMutation({ mutationFn: (input: { userId: string; assignmentRole: (typeof assignmentRoles)[number] }) => api.assignClassroomStaff(classroom.id, input), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["classroom-staff", organizationId, classroom.id] }) });
  const unassign = useMutation({ mutationFn: (assignmentId: string) => api.unassignClassroomStaff(classroom.id, assignmentId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["classroom-staff", organizationId, classroom.id] }) });
  const createProgram = useMutation({ mutationFn: (input: { name: string; description?: string }) => api.createClassroomProgram(classroom.id, input), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["classroom-programs", organizationId, classroom.id] }) });
  const removeProgram = useMutation({ mutationFn: (programId: string) => api.removeClassroomProgram(classroom.id, programId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["classroom-programs", organizationId, classroom.id] }) });
  const [staffId, setStaffId] = useState<string>();
  const [role, setRole] = useState<(typeof assignmentRoles)[number]>("STAFF");
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const availableUsers = tenantUsers.data?.filter((user) => user.userId && user.status === "ACTIVE" && (user.role === "STAFF" || user.role === "STAFF_ADMIN")) ?? [];
  const saveProgram = async () => {
    if (!programName.trim()) return;
    try {
      await createProgram.mutateAsync({ name: programName.trim(), description: programDescription.trim() || undefined });
      setProgramName("");
      setProgramDescription("");
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <View style={styles.card}><AppText variant="label">{classroom.name}</AppText><AppText tone="muted">{levelName ?? t("learning.archived")} · {t("learning.activeChildren", { count: classroom.activeChildren })}</AppText>
    <AppText variant="label">{t("learning.classroomPrograms")}</AppText>
    {programs.data?.map((program) => <View key={program.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText>{program.name}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View>{canManage && <Button variant="danger" onPress={() => void removeProgram.mutateAsync(program.id)}>{t("learning.removeProgram")}</Button>}</View>)}
    {programs.data?.length === 0 && <AppText tone="muted">{t("learning.noClassroomPrograms")}</AppText>}
    {canManage && classroom.active && <View style={styles.form}><TextInput style={styles.input} placeholder={t("academic.programName")} value={programName} onChangeText={setProgramName} /><TextInput style={styles.input} placeholder={t("academic.description")} value={programDescription} onChangeText={setProgramDescription} /><Button loading={createProgram.isPending} disabled={!programName.trim()} onPress={() => void saveProgram()}>{t("learning.addClassroomProgram")}</Button></View>}
    <AppText variant="label">{t("learning.staff")}</AppText>
    {staff.data?.map((assignment) => <View key={assignment.id} style={styles.assignment}><AppText>{assignment.displayName} · {assignment.assignmentRole}</AppText>{canManage && <Button variant="danger" onPress={() => void unassign.mutateAsync(assignment.id)}>{t("learning.unassignStaff")}</Button>}</View>)}
    {staff.data?.length === 0 && <AppText tone="muted">{t("learning.noStaff")}</AppText>}
    {canManage && classroom.active && <><View style={styles.options}>{availableUsers.map((user) => <Button key={user.id} variant={staffId === user.userId ? "primary" : "secondary"} onPress={() => setStaffId(user.userId ?? undefined)}>{user.displayName ?? user.email ?? "–"}</Button>)}</View><View style={styles.options}>{assignmentRoles.map((item) => <Button key={item} variant={role === item ? "primary" : "secondary"} onPress={() => setRole(item)}>{item}</Button>)}</View><Button loading={assign.isPending} disabled={!staffId} onPress={() => { if (staffId) void assign.mutateAsync({ userId: staffId, assignmentRole: role }); }}>{t("learning.assignStaff")}</Button><Button variant="danger" onPress={onArchive}>{t("learning.archive")}</Button></>}
  </View>;
}

const styles = StyleSheet.create({ form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint }, assignment: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, assignmentContent: { flex: 1, gap: spacing.xs } });
