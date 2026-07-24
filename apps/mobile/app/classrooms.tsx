import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { BranchFilterControl } from "@/branches/BranchFilterSheet";
import { AppScreen } from "@/navigation/AppScreen";
import type { Classroom } from "@daycare/api-client";

const assignmentRoles = ["STAFF", "NURSE", "MISS"] as const;

export default function ClassroomsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const canManage = isStaffAdmin && membership.active;
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(membership) });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: Boolean(membership) });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId, filterBranchId], queryFn: () => api.classrooms({ branchId: isStaffAdmin ? filterBranchId : undefined }), enabled: Boolean(membership) });
  const branches = useQuery({ queryKey: ["learning-branches", organizationId], queryFn: () => api.learningBranches(), enabled: Boolean(membership) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["classrooms", organizationId] });
  const createClassroom = useMutation({ mutationFn: api.createClassroom.bind(api), onSuccess: refresh });
  const updateClassroom = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateClassroom>[1] }) => api.updateClassroom(id, input), onSuccess: refresh });
  const archiveClassroom = useMutation({ mutationFn: api.archiveClassroom.bind(api), onSuccess: refresh });
  const [visible, setVisible] = useState(false);
  const [editingClassroomId, setEditingClassroomId] = useState<string>();
  const [name, setName] = useState(""); const [levelId, setLevelId] = useState<string>(); const [branchId, setBranchId] = useState<string>(); const [periodId, setPeriodId] = useState<string>(); const [capacity, setCapacity] = useState("");
  useEffect(() => { if (!branchId && branches.data?.[0]) setBranchId(branches.data[0].id); }, [branches.data, branchId]);

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  const failure = (error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
  const editClassroom = (classroom: Classroom) => { setEditingClassroomId(classroom.id); setName(classroom.name); setBranchId(classroom.branchId); setLevelId(classroom.learningLevelId ?? undefined); setPeriodId(classroom.learningPeriodId ?? undefined); setCapacity(classroom.capacity?.toString() ?? ""); };
  const cancelEdit = () => { setEditingClassroomId(undefined); setName(""); setLevelId(undefined); setPeriodId(undefined); setCapacity(""); };
  const openCreate = () => { cancelEdit(); setVisible(true); };
  const openEdit = (classroom: Classroom) => { editClassroom(classroom); setVisible(true); };
  const close = () => { cancelEdit(); setVisible(false); };
  const save = async () => {
    if (!name.trim() || !levelId || !branchId) return Alert.alert(t("learning.selectLevel"));
    const input = { name: name.trim(), learningLevelId: levelId, branchId, learningPeriodId: periodId, capacity: capacity ? Number(capacity) : undefined };
    try {
      if (editingClassroomId) await updateClassroom.mutateAsync({ id: editingClassroomId, input }); else await createClassroom.mutateAsync(input);
      close();
    } catch (error) { failure(error); }
  };

  return <AppScreen showBottomNavigation={false} title={t("learning.classroom")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {isStaffAdmin && <View style={styles.options}><BranchFilterControl branchId={filterBranchId} onChange={setFilterBranchId} />{canManage && <Button onPress={openCreate}>{t("learning.addClassroom")}</Button>}</View>}
    {classrooms.data?.map((classroom) => <ClassroomCard key={classroom.id} classroom={classroom} levelName={levels.data?.find((level) => level.id === classroom.learningLevelId)?.name} branchName={branches.data?.find((branch) => branch.id === classroom.branchId)?.name} periodName={periods.data?.find((period) => period.id === classroom.learningPeriodId)?.name} canManage={canManage} onEdit={() => openEdit(classroom)} onArchive={() => void archiveClassroom.mutateAsync(classroom.id)} />)}
    {classrooms.data?.length === 0 && <AppText tone="muted">{t("learning.noClassrooms")}</AppText>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t(editingClassroomId ? "learning.editClassroom" : "learning.addClassroom")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t(editingClassroomId ? "common.save" : "learning.addClassroom"), loading: createClassroom.isPending || updateClassroom.isPending, onPress: () => void save() }}>
      <View style={styles.options}>{branches.data?.map((branch) => <Button key={branch.id} variant={branchId === branch.id ? "primary" : "secondary"} onPress={() => setBranchId(branch.id)}>{branch.name}</Button>)}</View>
      <View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={levelId === level.id ? "primary" : "secondary"} onPress={() => setLevelId(level.id)}>{level.name}</Button>)}</View>
      <View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={periodId === period.id ? "primary" : "secondary"} onPress={() => setPeriodId(period.id)}>{period.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("learning.classroomName")} value={name} onChangeText={setName} />
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
    {programs.data?.map((program) => <View key={program.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText>{program.name}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View>{canManage && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.removeProgram")} onPress={() => void removeProgram.mutateAsync(program.id)} />}</View>)}
    {programs.data?.length === 0 && <AppText tone="muted">{t("learning.noClassroomPrograms")}</AppText>}
    {canManage && classroom.active && <Button variant="secondary" onPress={() => setCardSheet("program")}>{t("learning.addClassroomProgram")}</Button>}
    <AppText variant="label">{t("learning.staff")}</AppText>
    {staff.data?.map((assignment) => <View key={assignment.id} style={styles.assignment}><View style={styles.assignmentContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)}</AppText></View>{canManage && <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.unassignStaff")} onPress={() => void unassign.mutateAsync(assignment.id)} />}</View>)}
    {staff.data?.length === 0 && <AppText tone="muted">{t("learning.noStaff")}</AppText>}
    {canManage && classroom.active && <View style={styles.options}>
      <Button variant="secondary" onPress={() => setCardSheet("staff")}>{t("learning.assignStaff")}</Button>
      <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("learning.edit")} onPress={onEdit} />
      <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.archive")} onPress={onArchive} />
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
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
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
