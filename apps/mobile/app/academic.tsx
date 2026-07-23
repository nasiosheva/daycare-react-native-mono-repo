import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import type { Classroom, LearningLevel } from "@daycare/api-client";
import { DatePicker } from "@/date-picker/DatePicker";

const assignmentRoles = ["STAFF", "NURSE", "MISS"] as const;
type Sheet = "period" | "program" | "level" | "classroom" | "activity" | null;

export default function AcademicScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(membership) });
  const programs = useQuery({ queryKey: ["curriculum-programs", organizationId], queryFn: () => api.curriculumPrograms(), enabled: Boolean(membership) });
  const activities = useQuery({ queryKey: ["curriculum-activities", organizationId], queryFn: () => api.curriculumActivities(), enabled: Boolean(membership) });
  const templates = useQuery({ queryKey: ["learning-level-templates", organizationId], queryFn: () => api.learningLevelTemplates(), enabled: Boolean(membership) });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: Boolean(membership) });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: Boolean(membership) });
  const branches = useQuery({ queryKey: ["learning-branches", organizationId], queryFn: () => api.learningBranches(), enabled: Boolean(membership) });
  const refresh = (...keys: string[]) => keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key, organizationId] }));
  const createPeriod = useMutation({ mutationFn: api.createAcademicYear.bind(api), onSuccess: () => refresh("learning-periods") });
  const createProgram = useMutation({ mutationFn: api.createCurriculumProgram.bind(api), onSuccess: () => refresh("curriculum-programs") });
  const createActivity = useMutation({ mutationFn: api.createCurriculumActivity.bind(api), onSuccess: () => refresh("curriculum-activities") });
  const createLevel = useMutation({ mutationFn: api.createLearningLevel.bind(api), onSuccess: () => refresh("learning-levels") });
  const updateLevel = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateLearningLevel>[1] }) => api.updateLearningLevel(id, input), onSuccess: () => refresh("learning-levels", "classrooms") });
  const archiveLevel = useMutation({ mutationFn: api.archiveLearningLevel.bind(api), onSuccess: () => refresh("learning-levels", "classrooms") });
  const createClassroom = useMutation({ mutationFn: api.createClassroom.bind(api), onSuccess: () => refresh("classrooms") });
  const updateClassroom = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateClassroom>[1] }) => api.updateClassroom(id, input), onSuccess: () => refresh("classrooms") });
  const archiveClassroom = useMutation({ mutationFn: api.archiveClassroom.bind(api), onSuccess: () => refresh("classrooms") });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [periodName, setPeriodName] = useState(""); const [periodStart, setPeriodStart] = useState(""); const [periodEnd, setPeriodEnd] = useState("");
  const [programName, setProgramName] = useState(""); const [programDescription, setProgramDescription] = useState(""); const [programPeriodId, setProgramPeriodId] = useState<string | undefined>();
  const [activityName, setActivityName] = useState(""); const [activityDescription, setActivityDescription] = useState("");
  const [editingLevelId, setEditingLevelId] = useState<string>();
  const [levelName, setLevelName] = useState(""); const [minAge, setMinAge] = useState(""); const [maxAge, setMaxAge] = useState(""); const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [editingClassroomId, setEditingClassroomId] = useState<string>();
  const [classroomName, setClassroomName] = useState(""); const [classroomLevelId, setClassroomLevelId] = useState<string>(); const [classroomBranchId, setClassroomBranchId] = useState<string>(); const [classroomPeriodId, setClassroomPeriodId] = useState<string>(); const [capacity, setCapacity] = useState("");
  useEffect(() => { if (!classroomBranchId && branches.data?.[0]) setClassroomBranchId(branches.data[0].id); }, [branches.data, classroomBranchId]);
  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  const failure = (error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
  const closePeriodSheet = () => { setSheet(null); setPeriodName(""); setPeriodStart(""); setPeriodEnd(""); };
  const addPeriod = async () => { if (!periodName.trim() || !periodStart || !periodEnd) return Alert.alert(t("academic.yearRequired")); try { await createPeriod.mutateAsync({ name: periodName.trim(), startsOn: periodStart, endsOn: periodEnd }); closePeriodSheet(); } catch (error) { failure(error); } };
  const closeProgramSheet = () => { setSheet(null); setProgramName(""); setProgramDescription(""); };
  const addProgram = async () => { if (!programName.trim()) return Alert.alert(t("academic.programRequired")); try { await createProgram.mutateAsync({ academicYearId: programPeriodId, name: programName.trim(), description: programDescription.trim() }); closeProgramSheet(); } catch (error) { failure(error); } };
  const closeActivitySheet = () => { setSheet(null); setActivityName(""); setActivityDescription(""); };
  const addActivity = async () => { if (!activityName.trim()) return Alert.alert(t("learning.activityRequired")); try { await createActivity.mutateAsync({ name: activityName.trim(), description: activityDescription.trim() }); closeActivitySheet(); } catch (error) { failure(error); } };
  const useTemplate = (name: string, minimum?: number | null, maximum?: number | null) => { setLevelName(name); setMinAge(minimum?.toString() ?? ""); setMaxAge(maximum?.toString() ?? ""); };
  const editLevel = (level: LearningLevel) => { setEditingLevelId(level.id); setLevelName(level.name); setMinAge(level.minAgeMonths?.toString() ?? ""); setMaxAge(level.maxAgeMonths?.toString() ?? ""); setSelectedPrograms(level.curriculumProgramIds); };
  const cancelLevelEdit = () => { setEditingLevelId(undefined); setLevelName(""); setMinAge(""); setMaxAge(""); setSelectedPrograms([]); };
  const openCreateLevel = () => { cancelLevelEdit(); setSheet("level"); };
  const openEditLevel = (level: LearningLevel) => { editLevel(level); setSheet("level"); };
  const closeLevelSheet = () => { cancelLevelEdit(); setSheet(null); };
  const addLevel = async () => {
    if (!levelName.trim()) return Alert.alert(t("learning.selectLevel"));
    const input = { name: levelName.trim(), minAgeMonths: minAge ? Number(minAge) : undefined, maxAgeMonths: maxAge ? Number(maxAge) : undefined, displayOrder: levels.data?.find((level) => level.id === editingLevelId)?.displayOrder ?? levels.data?.length ?? 0, curriculumProgramIds: selectedPrograms };
    try {
      if (editingLevelId) await updateLevel.mutateAsync({ id: editingLevelId, input }); else await createLevel.mutateAsync(input);
      closeLevelSheet();
    } catch (error) { failure(error); }
  };
  const editClassroom = (classroom: Classroom) => { setEditingClassroomId(classroom.id); setClassroomName(classroom.name); setClassroomBranchId(classroom.branchId); setClassroomLevelId(classroom.learningLevelId ?? undefined); setClassroomPeriodId(classroom.learningPeriodId ?? undefined); setCapacity(classroom.capacity?.toString() ?? ""); };
  const cancelClassroomEdit = () => { setEditingClassroomId(undefined); setClassroomName(""); setClassroomLevelId(undefined); setClassroomPeriodId(undefined); setCapacity(""); };
  const openCreateClassroom = () => { cancelClassroomEdit(); setSheet("classroom"); };
  const openEditClassroom = (classroom: Classroom) => { editClassroom(classroom); setSheet("classroom"); };
  const closeClassroomSheet = () => { cancelClassroomEdit(); setSheet(null); };
  const addClassroom = async () => {
    if (!classroomName.trim() || !classroomLevelId || !classroomBranchId) return Alert.alert(t("learning.selectLevel"));
    const input = { name: classroomName.trim(), learningLevelId: classroomLevelId, branchId: classroomBranchId, learningPeriodId: classroomPeriodId, capacity: capacity ? Number(capacity) : undefined };
    try {
      if (editingClassroomId) await updateClassroom.mutateAsync({ id: editingClassroomId, input }); else await createClassroom.mutateAsync(input);
      closeClassroomSheet();
    } catch (error) { failure(error); }
  };
  const toggleProgram = (id: string) => setSelectedPrograms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <AppScreen><AppText variant="title">{t("learning.title")}</AppText><AppText tone="muted">{t("learning.subtitle")}</AppText>{membership.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {canManage && <View style={styles.options}>
      <Button variant="secondary" onPress={() => setSheet("period")}>{t("academic.addYear")}</Button>
      <Button variant="secondary" onPress={() => setSheet("program")}>{t("academic.addProgram")}</Button>
      <Button variant="secondary" onPress={openCreateLevel}>{t("learning.addLevel")}</Button>
      <Button variant="secondary" onPress={openCreateClassroom}>{t("learning.addClassroom")}</Button>
      <Button variant="secondary" onPress={() => setSheet("activity")}>{t("learning.addActivity")}</Button>
    </View>}
    <AppText variant="heading">{t("learning.activities")}</AppText>
    {activities.data?.map((activity) => <View key={activity.id} style={styles.card}>
      <AppText variant="label">{activity.name}</AppText>
      {!activity.active && <AppText tone="muted">{t("learning.activityArchived")}</AppText>}
      <Button variant="secondary" onPress={() => router.push({ pathname: "/curriculum-activity-detail", params: { activityId: activity.id } })}>{t(canManage ? "learning.editActivity" : "learning.viewActivity")}</Button>
    </View>)}
    {activities.data?.length === 0 && <AppText tone="muted">{t("learning.noActivities")}</AppText>}
    <AppText variant="heading">{t("learning.level")}</AppText>{levels.data?.map((level) => <View key={level.id} style={styles.card}><AppText variant="label">{level.name}</AppText><AppText tone="muted">{t("learning.ageMonths", { min: level.minAgeMonths ?? "–", max: level.maxAgeMonths ?? "–" })}</AppText>{canManage && level.active && <View style={styles.options}><Button variant="secondary" onPress={() => openEditLevel(level)}>{t("learning.edit")}</Button><Button variant="danger" onPress={() => void archiveLevel.mutateAsync(level.id)}>{t("learning.archive")}</Button></View>}</View>)}{levels.data?.length === 0 && <AppText tone="muted">{t("learning.noLevels")}</AppText>}
    <AppText variant="heading">{t("learning.classroom")}</AppText>{classrooms.data?.map((classroom) => <ClassroomCard key={classroom.id} classroom={classroom} levelName={levels.data?.find((level) => level.id === classroom.learningLevelId)?.name} branchName={branches.data?.find((branch) => branch.id === classroom.branchId)?.name} periodName={periods.data?.find((period) => period.id === classroom.learningPeriodId)?.name} canManage={canManage} onEdit={() => openEditClassroom(classroom)} onArchive={() => void archiveClassroom.mutateAsync(classroom.id)} />)}{classrooms.data?.length === 0 && <AppText tone="muted">{t("learning.noClassrooms")}</AppText>}

    <BottomSheet visible={sheet === "period"} onClose={closePeriodSheet} closeAccessibilityLabel={t("common.close")} title={t("academic.year")} negativeAction={{ label: t("common.cancel"), onPress: closePeriodSheet }} positiveAction={{ label: t("academic.addYear"), loading: createPeriod.isPending, onPress: () => void addPeriod() }}>
      <TextInput style={styles.input} placeholder={t("academic.yearExample")} value={periodName} onChangeText={setPeriodName} />
      <DatePicker placeholder={t("academic.start")} value={periodStart} onChange={setPeriodStart} maximumDate={periodEnd || undefined} />
      <DatePicker placeholder={t("academic.end")} value={periodEnd} onChange={setPeriodEnd} minimumDate={periodStart || undefined} />
    </BottomSheet>

    <BottomSheet visible={sheet === "program"} onClose={closeProgramSheet} closeAccessibilityLabel={t("common.close")} title={t("academic.program")} negativeAction={{ label: t("common.cancel"), onPress: closeProgramSheet }} positiveAction={{ label: t("academic.addProgram"), loading: createProgram.isPending, onPress: () => void addProgram() }}>
      <View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={programPeriodId === period.id ? "primary" : "secondary"} onPress={() => setProgramPeriodId(period.id)}>{period.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={programName} onChangeText={setProgramName} />
      <TextInput style={styles.input} placeholder={t("academic.description")} value={programDescription} onChangeText={setProgramDescription} />
    </BottomSheet>

    <BottomSheet visible={sheet === "activity"} onClose={closeActivitySheet} closeAccessibilityLabel={t("common.close")} title={t("learning.addActivity")} negativeAction={{ label: t("common.cancel"), onPress: closeActivitySheet }} positiveAction={{ label: t("learning.addActivity"), loading: createActivity.isPending, onPress: () => void addActivity() }}>
      <TextInput style={styles.input} placeholder={t("learning.activityName")} value={activityName} onChangeText={setActivityName} />
      <TextInput style={styles.input} placeholder={t("academic.description")} value={activityDescription} onChangeText={setActivityDescription} />
    </BottomSheet>

    <BottomSheet visible={sheet === "level"} onClose={closeLevelSheet} closeAccessibilityLabel={t("common.close")} title={t(editingLevelId ? "learning.editLevel" : "learning.addLevel")} negativeAction={{ label: t("common.cancel"), onPress: closeLevelSheet }} positiveAction={{ label: t(editingLevelId ? "common.save" : "learning.addLevel"), loading: createLevel.isPending || updateLevel.isPending, onPress: () => void addLevel() }}>
      <AppText variant="label">{t("learning.templates")}</AppText>
      <View style={styles.options}>{templates.data?.map((template) => <Button key={template.code} variant="secondary" onPress={() => useTemplate(template.name, template.minAgeMonths, template.maxAgeMonths)}>{template.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("learning.levelName")} value={levelName} onChangeText={setLevelName} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.minAge")} value={minAge} onChangeText={setMinAge} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.maxAge")} value={maxAge} onChangeText={setMaxAge} />
      <View style={styles.options}>{programs.data?.map((program) => <Button key={program.id} variant={selectedPrograms.includes(program.id) ? "primary" : "secondary"} onPress={() => toggleProgram(program.id)}>{program.name}{program.source === "GLOBAL" ? ` · ${t("globalCurriculum.global")}` : ""}</Button>)}</View>
    </BottomSheet>

    <BottomSheet visible={sheet === "classroom"} onClose={closeClassroomSheet} closeAccessibilityLabel={t("common.close")} title={t(editingClassroomId ? "learning.editClassroom" : "learning.addClassroom")} negativeAction={{ label: t("common.cancel"), onPress: closeClassroomSheet }} positiveAction={{ label: t(editingClassroomId ? "common.save" : "learning.addClassroom"), loading: createClassroom.isPending || updateClassroom.isPending, onPress: () => void addClassroom() }}>
      <View style={styles.options}>{branches.data?.map((branch) => <Button key={branch.id} variant={classroomBranchId === branch.id ? "primary" : "secondary"} onPress={() => setClassroomBranchId(branch.id)}>{branch.name}</Button>)}</View>
      <View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={classroomLevelId === level.id ? "primary" : "secondary"} onPress={() => setClassroomLevelId(level.id)}>{level.name}</Button>)}</View>
      <View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={classroomPeriodId === period.id ? "primary" : "secondary"} onPress={() => setClassroomPeriodId(period.id)}>{period.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("learning.classroomName")} value={classroomName} onChangeText={setClassroomName} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.capacity")} value={capacity} onChangeText={setCapacity} />
    </BottomSheet>
  </AppScreen>;
}

function ClassroomCard({ classroom, levelName, branchName, periodName, canManage, onEdit, onArchive }: { classroom: Classroom; levelName?: string; branchName?: string; periodName?: string; canManage: boolean; onEdit: () => void; onArchive: () => void }) {
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
  const [cardSheet, setCardSheet] = useState<"program" | "staff" | null>(null);
  const [staffId, setStaffId] = useState<string>();
  const [role, setRole] = useState<(typeof assignmentRoles)[number]>("STAFF");
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const availableUsers = tenantUsers.data?.filter((user) => user.userId && user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || (user.role === "STAFF" && user.branchId === classroom.branchId))) ?? [];
  const isFull = classroom.capacity !== null && classroom.capacity !== undefined && classroom.activeChildren >= classroom.capacity;
  const capacityValue = classroom.capacity == null ? `${classroom.activeChildren}` : `${classroom.activeChildren}/${classroom.capacity}`;
  const assignmentRoleLabel = (assignmentRole: (typeof assignmentRoles)[number]) => assignmentRole === "NURSE" ? t("children.nurse") : assignmentRole === "MISS" ? t("children.miss") : t("children.staff");
  const closeProgramSheet = () => { setCardSheet(null); setProgramName(""); setProgramDescription(""); };
  const saveProgram = async () => {
    if (!programName.trim()) return;
    try {
      await createProgram.mutateAsync({ name: programName.trim(), description: programDescription.trim() || undefined });
      closeProgramSheet();
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const closeStaffSheet = () => { setCardSheet(null); setStaffId(undefined); setRole("STAFF"); };
  const saveAssignment = async () => {
    if (!staffId) return;
    try {
      await assign.mutateAsync({ userId: staffId, assignmentRole: role });
      closeStaffSheet();
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <View style={[styles.card, !classroom.active && styles.cardArchived]}><View style={styles.cardHeader}><View style={styles.cardTitle}><AppText variant="h6">{classroom.name}</AppText><AppText variant="bodySmall" tone="muted">{levelName ?? t("common.noData")}</AppText></View><View style={[styles.statusBadge, classroom.active ? isFull ? styles.statusBadgeFull : styles.statusBadgeActive : styles.statusBadgeArchived]}><AppText variant="caption" tone={classroom.active && isFull ? "danger" : "muted"}>{classroom.active ? isFull ? t("learning.classroomFull") : t("status.ACTIVE") : t("learning.archived")}</AppText></View></View>
    <View style={styles.metadata}><AppText variant="caption" tone="muted">{t("learning.branch")}: {branchName ?? t("common.noData")}</AppText><AppText variant="caption" tone="muted">{t("learning.period")}: {periodName ?? t("common.noData")}</AppText></View>
    <View style={styles.metrics}><ClassroomMetric label={t("learning.children")} value={capacityValue} detail={classroom.capacity == null ? t("learning.unlimited") : t("learning.capacity")} emphasis={isFull} /><ClassroomMetric label={t("learning.staff")} value={staff.data?.length?.toString() ?? "–"} detail={t("learning.staffCount", { count: staff.data?.length ?? 0 })} /><ClassroomMetric label={t("learning.classroomPrograms")} value={programs.data?.length?.toString() ?? "–"} detail={t("learning.programCount", { count: programs.data?.length ?? 0 })} /></View>
    <AppText variant="label">{t("learning.classroomPrograms")}</AppText>
    {programs.data?.map((program) => <View key={program.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText>{program.name}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View>{canManage && <Button variant="danger" onPress={() => void removeProgram.mutateAsync(program.id)}>{t("learning.removeProgram")}</Button>}</View>)}
    {programs.data?.length === 0 && <AppText tone="muted">{t("learning.noClassroomPrograms")}</AppText>}
    {canManage && classroom.active && <Button variant="secondary" onPress={() => setCardSheet("program")}>{t("learning.addClassroomProgram")}</Button>}
    <AppText variant="label">{t("learning.staff")}</AppText>
    {staff.data?.map((assignment) => <View key={assignment.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)}</AppText></View>{canManage && <Button variant="danger" onPress={() => void unassign.mutateAsync(assignment.id)}>{t("learning.unassignStaff")}</Button>}</View>)}
    {staff.data?.length === 0 && <AppText tone="muted">{t("learning.noStaff")}</AppText>}
    {canManage && classroom.active && <View style={styles.options}>
      <Button variant="secondary" onPress={() => setCardSheet("staff")}>{t("learning.assignStaff")}</Button>
      <Button variant="secondary" onPress={onEdit}>{t("learning.edit")}</Button>
      <Button variant="danger" onPress={onArchive}>{t("learning.archive")}</Button>
    </View>}

    <BottomSheet visible={cardSheet === "program"} onClose={closeProgramSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.addClassroomProgram")} negativeAction={{ label: t("common.cancel"), onPress: closeProgramSheet }} positiveAction={{ label: t("common.save"), loading: createProgram.isPending, disabled: !programName.trim(), onPress: () => void saveProgram() }}>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={programName} onChangeText={setProgramName} />
      <TextInput style={styles.input} placeholder={t("academic.description")} value={programDescription} onChangeText={setProgramDescription} />
    </BottomSheet>

    <BottomSheet visible={cardSheet === "staff"} onClose={closeStaffSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.assignStaff")} negativeAction={{ label: t("common.cancel"), onPress: closeStaffSheet }} positiveAction={{ label: t("learning.assignStaff"), loading: assign.isPending, disabled: !staffId, onPress: () => void saveAssignment() }}>
      <View style={styles.options}>{availableUsers.map((user) => <Button key={user.id} variant={staffId === user.userId ? "primary" : "secondary"} onPress={() => setStaffId(user.userId ?? undefined)}>{user.displayName ?? user.email ?? "–"}</Button>)}</View>
      <View style={styles.options}>{assignmentRoles.map((item) => <Button key={item} variant={role === item ? "primary" : "secondary"} onPress={() => setRole(item)}>{item}</Button>)}</View>
    </BottomSheet>
  </View>;
}

function ClassroomMetric({ label, value, detail, emphasis = false }: { label: string; value: string; detail: string; emphasis?: boolean }) {
  return <View style={[styles.metric, emphasis && styles.metricWarning]}><AppText variant="overline" tone="muted">{label}</AppText><AppText variant="h5" tone={emphasis ? "danger" : "default"}>{value}</AppText><AppText variant="caption" tone="muted">{detail}</AppText></View>;
}

const styles = StyleSheet.create({ form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint }, cardArchived: { opacity: 0.7 }, cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }, cardTitle: { flex: 1, gap: spacing.xs }, statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }, statusBadgeActive: { backgroundColor: colors.accentSoft }, statusBadgeFull: { backgroundColor: colors.disabled }, statusBadgeArchived: { backgroundColor: colors.surface }, metadata: { gap: spacing.xs }, metrics: { flexDirection: "row", gap: spacing.sm }, metric: { flex: 1, gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface }, metricWarning: { backgroundColor: colors.disabled }, assignment: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, assignmentContent: { flex: 1, gap: spacing.xs } });
