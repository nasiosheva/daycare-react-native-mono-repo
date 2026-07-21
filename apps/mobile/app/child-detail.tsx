import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useAddChildProgram, useAssignChildStaff, useChildProfile, useCreateChild, useDeactivateChild, useRemoveChildProgram, useUnassignChildStaff, useUpdateChild } from "@/children/useChildManagement";
import { useI18n } from "@/i18n/I18nProvider";

const assignmentRoles = ["STAFF", "NURSE", "MISS"] as const;

export default function ChildDetailScreen() {
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const canPlaceChild = membership?.active !== false;
  const childProfile = useChildProfile(childId);
  const createChild = useCreateChild();
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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [staffUserId, setStaffUserId] = useState<string | null>(null);
  const [assignmentRole, setAssignmentRole] = useState<(typeof assignmentRoles)[number]>("STAFF");
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [placementStart, setPlacementStart] = useState("");
  const assignableStaff = useMemo(() => staff.data?.filter((user) => user.userId && user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || user.role === "STAFF")) ?? [], [staff.data]);
  const assignmentRoleLabel = (role: (typeof assignmentRoles)[number]) => role === "NURSE" ? t("children.nurse") : role === "MISS" ? t("children.miss") : t("children.staff");

  useEffect(() => {
    if (!childProfile.data) return;
    setFirstName(childProfile.data.child.firstName);
    setLastName(childProfile.data.child.lastName ?? "");
    setDateOfBirth(childProfile.data.child.dateOfBirth);
  }, [childProfile.data]);

  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role) || (!childId && !canManage)) return <Redirect href="/home" />;
  const saveChild = async () => {
    if (!firstName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return Alert.alert(t("children.required"));
    const payload = { firstName: firstName.trim(), lastName: lastName.trim() || undefined, dateOfBirth };
    try {
      const child = childId ? await updateChild.mutateAsync(payload) : await createChild.mutateAsync(payload);
      Alert.alert(childId ? t("children.updated") : t("children.created"));
      if (!childId) router.replace({ pathname: "/child-detail", params: { childId: child.id } });
    } catch (error) { Alert.alert(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const saveProgram = async () => {
    if (!childId || !programName.trim()) return;
    try { await addProgram.mutateAsync({ name: programName.trim(), description: programDescription.trim() || undefined }); setProgramName(""); setProgramDescription(""); }
    catch (error) { Alert.alert(t("children.programFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const saveAssignment = async () => {
    if (!childId || !staffUserId) return;
    try { await assignStaff.mutateAsync({ userId: staffUserId, assignmentRole }); setStaffUserId(null); }
    catch (error) { Alert.alert(t("children.assignmentFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const deactivate = () => {
    if (!childId) return;
    Alert.alert(t("children.deactivate"), t("children.deactivateDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("children.deactivate"), style: "destructive", onPress: () => void deactivateChild.mutateAsync().then(() => router.replace("/children")).catch((error: unknown) => Alert.alert(t("children.deactivateFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))) },
    ]);
  };

  return <AppScreen showBottomNavigation={false} title={childId ? t("children.detailTitle") : t("children.add")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {childId && childProfile.isLoading ? <AppText>{t("children.loading")}</AppText> : <View style={styles.form}>
      <AppText variant="h5">{childId ? t("children.edit") : t("children.add")}</AppText>
      <TextInput style={styles.input} placeholder={t("children.firstName")} value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder={t("children.lastName")} value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} placeholder={t("children.birthDate")} value={dateOfBirth} onChangeText={setDateOfBirth} />
      {canManage && <Button loading={createChild.isPending || updateChild.isPending} onPress={() => void saveChild()}>{t("children.save")}</Button>}
      {canManage && childId && <Button variant="danger" loading={deactivateChild.isPending} onPress={deactivate}>{t("children.deactivate")}</Button>}
    </View>}
    {childId && childProfile.data && <>
      <View style={styles.form}><AppText variant="h5">{t("learning.placements")}</AppText>
        {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
        {canPlaceChild && <><View style={styles.options}>{classrooms.data?.filter((classroom) => classroom.active).map((classroom) => <Button key={classroom.id} variant={classroomId === classroom.id ? "primary" : "secondary"} onPress={() => setClassroomId(classroom.id)}>{classroom.name}</Button>)}</View>
        <TextInput style={styles.input} placeholder={t("learning.startDate")} value={placementStart} onChangeText={setPlacementStart} />
        <Button loading={placeChild.isPending} disabled={!classroomId} onPress={() => { if (!classroomId) return; void placeChild.mutateAsync({ classroomId, startsOn: placementStart || undefined }).then((placement) => { if (placement.ageGuidanceWarning) Alert.alert(t("learning.ageGuidance")); setClassroomId(null); setPlacementStart(""); }).catch((error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))); }}>{t("learning.placeChild")}</Button></>}
        {placements.data?.map((placement) => <View key={placement.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{placement.learningLevelName ?? "–"} · {placement.classroomName}</AppText><AppText variant="bodySmall" tone="muted">{placement.startsOn}{placement.endedOn ? ` – ${placement.endedOn}` : ""}</AppText></View></View>)}
        {placements.data?.length === 0 && <AppText tone="muted">{t("learning.noPlacements")}</AppText>}
      </View>
      {canManage && <View style={styles.form}><AppText variant="h5">{t("children.programs")}</AppText>
        <TextInput style={styles.input} placeholder={t("children.programName")} value={programName} onChangeText={setProgramName} />
        <TextInput style={styles.input} placeholder={t("children.programDescription")} value={programDescription} onChangeText={setProgramDescription} />
        <Button loading={addProgram.isPending} disabled={!programName.trim()} onPress={() => void saveProgram()}>{t("children.addProgram")}</Button>
        {childProfile.data.programs.map((program) => <View key={program.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{program.name}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View><Button variant="danger" onPress={() => void removeProgram.mutateAsync(program.id)}>{t("children.remove")}</Button></View>)}
        {childProfile.data.programs.length === 0 && <AppText tone="muted">{t("children.noPrograms")}</AppText>}
      </View>}
      {canManage && <View style={styles.form}><AppText variant="h5">{t("children.staffAssignments")}</AppText>
        <View style={styles.options}>{assignableStaff.map((user) => <Button key={user.id} variant={staffUserId === user.userId ? "primary" : "secondary"} onPress={() => setStaffUserId(user.userId)}>{user.displayName ?? user.email ?? t("children.selectStaff")}</Button>)}</View>
        <AppText variant="label">{t("children.assignmentRole")}</AppText>
        <View style={styles.options}>{assignmentRoles.map((role) => <Button key={role} variant={assignmentRole === role ? "primary" : "secondary"} onPress={() => setAssignmentRole(role)}>{assignmentRoleLabel(role)}</Button>)}</View>
        <Button loading={assignStaff.isPending} disabled={!staffUserId} onPress={() => void saveAssignment()}>{t("children.assign")}</Button>
        {childProfile.data.staffAssignments.map((assignment) => <View key={assignment.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)} · {assignment.email}</AppText></View><Button variant="danger" onPress={() => void unassignStaff.mutateAsync(assignment.id)}>{t("children.unassign")}</Button></View>)}
        {childProfile.data.staffAssignments.length === 0 && <AppText tone="muted">{t("children.noStaff")}</AppText>}
      </View>}
    </>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  itemContent: { flex: 1, gap: spacing.xs },
});
