import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildGender } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useAddChildProgram, useAssignChildStaff, useBindChildGuardian, useChildProfile, useDeactivateChild, useRemoveChildProgram, useUnassignChildStaff, useUnbindChildGuardian, useUpdateChild } from "@/children/useChildManagement";
import { GenderPicker } from "@/children/GenderPicker";
import { useI18n } from "@/i18n/I18nProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";
import { notify } from "@/notify/notify";
import { capitalizeWords } from "@/text/capitalizeWords";

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
  const childProfile = useChildProfile(childId);
  const updateChild = useUpdateChild(childId ?? "");
  const deactivateChild = useDeactivateChild(childId ?? "");
  const addProgram = useAddChildProgram(childId ?? "");
  const removeProgram = useRemoveChildProgram(childId ?? "");
  const assignStaff = useAssignChildStaff(childId ?? "");
  const unassignStaff = useUnassignChildStaff(childId ?? "");
  const bindGuardian = useBindChildGuardian(childId ?? "");
  const unbindGuardian = useUnbindChildGuardian(childId ?? "");
  const staff = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" && Boolean(childId) });
  const placementOptions = useQuery({ queryKey: ["child-placement-options", organizationId, childId], queryFn: () => api.childPlacementOptions(childId!), enabled: Boolean(childId && membership?.active) });
  const academicYears = useQuery({ queryKey: ["academic-years", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(childId && membership) });
  const placements = useQuery({ queryKey: ["child-placements", organizationId, childId], queryFn: () => api.childPlacements(childId!), enabled: Boolean(childId && membership) });
  const placeChild = useMutation({ mutationFn: (input: { classroomId: string; startsOn?: string }) => api.placeChild(childId!, input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["child-placements", organizationId, childId] }); void queryClient.invalidateQueries({ queryKey: ["child-placement-options", organizationId, childId] }); void queryClient.invalidateQueries({ queryKey: ["children", organizationId] }); } });
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
  const [guardianIdentifier, setGuardianIdentifier] = useState("");
  const [sheet, setSheet] = useState<"edit" | "placement" | "program" | "staff" | "guardian" | null>(null);
  const [placementsOpen, setPlacementsOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [staffListOpen, setStaffListOpen] = useState(false);
  const [guardiansOpen, setGuardiansOpen] = useState(false);
  const childBranchId = childProfile.data?.child.branchId;
  const assignableStaff = useMemo(() => staff.data?.filter((user) => user.userId && user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || (user.role === "STAFF" && user.branchId === childBranchId))) ?? [], [staff.data, childBranchId]);
  const assignmentRoleLabel = (role: (typeof assignmentRoles)[number]) => role === "NURSE" ? t("children.nurse") : role === "MISS" ? t("children.miss") : t("children.staff");
  const currentPlacement = placements.data?.find((placement) => !placement.endedOn) ?? null;
  const academicYearName = (id?: string | null) => academicYears.data?.find((year) => year.id === id)?.name;
  const canPlaceChild = membership?.active === true && (placementOptions.data?.length ?? 0) > 0;
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : t("auth.tryAgain");

  const closePlacementSheet = () => {
    setClassroomId(null);
    setPlacementStart("");
    setSheet(null);
  };

  useEffect(() => {
    if (!childProfile.data) return;
    setFirstName(childProfile.data.child.firstName);
    setLastName(childProfile.data.child.lastName ?? "");
    setNisn(childProfile.data.child.nisn ?? "");
    setGender(childProfile.data.child.gender === "UNSPECIFIED" ? undefined : childProfile.data.child.gender);
    setDateOfBirth(childProfile.data.child.dateOfBirth);
  }, [childProfile.data]);

  useEffect(() => {
    if (classroomId && !placementOptions.data?.some((classroom) => classroom.id === classroomId)) setClassroomId(null);
  }, [classroomId, placementOptions.data]);

  if (!profile) return null;
  if (!childId || !membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  const saveChild = async () => {
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return notify(t("children.required"));
    const payload = { firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth };
    try {
      await updateChild.mutateAsync(payload);
      setSheet(null);
      notify(t("children.updated"));
    } catch (error) { notify(t("children.saveFailed"), errorMessage(error)); }
  };
  const saveProgram = async () => {
    if (!childId || !programName.trim()) return;
    try { await addProgram.mutateAsync({ name: programName.trim(), description: programDescription.trim() || undefined }); setProgramName(""); setProgramDescription(""); setSheet(null); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };
  const saveAssignment = async () => {
    if (!childId || !staffUserId) return;
    try { await assignStaff.mutateAsync({ userId: staffUserId, assignmentRole }); setStaffUserId(null); setSheet(null); }
    catch (error) { notify(t("children.assignmentFailed"), errorMessage(error)); }
  };
  const removeChildProgram = async (programId: string) => {
    try { await removeProgram.mutateAsync(programId); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };
  const removeAssignedStaff = async (assignmentId: string) => {
    try { await unassignStaff.mutateAsync(assignmentId); }
    catch (error) { notify(t("children.assignmentFailed"), errorMessage(error)); }
  };
  const saveGuardianBind = async () => {
    if (!guardianIdentifier.trim()) return notify(t("children.guardianIdentifierRequired"));
    try { await bindGuardian.mutateAsync(guardianIdentifier.trim()); setGuardianIdentifier(""); setSheet(null); }
    catch (error) { notify(t("children.guardianBindFailed"), errorMessage(error)); }
  };
  const removeGuardian = async (userId: string) => {
    try { await unbindGuardian.mutateAsync(userId); }
    catch (error) { notify(t("children.unbindGuardianFailed"), errorMessage(error)); }
  };
  const savePlacement = async () => {
    if (!classroomId) return;
    try {
      const placement = await placeChild.mutateAsync({ classroomId, startsOn: placementStart || undefined });
      closePlacementSheet();
      if (placement.ageGuidanceWarning) notify(t("learning.ageGuidance"));
    } catch (error) { notify(t("learning.saveFailed"), errorMessage(error)); }
  };
  const deactivate = () => {
    if (!childId) return;
    Alert.alert(t("children.deactivate"), t("children.deactivateDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("children.deactivate"), style: "destructive", onPress: () => void deactivateChild.mutateAsync().then(() => router.replace("/children")).catch((error: unknown) => notify(t("children.deactivateFailed"), errorMessage(error))) },
    ]);
  };

  return <AppScreen showBottomNavigation={false} title={t("children.detailTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {childProfile.isLoading ? <ShimmerList variant="tile" /> : childProfile.isError ? <View style={styles.errorState}><AppText tone="muted">{t("auth.profileLoadFailed")}</AppText><Button variant="secondary" onPress={() => void childProfile.refetch()}>{t("common.retry")}</Button></View> : childProfile.data && <View style={styles.form}>
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
      {canManage && <NavigationCard accessibilityLabel={t("children.guardians")} onPress={() => setGuardiansOpen(true)}>
        <AppText variant="h5">{t("children.guardians")}</AppText>
        <AppText tone={childProfile.data.guardians.length ? "default" : "muted"}>{childProfile.data.guardians.length ? t("children.guardiansSummary", { count: childProfile.data.guardians.length }) : t("children.noGuardians")}</AppText>
      </NavigationCard>}
    </>}

    <BottomSheet visible={placementsOpen} onClose={() => setPlacementsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("learning.placements")}>
      {canPlaceChild && <Button variant="secondary" onPress={() => { setPlacementsOpen(false); setSheet("placement"); }}>{t("learning.placeChild")}</Button>}
      {placements.isFetching && <ShimmerList variant="row" />}
      {placements.isError && <View style={styles.errorState}><AppText tone="muted">{t("common.error")}</AppText><Button variant="secondary" onPress={() => void placements.refetch()}>{t("common.retry")}</Button></View>}
      {!placements.isFetching && placements.data?.map((placement) => <View key={placement.id} style={styles.item}><View style={styles.itemContent}><View style={styles.row}><AppText variant="label">{placement.learningLevelName ?? "–"} · {placement.classroomName}</AppText>{!placement.endedOn && <AppText variant="caption" style={styles.activeBadge}>{t("learning.active")}</AppText>}</View><AppText variant="bodySmall" tone="muted">{placement.startsOn}{placement.endedOn ? ` – ${placement.endedOn}` : ""}{academicYearName(placement.learningPeriodId) ? ` · ${academicYearName(placement.learningPeriodId)}` : ""}</AppText></View></View>)}
      {!placements.isFetching && placements.data?.length === 0 && <AppText tone="muted">{t("learning.noPlacements")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={programsOpen} onClose={() => setProgramsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.programs")}>
      <Button variant="secondary" onPress={() => { setProgramsOpen(false); setSheet("program"); }}>{t("children.addProgram")}</Button>
      {childProfile.isFetching && <ShimmerList variant="row" />}
      {!childProfile.isFetching && childProfile.data?.programs.map((program) => <View key={program.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{program.name}</AppText><AppText variant="bodySmall" tone="muted">{t(`children.programStatus.${program.status}`)} · {program.steps.length} {t("children.steps")}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View><View style={styles.actions}><Button variant="secondary" onPress={() => { setProgramsOpen(false); router.push({ pathname: "/child-program-detail", params: { childId: childId!, programId: program.id } }); }}>{t("children.programManage")}</Button>{program.steps.length === 0 && program.staffNotes.length === 0 && program.parentFeedback.length === 0 && <Button variant="danger" loading={removeProgram.isPending} onPress={() => void removeChildProgram(program.id)}>{t("children.remove")}</Button>}</View></View>)}
      {!childProfile.isFetching && childProfile.data?.programs.length === 0 && <AppText tone="muted">{t("children.noPrograms")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={staffListOpen} onClose={() => setStaffListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.staffAssignments")}>
      <Button variant="secondary" onPress={() => { setStaffListOpen(false); setSheet("staff"); }}>{t("children.assign")}</Button>
      {childProfile.isFetching && <ShimmerList variant="row" />}
      {childProfile.isError && <View style={styles.errorState}><AppText tone="muted">{t("common.error")}</AppText><Button variant="secondary" onPress={() => void childProfile.refetch()}>{t("common.retry")}</Button></View>}
      {!childProfile.isFetching && childProfile.data?.staffAssignments.map((assignment) => <View key={assignment.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)} · {assignment.email}</AppText></View><Button variant="danger" loading={unassignStaff.isPending} onPress={() => void removeAssignedStaff(assignment.id)}>{t("children.unassign")}</Button></View>)}
      {!childProfile.isFetching && childProfile.data?.staffAssignments.length === 0 && <AppText tone="muted">{t("children.noStaff")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={guardiansOpen} onClose={() => setGuardiansOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.guardians")}>
      <Button variant="secondary" onPress={() => { setGuardiansOpen(false); setSheet("guardian"); }}>{t("children.bindGuardian")}</Button>
      {childProfile.isFetching && <ShimmerList variant="row" />}
      {childProfile.isError && <View style={styles.errorState}><AppText tone="muted">{t("common.error")}</AppText><Button variant="secondary" onPress={() => void childProfile.refetch()}>{t("common.retry")}</Button></View>}
      {!childProfile.isFetching && childProfile.data?.guardians.map((guardian) => <View key={guardian.userId} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{guardian.displayName}</AppText><AppText variant="bodySmall" tone="muted">{guardian.email ?? guardian.username}</AppText></View><Button variant="danger" loading={unbindGuardian.isPending} onPress={() => void removeGuardian(guardian.userId)}>{t("children.unbindGuardian")}</Button></View>)}
      {!childProfile.isFetching && childProfile.data?.guardians.length === 0 && <AppText tone="muted">{t("children.noGuardians")}</AppText>}
    </BottomSheet>
    <BottomSheet visible={sheet === "guardian"} onClose={() => { setSheet(null); setGuardianIdentifier(""); }} closeAccessibilityLabel={t("common.close")} title={t("children.bindGuardian")} negativeAction={{ label: t("common.cancel"), onPress: () => { setSheet(null); setGuardianIdentifier(""); } }} positiveAction={{ label: t("children.bindGuardian"), loading: bindGuardian.isPending, disabled: !guardianIdentifier.trim(), onPress: () => void saveGuardianBind() }}>
      <TextInput style={styles.input} placeholder={t("children.guardianIdentifier")} autoCapitalize="none" value={guardianIdentifier} onChangeText={setGuardianIdentifier} />
    </BottomSheet>
    <BottomSheet visible={sheet === "edit"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.save"), loading: updateChild.isPending, onPress: () => void saveChild() }}>
      <TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.firstName")} value={firstName} onChangeText={(value) => setFirstName(capitalizeWords(value))} />
      <TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.lastName")} value={lastName} onChangeText={(value) => setLastName(capitalizeWords(value))} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("children.nisn")} value={nisn} onChangeText={setNisn} />
      <GenderPicker value={gender} onChange={setGender} />
      <DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} />
    </BottomSheet>
    <BottomSheet visible={sheet === "placement"} onClose={closePlacementSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.placeChild")} negativeAction={{ label: t("common.cancel"), onPress: closePlacementSheet }} positiveAction={{ label: t("learning.placeChild"), loading: placeChild.isPending, disabled: !classroomId, onPress: () => void savePlacement() }}>
      <AppText tone="muted">{currentPlacement ? t("learning.currentPlacementContext", { level: currentPlacement.learningLevelName ?? "–", classroom: currentPlacement.classroomName }) : t("learning.noCurrentPlacement")}</AppText>
      <AppText variant="label">{t("learning.selectClassroom")}</AppText>
      {placementOptions.isFetching && <ShimmerList variant="row" />}
      {placementOptions.isError && <View style={styles.errorState}><AppText tone="muted">{t("common.error")}</AppText><Button variant="secondary" onPress={() => void placementOptions.refetch()}>{t("common.retry")}</Button></View>}
      {!placementOptions.isFetching && !placementOptions.isError && <View style={styles.options}>{placementOptions.data?.map((classroom) => <Button key={classroom.id} variant={classroomId === classroom.id ? "primary" : "secondary"} onPress={() => setClassroomId(classroom.id)}>{classroom.name}</Button>)}</View>}
      {!placementOptions.isFetching && !placementOptions.isError && placementOptions.data?.length === 0 && <AppText tone="muted">{t("learning.noPlacementOptions")}</AppText>}
      <DatePicker placeholder={t("learning.startDate")} value={placementStart} onChange={setPlacementStart} onClear={() => setPlacementStart("")} clearAccessibilityLabel={t("common.clear")} />
      {currentPlacement && <AppText variant="caption" tone="muted">{t("learning.placeChildWarning")}</AppText>}
    </BottomSheet>
    <BottomSheet visible={sheet === "program"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.addProgram")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.addProgram"), loading: addProgram.isPending, disabled: !programName.trim(), onPress: () => void saveProgram() }}>
      <TextInput style={styles.input} placeholder={t("children.programName")} value={programName} onChangeText={setProgramName} />
      <TextInput style={styles.input} placeholder={t("children.programDescription")} value={programDescription} onChangeText={setProgramDescription} />
    </BottomSheet>
    <BottomSheet visible={sheet === "staff"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.assign")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.assign"), loading: assignStaff.isPending, disabled: !staffUserId, onPress: () => void saveAssignment() }}>
      {staff.isFetching && <ShimmerList variant="row" />}
      {staff.isError && <View style={styles.errorState}><AppText tone="muted">{t("common.error")}</AppText><Button variant="secondary" onPress={() => void staff.refetch()}>{t("common.retry")}</Button></View>}
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
  actions: { gap: spacing.xs, alignItems: "flex-end" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  errorState: { gap: spacing.sm, alignItems: "flex-start" },
  activeBadge: { color: colors.primary, fontWeight: "700" },
});
