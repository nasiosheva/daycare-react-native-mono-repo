import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildGender } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useAddChildProgram, useAssignChildStaff, useChildProfile, useDeactivateChild, useRemoveChildProgram, useUnassignChildStaff, useUpdateChild } from "@/children/useChildManagement";
import { GenderPicker } from "@/children/GenderPicker";
import { useI18n } from "@/i18n/I18nProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";

const assignmentRoles = ["STAFF", "NURSE", "MISS"] as const;

export default function ChildDetailScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const canManagePrograms = canManage || (membership?.role === "STAFF" && membership.active && membership.canManageChildPrograms);
  const canPlaceChild = membership?.active !== false;
  const childProfile = useChildProfile(childId);
  const updateChild = useUpdateChild(childId ?? "");
  const deactivateChild = useDeactivateChild(childId ?? "");
  const addProgram = useAddChildProgram(childId ?? "");
  const removeProgram = useRemoveChildProgram(childId ?? "");
  const assignStaff = useAssignChildStaff(childId ?? "");
  const unassignStaff = useUnassignChildStaff(childId ?? "");
  const staff = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" && Boolean(childId) });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: Boolean(childId && membership) });
  const placements = useQuery({ queryKey: ["child-placements", organizationId, childId], queryFn: () => api.childPlacements(childId!), enabled: Boolean(childId && membership) });
  const placeChild = useMutation({ mutationFn: (input: { classroomId: string; startsOn?: string }) => api.placeChild(childId!, input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["child-placements", organizationId, childId] }); void queryClient.invalidateQueries({ queryKey: ["children", organizationId] }); } });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nisn, setNisn] = useState("");
  const [gender, setGender] = useState<ChildGender>();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [staffUserId, setStaffUserId] = useState<string | null>(null);
  const [assignmentRole, setAssignmentRole] = useState<(typeof assignmentRoles)[number]>("STAFF");
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [placementStart, setPlacementStart] = useState("");
  const [sheet, setSheet] = useState<"edit" | "placement" | "program" | "staff" | null>(null);
  const [placementsOpen, setPlacementsOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [staffListOpen, setStaffListOpen] = useState(false);
  const childBranchId = childProfile.data?.child.branchId;
  const assignableStaff = useMemo(() => staff.data?.filter((user) => user.userId && user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || (user.role === "STAFF" && user.branchId === childBranchId))) ?? [], [staff.data, childBranchId]);
  const assignmentRoleLabel = (role: (typeof assignmentRoles)[number]) => role === "NURSE" ? t("children.nurse") : role === "MISS" ? t("children.miss") : t("children.staff");

  useEffect(() => {
    if (!childProfile.data) return;
    setFirstName(childProfile.data.child.firstName);
    setLastName(childProfile.data.child.lastName ?? "");
    setNisn(childProfile.data.child.nisn ?? "");
    setGender(childProfile.data.child.gender === "UNSPECIFIED" ? undefined : childProfile.data.child.gender);
    setDateOfBirth(childProfile.data.child.dateOfBirth);
  }, [childProfile.data]);

  if (!profile) return null;
  if (!childId || !membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  const saveChild = async () => {
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return Alert.alert(t("children.required"));
    const payload = { firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth };
    try {
      await updateChild.mutateAsync(payload);
      setSheet(null);
      Alert.alert(t("children.updated"));
    } catch (error) { Alert.alert(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const saveProgram = async () => {
    if (!childId || !programName.trim()) return;
    try { await addProgram.mutateAsync({ name: programName.trim(), description: programDescription.trim() || undefined }); setProgramName(""); setProgramDescription(""); setSheet(null); }
    catch (error) { Alert.alert(t("children.programFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const saveAssignment = async () => {
    if (!childId || !staffUserId) return;
    try { await assignStaff.mutateAsync({ userId: staffUserId, assignmentRole }); setStaffUserId(null); setSheet(null); }
    catch (error) { Alert.alert(t("children.assignmentFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const deactivate = () => {
    if (!childId) return;
    Alert.alert(t("children.deactivate"), t("children.deactivateDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("children.deactivate"), style: "destructive", onPress: () => void deactivateChild.mutateAsync().then(() => router.replace("/children")).catch((error: unknown) => Alert.alert(t("children.deactivateFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))) },
    ]);
  };

  return <AppScreen showBottomNavigation={false} title={t("children.detailTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {childProfile.isLoading ? <AppText>{t("children.loading")}</AppText> : childProfile.data && <View style={styles.form}>
      <AppText variant="h5">{childProfile.data.child.fullName}</AppText>
      <AppText tone="muted">{childProfile.data.child.gender === "MALE" ? t("children.genderMale") : childProfile.data.child.gender === "FEMALE" ? t("children.genderFemale") : t("children.genderUnspecified")}</AppText>
      <AppText tone="muted">{childProfile.data.child.dateOfBirth}</AppText>
      <View style={styles.options}><Button variant="secondary" onPress={() => router.push({ pathname: "/goals", params: { childId } })}>{t("goals.title")}</Button>{canManage && <><Button variant="secondary" onPress={() => setSheet("edit")}>{t("children.edit")}</Button><Button variant="danger" loading={deactivateChild.isPending} onPress={deactivate}>{t("children.deactivate")}</Button></>}</View>
    </View>}
    {childId && childProfile.data && <>
      {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
      <NavigationCard accessibilityLabel={t("learning.placements")} onPress={() => setPlacementsOpen(true)}>
        <AppText variant="h5">{t("learning.placements")}</AppText>
        <AppText tone={placements.data?.length ? "default" : "muted"}>{placements.data?.length ? t("learning.placementsSummary", { count: placements.data.length }) : t("learning.noPlacements")}</AppText>
      </NavigationCard>
      {canManagePrograms && <NavigationCard accessibilityLabel={t("children.programs")} onPress={() => setProgramsOpen(true)}>
        <AppText variant="h5">{t("children.programs")}</AppText>
        <AppText tone={childProfile.data.programs.length ? "default" : "muted"}>{childProfile.data.programs.length ? t("children.programsSummary", { count: childProfile.data.programs.length }) : t("children.noPrograms")}</AppText>
      </NavigationCard>}
      {canManage && <NavigationCard accessibilityLabel={t("children.staffAssignments")} onPress={() => setStaffListOpen(true)}>
        <AppText variant="h5">{t("children.staffAssignments")}</AppText>
        <AppText tone={childProfile.data.staffAssignments.length ? "default" : "muted"}>{childProfile.data.staffAssignments.length ? t("children.staffAssignmentsSummary", { count: childProfile.data.staffAssignments.length }) : t("children.noStaff")}</AppText>
      </NavigationCard>}
    </>}

    <BottomSheet visible={placementsOpen} onClose={() => setPlacementsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("learning.placements")}>
      {canPlaceChild && <Button variant="secondary" onPress={() => { setPlacementsOpen(false); setSheet("placement"); }}>{t("learning.placeChild")}</Button>}
      {placements.data?.map((placement) => <View key={placement.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{placement.learningLevelName ?? "–"} · {placement.classroomName}</AppText><AppText variant="bodySmall" tone="muted">{placement.startsOn}{placement.endedOn ? ` – ${placement.endedOn}` : ""}</AppText></View></View>)}
      {placements.data?.length === 0 && <AppText tone="muted">{t("learning.noPlacements")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={programsOpen} onClose={() => setProgramsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.programs")}>
      <Button variant="secondary" onPress={() => { setProgramsOpen(false); setSheet("program"); }}>{t("children.addProgram")}</Button>
      {childProfile.data?.programs.map((program) => <View key={program.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{program.name}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View><Button variant="danger" onPress={() => void removeProgram.mutateAsync(program.id)}>{t("children.remove")}</Button></View>)}
      {childProfile.data?.programs.length === 0 && <AppText tone="muted">{t("children.noPrograms")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={staffListOpen} onClose={() => setStaffListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.staffAssignments")}>
      <Button variant="secondary" onPress={() => { setStaffListOpen(false); setSheet("staff"); }}>{t("children.assign")}</Button>
      {childProfile.data?.staffAssignments.map((assignment) => <View key={assignment.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)} · {assignment.email}</AppText></View><Button variant="danger" onPress={() => void unassignStaff.mutateAsync(assignment.id)}>{t("children.unassign")}</Button></View>)}
      {childProfile.data?.staffAssignments.length === 0 && <AppText tone="muted">{t("children.noStaff")}</AppText>}
    </BottomSheet>
    <BottomSheet visible={sheet === "edit"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.save"), loading: updateChild.isPending, onPress: () => void saveChild() }}>
      <TextInput style={styles.input} placeholder={t("children.firstName")} value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder={t("children.lastName")} value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("children.nisn")} value={nisn} onChangeText={setNisn} />
      <GenderPicker value={gender} onChange={setGender} />
      <DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} />
    </BottomSheet>
    <BottomSheet visible={sheet === "placement"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("learning.placeChild")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("learning.placeChild"), loading: placeChild.isPending, disabled: !classroomId, onPress: () => { if (!classroomId) return; void placeChild.mutateAsync({ classroomId, startsOn: placementStart || undefined }).then((placement) => { if (placement.ageGuidanceWarning) Alert.alert(t("learning.ageGuidance")); setClassroomId(null); setPlacementStart(""); setSheet(null); }).catch((error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))); } }}>
      <View style={styles.options}>{classrooms.data?.filter((classroom) => classroom.active).map((classroom) => <Button key={classroom.id} variant={classroomId === classroom.id ? "primary" : "secondary"} onPress={() => setClassroomId(classroom.id)}>{classroom.name}</Button>)}</View>
      <DatePicker placeholder={t("learning.startDate")} value={placementStart} onChange={setPlacementStart} onClear={() => setPlacementStart("")} clearAccessibilityLabel={t("common.clear")} />
    </BottomSheet>
    <BottomSheet visible={sheet === "program"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.addProgram")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.addProgram"), loading: addProgram.isPending, disabled: !programName.trim(), onPress: () => void saveProgram() }}>
      <TextInput style={styles.input} placeholder={t("children.programName")} value={programName} onChangeText={setProgramName} />
      <TextInput style={styles.input} placeholder={t("children.programDescription")} value={programDescription} onChangeText={setProgramDescription} />
    </BottomSheet>
    <BottomSheet visible={sheet === "staff"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.assign")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.assign"), loading: assignStaff.isPending, disabled: !staffUserId, onPress: () => void saveAssignment() }}>
      <View style={styles.options}>{assignableStaff.map((user) => <Button key={user.id} variant={staffUserId === user.userId ? "primary" : "secondary"} onPress={() => setStaffUserId(user.userId)}>{user.displayName ?? user.email ?? t("children.selectStaff")}</Button>)}</View>
      <AppText variant="label">{t("children.assignmentRole")}</AppText>
      <View style={styles.options}>{assignmentRoles.map((role) => <Button key={role} variant={assignmentRole === role ? "primary" : "secondary"} onPress={() => setAssignmentRole(role)}>{assignmentRoleLabel(role)}</Button>)}</View>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  itemContent: { flex: 1, gap: spacing.xs },
});
