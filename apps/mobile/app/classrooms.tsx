import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Banner, BottomSheet, Button, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, NavigationCard, ShimmerList, TabBar, TextField, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import type { Classroom } from "@daycare/api-client";
import { hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

const assignmentRoles = ["STAFF", "NURSE", "MISS"] as const;

export default function ClassroomsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const canManage = isStaffAdmin && membership.active;
  const access = useUiAccessContext(Boolean(membership));
  const canAccessLegacyClasses = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const filterBranches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: isStaffAdmin && canAccessLegacyClasses });
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: canAccessLegacyClasses && hasAcademicOffering });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: canAccessLegacyClasses });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId, filterBranchId], queryFn: () => api.classrooms({ branchId: isStaffAdmin ? filterBranchId : undefined }), enabled: canAccessLegacyClasses });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: canAccessLegacyClasses });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["classrooms", organizationId] });
  const createClassroom = useMutation({ mutationFn: api.createClassroom.bind(api), onSuccess: refresh });
  const updateClassroom = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateClassroom>[1] }) => api.updateClassroom(id, input), onSuccess: refresh });
  const archiveClassroom = useMutation({ mutationFn: api.archiveClassroom.bind(api), onSuccess: refresh });
  const [visible, setVisible] = useState(false);
  const [editingClassroomId, setEditingClassroomId] = useState<string>();
  const [name, setName] = useState(""); const [levelId, setLevelId] = useState<string>(); const [branchId, setBranchId] = useState<string>(); const [periodId, setPeriodId] = useState<string>(); const [capacity, setCapacity] = useState("");
  useEffect(() => { if (!branchId && branches.data?.[0]) setBranchId(branches.data[0].id); }, [branches.data, branchId]);
  useEffect(() => { if (!levelId) { const activeLevel = levels.data?.find((level) => level.active); if (activeLevel) setLevelId(activeLevel.id); } }, [levels.data, levelId]);

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  if (!access.isLoading && !canAccessLegacyClasses) return <Redirect href="/academic" />;

  const failure = (error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
  const editClassroom = (classroom: Classroom) => { setEditingClassroomId(classroom.id); setName(classroom.name); setBranchId(classroom.branchId); setLevelId(classroom.learningLevelId ?? undefined); setPeriodId(classroom.learningPeriodId ?? undefined); setCapacity(classroom.capacity?.toString() ?? ""); };
  const cancelEdit = () => { setEditingClassroomId(undefined); setName(""); setBranchId(undefined); setLevelId(undefined); setPeriodId(undefined); setCapacity(""); };
  const openCreate = () => { cancelEdit(); setVisible(true); };
  const openEdit = (classroom: Classroom) => { editClassroom(classroom); setVisible(true); };
  const close = () => { cancelEdit(); setVisible(false); };
  const openLearningLevels = () => { close(); router.push("/learning-levels"); };
  const save = async () => {
    const trimmedCapacity = capacity.trim();
    if (!name.trim()) return Alert.alert(t("learning.classroomRequired"));
    if (!branchId) return Alert.alert(t("learning.selectBranch"));
    if (!levelId) return Alert.alert(t(levels.data?.some((level) => level.active) ? "learning.selectLevel" : "learning.noActiveLevelsForClassroom"));
    if (trimmedCapacity && (!/^\d+$/.test(trimmedCapacity) || !Number.isSafeInteger(Number(trimmedCapacity)) || Number(trimmedCapacity) <= 0)) return Alert.alert(t("learning.invalidCapacity"));
    const input = { name: name.trim(), learningLevelId: levelId, branchId, learningPeriodId: periodId, capacity: trimmedCapacity ? Number(trimmedCapacity) : undefined };
    try {
      if (editingClassroomId) await updateClassroom.mutateAsync({ id: editingClassroomId, input }); else await createClassroom.mutateAsync(input);
      close();
    } catch (error) { failure(error); }
  };

  return <AppScreen showBottomNavigation={false} title={t("learning.classroom")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("learning.addClassroom")} onPress={openCreate}>{t("learning.addClassroom")}</FloatingActionButton> : undefined}>
    {isStaffAdmin && <TabBar accessibilityLabel={t("branchFilter.allBranches")} selected={filterBranchId ?? ""} onSelect={(key) => setFilterBranchId(key || undefined)} items={[{ key: "", label: t("branchFilter.allBranches") }, ...(filterBranches.data?.map((branch) => ({ key: branch.id, label: branch.name })) ?? [])]} />}
    {classrooms.isFetching && <ShimmerList />}
    {!classrooms.isFetching && classrooms.data?.map((classroom) => <ClassroomCard key={classroom.id} classroom={classroom} levelName={levels.data?.find((level) => level.id === classroom.learningLevelId)?.name} branchName={branches.data?.find((branch) => branch.id === classroom.branchId)?.name} periodName={periods.data?.find((period) => period.id === classroom.learningPeriodId)?.name} canManage={canManage} onEdit={() => openEdit(classroom)} onArchive={() => void archiveClassroom.mutateAsync(classroom.id)} />)}
    {classrooms.isError && !classrooms.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void classrooms.refetch()} />}
    {!classrooms.isFetching && classrooms.data?.length === 0 && <EmptyState icon="grid-outline" title={t("learning.noClassrooms")} description={canManage ? t("learning.noClassroomsDescription") : undefined} action={canManage ? { label: t("learning.addClassroom"), onPress: openCreate } : undefined} />}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t(editingClassroomId ? "learning.editClassroom" : "learning.addClassroom")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t(editingClassroomId ? "common.save" : "learning.addClassroom"), loading: createClassroom.isPending || updateClassroom.isPending, onPress: () => void save() }}>
      <TextField label={t("learning.classroomName")} required value={name} onChangeText={setName} />
      <View style={styles.fieldGroup}><AppText variant="label">{t("learning.branch")}</AppText><ChipGroup accessibilityLabel={t("learning.branch")}>{branches.data?.map((branch) => <Chip key={branch.id} label={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} />)}</ChipGroup></View>
      <View style={styles.fieldGroup}><AppText variant="label">{t(hasAcademicOffering ? "learning.level" : "learning.legacyLevel")}</AppText><ChipGroup accessibilityLabel={t(hasAcademicOffering ? "learning.level" : "learning.legacyLevel")}>{levels.data?.filter((level) => level.active).map((level) => <Chip key={level.id} label={level.name} selected={levelId === level.id} onPress={() => setLevelId(level.id)} />)}</ChipGroup>{levels.data?.every((level) => !level.active) && <Banner tone="warning" title={t("learning.noActiveLevelsForClassroom")} action={<Button variant="secondary" onPress={openLearningLevels}>{t(hasAcademicOffering ? "learning.addLevel" : "learning.addLegacyLevel")}</Button>} />}</View>
      {hasAcademicOffering && <View style={styles.fieldGroup}><AppText variant="label">{t("learning.selectPeriod")}</AppText><ChipGroup accessibilityLabel={t("learning.selectPeriod")}><Chip label={t("learning.clearPeriod")} selected={!periodId} onPress={() => setPeriodId(undefined)} />{periods.data?.map((period) => <Chip key={period.id} label={period.name} selected={periodId === period.id} onPress={() => setPeriodId(period.id)} />)}</ChipGroup></View>}
      <TextField label={t("learning.capacity")} hint={t("learning.capacityHint")} inputMode="numeric" value={capacity} onChangeText={setCapacity} />
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
  const [programsOpen, setProgramsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffId, setStaffId] = useState<string>();
  const [role, setRole] = useState<(typeof assignmentRoles)[number]>("STAFF");
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const availableUsers = tenantUsers.data?.filter((user) => user.userId && user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || (user.role === "STAFF" && user.branchId === classroom.branchId))) ?? [];
  const isFull = classroom.capacity !== null && classroom.capacity !== undefined && classroom.activeChildren >= classroom.capacity;
  const capacityValue = classroom.capacity == null ? `${classroom.activeChildren}` : `${classroom.activeChildren}/${classroom.capacity}`;
  const assignmentRoleLabel = (assignmentRole: (typeof assignmentRoles)[number]) => assignmentRole === "NURSE" ? t("children.nurse") : assignmentRole === "MISS" ? t("children.miss") : t("children.staff");
  const openAddProgram = () => { setProgramsOpen(false); setCardSheet("program"); };
  const openAddStaff = () => { setStaffOpen(false); setCardSheet("staff"); };
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
    <NavigationCard accessibilityLabel={t("learning.classroomPrograms")} onPress={() => setProgramsOpen(true)}>
      <AppText variant="h6">{t("learning.classroomPrograms")}</AppText>
      <AppText tone={programs.data?.length ? "default" : "muted"}>{programs.data?.length ? t("learning.programCount", { count: programs.data.length }) : t("learning.noClassroomPrograms")}</AppText>
    </NavigationCard>
    <NavigationCard accessibilityLabel={t("learning.staff")} onPress={() => setStaffOpen(true)}>
      <AppText variant="h6">{t("learning.staff")}</AppText>
      <AppText tone={staff.data?.length ? "default" : "muted"}>{staff.data?.length ? t("learning.staffCount", { count: staff.data.length }) : t("learning.noStaff")}</AppText>
    </NavigationCard>
    {canManage && classroom.active && <View style={styles.options}>
      <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("learning.edit")} onPress={onEdit} />
      <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.archive")} onPress={onArchive} />
    </View>}

    <BottomSheet visible={programsOpen} onClose={() => setProgramsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("learning.classroomPrograms")}>
      {programs.isFetching && <ShimmerList variant="row" />}
      {!programs.isFetching && programs.data?.map((program) => <View key={program.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText>{program.name}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View>{canManage && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.removeProgram")} onPress={() => void removeProgram.mutateAsync(program.id)} />}</View>)}
      {!programs.isFetching && programs.data?.length === 0 && <AppText tone="muted">{t("learning.noClassroomPrograms")}</AppText>}
      {canManage && classroom.active && <Button variant="secondary" onPress={openAddProgram}>{t("learning.addClassroomProgram")}</Button>}
    </BottomSheet>

    <BottomSheet visible={staffOpen} onClose={() => setStaffOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("learning.staff")}>
      {staff.isFetching && <ShimmerList variant="row" />}
      {!staff.isFetching && staff.data?.map((assignment) => <View key={assignment.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)}</AppText></View>{canManage && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.unassignStaff")} onPress={() => void unassign.mutateAsync(assignment.id)} />}</View>)}
      {!staff.isFetching && staff.data?.length === 0 && <AppText tone="muted">{t("learning.noStaff")}</AppText>}
      {canManage && classroom.active && <Button variant="secondary" onPress={openAddStaff}>{t("learning.assignStaff")}</Button>}
    </BottomSheet>

    <BottomSheet visible={cardSheet === "program"} onClose={closeProgramSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.addClassroomProgram")} negativeAction={{ label: t("common.cancel"), onPress: closeProgramSheet }} positiveAction={{ label: t("common.save"), loading: createProgram.isPending, disabled: !programName.trim(), onPress: () => void saveProgram() }}>
      <TextField label={t("academic.programName")} required value={programName} onChangeText={setProgramName} />
      <TextField label={t("academic.description")} multiline value={programDescription} onChangeText={setProgramDescription} />
    </BottomSheet>

    <BottomSheet visible={cardSheet === "staff"} onClose={closeStaffSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.assignStaff")} negativeAction={{ label: t("common.cancel"), onPress: closeStaffSheet }} positiveAction={{ label: t("learning.assignStaff"), loading: assign.isPending, disabled: !staffId, onPress: () => void saveAssignment() }}>
      <View style={styles.fieldGroup}><AppText variant="label">{t("learning.staff")}</AppText><ChipGroup accessibilityLabel={t("learning.staff")}>{availableUsers.map((user) => <Chip key={user.id} label={user.displayName ?? user.email ?? "–"} selected={staffId === user.userId} onPress={() => setStaffId(user.userId ?? undefined)} />)}</ChipGroup></View>
      <ChipGroup>{assignmentRoles.map((item) => <Chip key={item} label={assignmentRoleLabel(item)} selected={role === item} onPress={() => setRole(item)} />)}</ChipGroup>
    </BottomSheet>
  </View>;
}

function ClassroomMetric({ label, value, detail, emphasis = false }: { label: string; value: string; detail: string; emphasis?: boolean }) {
  return <View style={[styles.metric, emphasis && styles.metricWarning]}><AppText variant="overline" tone="muted">{label}</AppText><AppText variant="h5" tone={emphasis ? "danger" : "default"}>{value}</AppText><AppText variant="caption" tone="muted">{detail}</AppText></View>;
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
  fieldGroup: { gap: spacing.xs },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  cardArchived: { opacity: 0.7 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { flex: 1, gap: spacing.xs },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill },
  statusBadgeActive: { backgroundColor: colors.accentSoft },
  statusBadgeFull: { backgroundColor: colors.disabled },
  statusBadgeArchived: { backgroundColor: colors.surface },
  metadata: { gap: spacing.xs },
  metrics: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  metricWarning: { backgroundColor: colors.disabled },
  assignment: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  assignmentContent: { flex: 1, gap: spacing.xs },
});
