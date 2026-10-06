import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildGender } from "@daycare/core";
import { AppText, Avatar, Badge, BackButton, Banner, BottomSheet, Button, Chip, ChipGroup, EmptyState, ErrorState, MenuItem, MenuSection, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useAddChildProgram, useAssignChildStaff, useBindChildGuardian, useChildProfile, useChildProgramTemplates, useCreateChildProgramFromTemplate, useDeactivateChild, useRemoveChildProgram, useUnassignChildStaff, useUnbindChildGuardian, useUpdateChild } from "@/children/useChildManagement";
import { GenderPicker } from "@/children/GenderPicker";
import { useI18n } from "@/i18n/I18nProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";
import { notify } from "@/notify/notify";
import { capitalizeWords } from "@/text/capitalizeWords";
import { hasBranchOfferingCapability, hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

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
  const access = useUiAccessContext(Boolean(membership));
  const canAccessLegacyClasses = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const childProfile = useChildProfile(childId);
  const updateChild = useUpdateChild(childId ?? "");
  const deactivateChild = useDeactivateChild(childId ?? "");
  const addProgram = useAddChildProgram(childId ?? "");
  const removeProgram = useRemoveChildProgram(childId ?? "");
  const programTemplates = useChildProgramTemplates(canManagePrograms);
  const createProgramFromTemplate = useCreateChildProgramFromTemplate(childId ?? "");
  const assignStaff = useAssignChildStaff(childId ?? "");
  const unassignStaff = useUnassignChildStaff(childId ?? "");
  const bindGuardian = useBindChildGuardian(childId ?? "");
  const unbindGuardian = useUnbindChildGuardian(childId ?? "");
  const staff = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" && Boolean(childId) });
  const placementOptions = useQuery({ queryKey: ["child-placement-options", organizationId, childId], queryFn: () => api.childPlacementOptions(childId!), enabled: Boolean(childId && membership?.active && canAccessLegacyClasses) });
  const academicYears = useQuery({ queryKey: ["academic-years", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(childId && hasAcademicOffering) });
  const placements = useQuery({ queryKey: ["child-placements", organizationId, childId], queryFn: () => api.childPlacements(childId!), enabled: Boolean(childId && membership && canAccessLegacyClasses) });
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
  const canManagePickup = canManage && hasBranchOfferingCapability(access.data, childBranchId, "DAYCARE_OPERATIONS");
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
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return notify(t("children.required"), undefined, "warning");
    const payload = { firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth };
    try {
      await updateChild.mutateAsync(payload);
      setSheet(null);
      notify(t("children.updated"), undefined, "success");
    } catch (error) { notify(t("children.saveFailed"), errorMessage(error), "danger"); }
  };
  const saveProgram = async () => {
    if (!childId || !programName.trim()) return;
    try { await addProgram.mutateAsync({ name: programName.trim(), description: programDescription.trim() || undefined }); setProgramName(""); setProgramDescription(""); setSheet(null); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };
  const applyProgramTemplate = async (templateId: string) => {
    try { await createProgramFromTemplate.mutateAsync(templateId); setSheet(null); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };
  const saveAssignment = async () => {
    if (!childId || !staffUserId) return;
    try { await assignStaff.mutateAsync({ userId: staffUserId, assignmentRole }); setStaffUserId(null); setSheet(null); }
    catch (error) { notify(t("children.assignmentFailed"), errorMessage(error), "danger"); }
  };
  const removeChildProgram = async (programId: string) => {
    try { await removeProgram.mutateAsync(programId); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };
  const removeAssignedStaff = async (assignmentId: string) => {
    try { await unassignStaff.mutateAsync(assignmentId); }
    catch (error) { notify(t("children.assignmentFailed"), errorMessage(error), "danger"); }
  };
  const saveGuardianBind = async () => {
    if (!guardianIdentifier.trim()) return notify(t("children.guardianIdentifierRequired"), undefined, "warning");
    try { await bindGuardian.mutateAsync(guardianIdentifier.trim()); setGuardianIdentifier(""); setSheet(null); }
    catch (error) { notify(t("children.guardianBindFailed"), errorMessage(error), "danger"); }
  };
  const removeGuardian = async (userId: string) => {
    try { await unbindGuardian.mutateAsync(userId); }
    catch (error) { notify(t("children.unbindGuardianFailed"), errorMessage(error), "danger"); }
  };
  const savePlacement = async () => {
    if (!classroomId) return;
    try {
      const placement = await placeChild.mutateAsync({ classroomId, startsOn: placementStart || undefined });
      closePlacementSheet();
      if (placement.ageGuidanceWarning) notify(t("learning.ageGuidance"), undefined, "warning");
    } catch (error) { notify(t("learning.saveFailed"), errorMessage(error), "danger"); }
  };
  const deactivate = () => {
    if (!childId) return;
    Alert.alert(t("children.deactivate"), t("children.deactivateDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("children.deactivate"), style: "destructive", onPress: () => void deactivateChild.mutateAsync().then(() => router.replace("/children")).catch((error: unknown) => notify(t("children.deactivateFailed"), errorMessage(error), "danger")) },
    ]);
  };

  return <AppScreen showBottomNavigation={false} title={t("children.detailTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {childProfile.isLoading ? <ShimmerList variant="tile" /> : childProfile.isError ? <ErrorState title={t("auth.profileLoadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void childProfile.refetch()} /> : childProfile.data && <View style={styles.hero}>
      <View style={styles.heroRow}>
        <Avatar name={childProfile.data.child.fullName} size="lg" />
        <View style={styles.grow}>
          <AppText variant="h4">{childProfile.data.child.fullName}</AppText>
          <AppText tone="muted">{childProfile.data.child.gender === "MALE" ? t("children.genderMale") : childProfile.data.child.gender === "FEMALE" ? t("children.genderFemale") : t("children.genderUnspecified")} · {childProfile.data.child.dateOfBirth}</AppText>
        </View>
      </View>
      {canManage && <View style={styles.options}><Button variant="secondary" leadingIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />} onPress={() => setSheet("edit")}>{t("children.edit")}</Button><Button variant="ghost" loading={deactivateChild.isPending} leadingIcon={<Ionicons name="archive-outline" size={18} color={colors.danger} />} onPress={deactivate}><AppText variant="label" tone="danger">{t("children.deactivate")}</AppText></Button></View>}
    </View>}
    {childId && childProfile.data && <>
      {membership?.active === false && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
      <MenuSection title={t("children.dailyRecords")}>
        <MenuItem icon="sparkles-outline" title={t("development.title")} description={t("staffOperations.developmentDescription")} onPress={() => router.push({ pathname: "/development", params: { childId } })} />
        {hasAcademicOffering && <MenuItem icon="flag-outline" title={t("goals.title")} description={t("goals.menuDescription")} onPress={() => router.push({ pathname: "/goals", params: { childId } })} />}
        <MenuItem icon="medkit-outline" title={t("health.title")} onPress={() => router.push({ pathname: "/child-health", params: { childId } })} />
        <MenuItem icon="bandage-outline" title={t("incident.title")} onPress={() => router.push({ pathname: "/incident-reports", params: { childId } })} />
        <MenuItem icon="chatbubbles-outline" title={t("childMessage.menuTitle")} onPress={() => router.push({ pathname: "/child-messages", params: { childId, organizationId } })} />
      </MenuSection>
      <MenuSection title={t("children.classAndCare")}>
        {canAccessLegacyClasses && <MenuItem icon="grid-outline" title={t("learning.placements")} description={placements.data?.length ? t("learning.placementsSummary", { count: placements.data.length }) : t("learning.noPlacements")} onPress={() => setPlacementsOpen(true)} />}
        {canManagePrograms && <MenuItem icon="heart-outline" title={t("children.programs")} description={childProfile.data.programs.length ? t("children.programsSummary", { count: childProfile.data.programs.length }) : t("children.noPrograms")} onPress={() => setProgramsOpen(true)} />}
        {canManage && <MenuItem icon="people-outline" title={t("children.staffAssignments")} description={childProfile.data.staffAssignments.length ? t("children.staffAssignmentsSummary", { count: childProfile.data.staffAssignments.length }) : t("children.noStaff")} onPress={() => setStaffListOpen(true)} />}
      </MenuSection>
      {canManage && <MenuSection title={t("children.safetySection")}>
        <MenuItem icon="person-add-outline" title={t("children.guardians")} description={childProfile.data.guardians.length ? t("children.guardiansSummary", { count: childProfile.data.guardians.length }) : t("children.noGuardians")} attention={childProfile.data.guardians.length === 0} onPress={() => setGuardiansOpen(true)} />
        {canManagePickup && <MenuItem icon="car-outline" title={t("pickup.title")} description={t("pickup.manage")} onPress={() => router.push({ pathname: "/pickup-authorizations", params: { childId } } as never)} />}
        <MenuItem icon="call-outline" title={t("emergencyContacts.title")} description={t("emergencyContacts.manage")} onPress={() => router.push({ pathname: "/emergency-contacts", params: { childId } } as never)} />
      </MenuSection>}
    </>}

    <BottomSheet visible={placementsOpen} onClose={() => setPlacementsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("learning.placements")}>
      {canPlaceChild && <Button variant="secondary" onPress={() => { setPlacementsOpen(false); setSheet("placement"); }}>{t("learning.placeChild")}</Button>}
      {placements.isFetching && <ShimmerList variant="row" />}
      {placements.isError && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("common.retry")} onRetry={() => void placements.refetch()} />}
      {!placements.isFetching && placements.data?.map((placement) => <View key={placement.id} style={styles.item}><View style={styles.itemContent}><View style={styles.row}><AppText variant="label" style={styles.grow}>{placement.learningLevelName ?? "–"} · {placement.classroomName}</AppText>{!placement.endedOn && <Badge tone="success" label={t("learning.active")} />}</View><AppText variant="bodySmall" tone="muted">{placement.startsOn}{placement.endedOn ? ` – ${placement.endedOn}` : ""}{academicYearName(placement.learningPeriodId) ? ` · ${academicYearName(placement.learningPeriodId)}` : ""}</AppText></View></View>)}
      {!placements.isFetching && placements.data?.length === 0 && <EmptyState compact icon="grid-outline" title={t("learning.noPlacements")} />}
    </BottomSheet>

    <BottomSheet visible={programsOpen} onClose={() => setProgramsOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.programs")}>
      <View style={styles.options}>
        <Button variant="secondary" onPress={() => { setProgramsOpen(false); setSheet("program"); }}>{t("children.addProgram")}</Button>
        {canManage && <Button variant="secondary" onPress={() => { setProgramsOpen(false); router.push("/child-program-templates"); }}>{t("children.manageTemplates")}</Button>}
      </View>
      {childProfile.isFetching && <ShimmerList variant="row" />}
      {!childProfile.isFetching && childProfile.data?.programs.map((program) => <View key={program.id} style={styles.item}><View style={styles.itemContent}><View style={styles.row}><AppText variant="label" style={styles.grow}>{program.name}</AppText><Badge tone={statusTone(program.status)} label={t(`children.programStatus.${program.status}`)} /></View><AppText variant="bodySmall" tone="muted">{program.steps.length} {t("children.steps")}</AppText>{program.description && <AppText variant="bodySmall" tone="muted">{program.description}</AppText>}</View><View style={styles.actions}><Button variant="secondary" onPress={() => { setProgramsOpen(false); router.push({ pathname: "/child-program-detail", params: { childId: childId!, programId: program.id } }); }}>{t("children.programManage")}</Button>{program.steps.length === 0 && program.staffNotes.length === 0 && program.parentFeedback.length === 0 && <Button variant="danger" loading={removeProgram.isPending} onPress={() => void removeChildProgram(program.id)}>{t("children.remove")}</Button>}</View></View>)}
      {!childProfile.isFetching && childProfile.data?.programs.length === 0 && <EmptyState compact icon="heart-outline" title={t("children.noPrograms")} />}
    </BottomSheet>

    <BottomSheet visible={staffListOpen} onClose={() => setStaffListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.staffAssignments")}>
      <Button variant="secondary" onPress={() => { setStaffListOpen(false); setSheet("staff"); }}>{t("children.assign")}</Button>
      {childProfile.isFetching && <ShimmerList variant="row" />}
      {childProfile.isError && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("common.retry")} onRetry={() => void childProfile.refetch()} />}
      {!childProfile.isFetching && childProfile.data?.staffAssignments.map((assignment) => <View key={assignment.id} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{assignment.displayName}</AppText><AppText variant="bodySmall" tone="muted">{assignmentRoleLabel(assignment.assignmentRole)} · {assignment.email}</AppText></View><Button variant="danger" loading={unassignStaff.isPending} onPress={() => void removeAssignedStaff(assignment.id)}>{t("children.unassign")}</Button></View>)}
      {!childProfile.isFetching && childProfile.data?.staffAssignments.length === 0 && <EmptyState compact icon="people-outline" title={t("children.noStaff")} />}
    </BottomSheet>

    <BottomSheet visible={guardiansOpen} onClose={() => setGuardiansOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.guardians")}>
      <Button variant="secondary" onPress={() => { setGuardiansOpen(false); setSheet("guardian"); }}>{t("children.bindGuardian")}</Button>
      {childProfile.isFetching && <ShimmerList variant="row" />}
      {childProfile.isError && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("common.retry")} onRetry={() => void childProfile.refetch()} />}
      {!childProfile.isFetching && childProfile.data?.guardians.map((guardian) => <View key={guardian.userId} style={styles.item}><View style={styles.itemContent}><AppText variant="label">{guardian.displayName}</AppText><AppText variant="bodySmall" tone="muted">{guardian.email ?? guardian.username}</AppText>{!guardian.validParentAccount && <Badge tone="danger" icon="alert-circle" label={t("children.guardianInvalid")} />}</View><Button variant="danger" loading={unbindGuardian.isPending} onPress={() => void removeGuardian(guardian.userId)}>{t("children.unbindGuardian")}</Button></View>)}
      {!childProfile.isFetching && childProfile.data?.guardians.length === 0 && <EmptyState compact icon="person-add-outline" title={t("children.noGuardians")} />}
    </BottomSheet>
    <BottomSheet visible={sheet === "guardian"} onClose={() => { setSheet(null); setGuardianIdentifier(""); }} closeAccessibilityLabel={t("common.close")} title={t("children.bindGuardian")} negativeAction={{ label: t("common.cancel"), onPress: () => { setSheet(null); setGuardianIdentifier(""); } }} positiveAction={{ label: t("children.bindGuardian"), loading: bindGuardian.isPending, disabled: !guardianIdentifier.trim(), onPress: () => void saveGuardianBind() }}>
      <TextField label={t("children.guardianIdentifier")} required leadingIcon="person-add-outline" hint={t("children.guardianIdentifierInfo")} autoCapitalize="none" value={guardianIdentifier} onChangeText={setGuardianIdentifier} />
    </BottomSheet>
    <BottomSheet visible={sheet === "edit"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.save"), loading: updateChild.isPending, onPress: () => void saveChild() }}>
      <TextField label={t("children.firstName")} required autoCapitalize="words" value={firstName} onChangeText={(value) => setFirstName(capitalizeWords(value))} />
      <TextField label={t("children.lastName")} autoCapitalize="words" value={lastName} onChangeText={(value) => setLastName(capitalizeWords(value))} />
      <TextField label={t("children.nisn")} inputMode="numeric" value={nisn} onChangeText={setNisn} />
      <GenderPicker value={gender} onChange={setGender} />
      <View style={styles.field}><AppText variant="label">{t("children.birthDate")} <AppText variant="label" tone="danger">*</AppText></AppText><DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} /></View>
    </BottomSheet>
    <BottomSheet visible={sheet === "placement"} onClose={closePlacementSheet} closeAccessibilityLabel={t("common.close")} title={t("learning.placeChild")} negativeAction={{ label: t("common.cancel"), onPress: closePlacementSheet }} positiveAction={{ label: t("learning.placeChild"), loading: placeChild.isPending, disabled: !classroomId, onPress: () => void savePlacement() }}>
      <Banner tone="info" title={currentPlacement ? t("learning.currentPlacementContext", { level: currentPlacement.learningLevelName ?? "–", classroom: currentPlacement.classroomName }) : t("learning.noCurrentPlacement")} />
      <AppText variant="label">{t("learning.selectClassroom")}</AppText>
      {placementOptions.isFetching && <ShimmerList variant="row" />}
      {placementOptions.isError && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("common.retry")} onRetry={() => void placementOptions.refetch()} />}
      {!placementOptions.isFetching && !placementOptions.isError && <ChipGroup accessibilityLabel={t("learning.selectClassroom")}>{placementOptions.data?.map((classroom) => <Chip key={classroom.id} label={classroom.name} selected={classroomId === classroom.id} onPress={() => setClassroomId(classroom.id)} />)}</ChipGroup>}
      {!placementOptions.isFetching && !placementOptions.isError && placementOptions.data?.length === 0 && <AppText tone="muted">{t("learning.noPlacementOptions")}</AppText>}
      <View style={styles.field}><AppText variant="label">{t("learning.startDate")}</AppText><DatePicker placeholder={t("learning.startDate")} value={placementStart} onChange={setPlacementStart} onClear={() => setPlacementStart("")} clearAccessibilityLabel={t("common.clear")} /></View>
      {currentPlacement && <Banner tone="warning" title={t("learning.placeChildWarning")} />}
    </BottomSheet>
    <BottomSheet visible={sheet === "program"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.addProgram")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.addProgram"), loading: addProgram.isPending, disabled: !programName.trim(), onPress: () => void saveProgram() }}>
      {Boolean(programTemplates.data?.length) && <View style={styles.itemContent}>
        <AppText variant="label">{t("children.useTemplate")}</AppText>
        <View style={styles.options}>{programTemplates.data?.map((template) => <Button key={template.id} variant="secondary" loading={createProgramFromTemplate.isPending} onPress={() => void applyProgramTemplate(template.id)}>{template.name}</Button>)}</View>
      </View>}
      <AppText variant="label">{t("children.orManualEntry")}</AppText>
      <TextField label={t("children.programName")} required value={programName} onChangeText={setProgramName} />
      <TextField label={t("children.programDescription")} multiline value={programDescription} onChangeText={setProgramDescription} />
    </BottomSheet>
    <BottomSheet visible={sheet === "staff"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("children.assign")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("children.assign"), loading: assignStaff.isPending, disabled: !staffUserId, onPress: () => void saveAssignment() }}>
      <AppText variant="caption" tone="muted">{t("children.assignmentGrantsScope")}</AppText>
      {staff.isFetching && <ShimmerList variant="row" />}
      {staff.isError && <ErrorState compact title={t("common.loadFailed")} retryLabel={t("common.retry")} onRetry={() => void staff.refetch()} />}
      <AppText variant="label">{t("children.selectStaff")}</AppText>
      <ChipGroup accessibilityLabel={t("children.selectStaff")}>{assignableStaff.map((user) => <Chip key={user.id} label={user.displayName ?? user.email ?? t("children.selectStaff")} selected={staffUserId === user.userId} onPress={() => setStaffUserId(user.userId)} />)}</ChipGroup>
      <AppText variant="label">{t("children.assignmentRole")}</AppText>
      <ChipGroup accessibilityLabel={t("children.assignmentRole")}>{assignmentRoles.map((role) => <Chip key={role} label={assignmentRoleLabel(role)} selected={assignmentRole === role} onPress={() => setAssignmentRole(role)} />)}</ChipGroup>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  field: { gap: spacing.xs },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  itemContent: { flex: 1, gap: spacing.xs },
  actions: { gap: spacing.xs, alignItems: "flex-end" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
