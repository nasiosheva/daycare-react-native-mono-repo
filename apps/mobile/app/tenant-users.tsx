import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, Avatar, BackButton, Badge, Banner, BottomSheet, Button, Chip, FloatingActionButton, PasswordInput, ShimmerList, TextField, ToggleSwitch, colors, radius, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { notify } from "@/notify/notify";
import type { Role } from "@daycare/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";
import { capitalizeWords } from "@/text/capitalizeWords";
import type { TenantUser } from "@daycare/api-client";

const staffRoles: Extract<Role, "STAFF_ADMIN" | "STAFF">[] = ["STAFF_ADMIN", "STAFF"];

export default function TenantUsersScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active !== false;
  const queryClient = useQueryClient();
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const [draftFilterBranchId, setDraftFilterBranchId] = useState<string>();
  const [branchFilterVisible, setBranchFilterVisible] = useState(false);
  const tenantUsers = useQuery({ queryKey: ["tenant-users", organizationId, filterBranchId], queryFn: () => api.tenantUsers({ branchId: filterBranchId }), enabled: membership?.role === "STAFF_ADMIN" });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const createTenantUser = useMutation({ mutationFn: api.createTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const updateTenantUser = useMutation({ mutationFn: ({ userId, input }: { userId: string; input: Parameters<typeof api.updateTenantUser>[1] }) => api.updateTenantUser(userId, input), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const inviteParent = useMutation({ mutationFn: api.inviteTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const deactivateTenantUser = useMutation({ mutationFn: api.deactivateTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState<Extract<Role, "STAFF_ADMIN" | "STAFF">>("STAFF");
  const [staffBranchId, setStaffBranchId] = useState<string>();
  const [canManageChildPrograms, setCanManageChildPrograms] = useState(false);
  const [canManageDevelopmentCategories, setCanManageDevelopmentCategories] = useState(false);
  const [parentEmail, setParentEmail] = useState("");
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [parentInvitationError, setParentInvitationError] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<{ userId: string; message: string } | null>(null);
  const [editingStaff, setEditingStaff] = useState<TenantUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBranchId, setEditBranchId] = useState<string>();
  const [editCanManageChildPrograms, setEditCanManageChildPrograms] = useState(false);
  const [editCanManageDevelopmentCategories, setEditCanManageDevelopmentCategories] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"staff" | "parent" | "edit" | null>(null);
  const activeBranches = branches.data?.filter((branch) => branch.active) ?? [];
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const errorMessage = (error: unknown) => error instanceof Error ? error.message : t("auth.tryAgain");
  const submitStaffAccount = async () => {
    if (!displayName.trim() || !staffEmail.trim() || password.length < 6) return setStaffFormError(t("tenantUsers.staffAccountRequired"));
    if (staffRole === "STAFF" && !staffBranchId) return setStaffFormError(t("tenantUsers.branchRequired"));
    setStaffFormError(null);
    try {
      await createTenantUser.mutateAsync({ displayName: displayName.trim(), email: staffEmail.trim(), password, role: staffRole, username: username.trim() || undefined, branchId: staffRole === "STAFF" ? staffBranchId : undefined, canManageChildPrograms: staffRole === "STAFF" && canManageChildPrograms, canManageDevelopmentCategories: staffRole === "STAFF" && canManageDevelopmentCategories });
      setDisplayName("");
      setUsername("");
      setStaffEmail("");
      setPassword("");
      setStaffRole("STAFF");
      setStaffBranchId(undefined);
      setCanManageChildPrograms(false);
      setCanManageDevelopmentCategories(false);
      setSheet(null);
      notify(t("tenantUsers.staffAccountCreated"), t("tenantUsers.staffAccountCreatedDescription"), "success");
    } catch (error) { setStaffFormError(errorMessage(error)); }
  };
  const submitParentInvitation = async () => {
    if (!parentEmail.trim()) return setParentInvitationError(t("tenantUsers.emailRequired"));
    setParentInvitationError(null);
    try {
      await inviteParent.mutateAsync({ email: parentEmail.trim(), role: "PARENT" });
      setParentEmail("");
      setSheet(null);
      notify(t("tenantUsers.invited"), t("tenantUsers.invitedDescription"));
    } catch (error) { setParentInvitationError(errorMessage(error)); }
  };
  const deactivate = async (userId: string) => {
    setAccountActionError(null);
    try { await deactivateTenantUser.mutateAsync(userId); }
    catch (error) { setAccountActionError({ userId, message: errorMessage(error) }); }
  };
  const openEditStaff = (staff: TenantUser) => {
    if (!staff.userId) return;
    setEditingStaff(staff);
    setEditDisplayName(staff.displayName ?? "");
    setEditUsername(staff.username ?? "");
    setEditEmail(staff.email ?? "");
    setEditBranchId(staff.branchId ?? undefined);
    setEditCanManageChildPrograms(staff.canManageChildPrograms);
    setEditCanManageDevelopmentCategories(staff.canManageDevelopmentCategories);
    setEditFormError(null);
    setSheet("edit");
  };
  const closeEditStaff = () => {
    setSheet(null);
    setEditingStaff(null);
    setEditFormError(null);
  };
  const openBranchFilter = () => {
    setDraftFilterBranchId(filterBranchId);
    setBranchFilterVisible(true);
  };
  const applyBranchFilter = () => {
    setFilterBranchId(draftFilterBranchId);
    setBranchFilterVisible(false);
  };
  const submitStaffEdit = async () => {
    if (!editingStaff?.userId) return;
    if (!editDisplayName.trim() || !editEmail.trim() || !editBranchId) return setEditFormError(t("tenantUsers.staffAccountUpdateRequired"));
    setEditFormError(null);
    try {
      await updateTenantUser.mutateAsync({
        userId: editingStaff.userId,
        input: {
          displayName: editDisplayName.trim(),
          email: editEmail.trim(),
          username: editUsername.trim(),
          branchId: editBranchId,
          canManageChildPrograms: editCanManageChildPrograms,
          canManageDevelopmentCategories: editCanManageDevelopmentCategories,
        },
      });
      closeEditStaff();
      notify(t("tenantUsers.staffAccountUpdated"), t("tenantUsers.staffAccountUpdatedDescription"), "success");
    } catch (error) { setEditFormError(errorMessage(error)); }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenantUsers.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("tenantUsers.createStaffAccount")} onPress={() => setSheet("staff")}>{t("tenantUsers.createStaffAccount")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("tenantUsers.subtitle")}</AppText>
    {membership?.active === false && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    {canManage && <Button variant="secondary" onPress={() => router.push("/staff-passwords")}>{t("tenantUsers.managePasswords")}</Button>}
    {canManage && <Button variant="secondary" onPress={() => setSheet("parent")}>{t("tenantUsers.parentInvitation")}</Button>}
    <Button variant="secondary" onPress={openBranchFilter}>{t(filterBranchId ? "branchFilter.active" : "branchFilter.title")}</Button>
    <AppText variant="heading">{t("tenantUsers.accounts")}</AppText>
    {tenantUsers.isFetching && <ShimmerList variant="row" />}
    {tenantUsers.isError && <View style={styles.feedback}><Banner tone="danger" title={t("common.error")} /><Button variant="secondary" onPress={() => tenantUsers.refetch()}>{t("common.retry")}</Button></View>}
    {!tenantUsers.isFetching && tenantUsers.data?.map((item) => <View key={item.id} style={styles.user}>
      <View style={styles.userHeader}>
        <Avatar name={item.displayName ?? item.email ?? "?"} />
        <View style={styles.grow}>
          <AppText variant="h6">{item.displayName ?? item.email ?? t("common.noData")}</AppText>
          <AppText variant="bodySmall" tone="muted">{t(roleKey(item.role))}{item.role === "STAFF" ? ` · ${branches.data?.find((branch) => branch.id === item.branchId)?.name ?? t("tenantUsers.noBranch")}` : ""}</AppText>
          {item.username && <AppText variant="caption" tone="muted">{t("tenantUsers.usernameValue", { username: item.username })}</AppText>}
        </View>
        <Badge tone={statusTone(item.status)} label={t(`status.${item.status}` as Parameters<typeof t>[0])} />
      </View>
      {item.role === "STAFF" && <View style={styles.options}>
        <Badge tone={item.canManageChildPrograms ? "success" : "neutral"} icon={item.canManageChildPrograms ? "checkmark" : "close"} label={item.canManageChildPrograms ? t("tenantUsers.programPermissionEnabled") : t("tenantUsers.programPermissionDisabled")} />
        <Badge tone={item.canManageDevelopmentCategories ? "success" : "neutral"} icon={item.canManageDevelopmentCategories ? "checkmark" : "close"} label={item.canManageDevelopmentCategories ? t("tenantUsers.developmentCategoryPermissionEnabled") : t("tenantUsers.developmentCategoryPermissionDisabled")} />
      </View>}
      {accountActionError?.userId === item.userId && <Banner tone="danger" title={accountActionError.message} />}
      {canManage && item.status === "ACTIVE" && item.userId && (item.role === "STAFF_ADMIN" || item.role === "STAFF") && <View style={styles.options}>
        {item.role === "STAFF" && <Button variant="secondary" onPress={() => openEditStaff(item)}>{t("tenantUsers.editStaffAccount")}</Button>}
        <Button variant="ghost" loading={deactivateTenantUser.isPending} onPress={() => void deactivate(item.userId!)}><AppText variant="label" tone="danger">{t("tenantUsers.deactivate")}</AppText></Button>
      </View>}
    </View>)}
    <BottomSheet visible={branchFilterVisible} onClose={() => setBranchFilterVisible(false)} closeAccessibilityLabel={t("common.close")} title={t("branchFilter.title")} negativeAction={{ label: t("common.cancel"), onPress: () => setBranchFilterVisible(false) }} positiveAction={{ label: t("common.ok"), onPress: applyBranchFilter }}>
      <AppText variant="label">{t("branchFilter.branch")}</AppText>
      <View style={styles.options}>
        <Chip label={t("branchFilter.allBranches")} selected={!draftFilterBranchId} onPress={() => setDraftFilterBranchId(undefined)} />
        {branches.data?.map((branch) => <Chip key={branch.id} label={branch.name} selected={draftFilterBranchId === branch.id} onPress={() => setDraftFilterBranchId(branch.id)} />)}
      </View>
    </BottomSheet>
    <BottomSheet visible={sheet === "staff"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.createStaffAccount")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenantUsers.createStaffAccount"), disabled: staffRole === "STAFF" && activeBranches.length === 0, loading: createTenantUser.isPending, onPress: () => void submitStaffAccount() }}>
      {staffFormError && <Banner tone="danger" title={staffFormError} />}
      <TextField label={t("tenantUsers.displayName")} autoCapitalize="words" value={displayName} onChangeText={(value) => { setDisplayName(capitalizeWords(value)); setStaffFormError(null); }} />
      <TextField label={t("tenantUsers.username")} autoCapitalize="none" value={username} onChangeText={(value) => { setUsername(value); setStaffFormError(null); }} />
      <TextField label={t("tenantUsers.email")} autoCapitalize="none" keyboardType="email-address" value={staffEmail} onChangeText={(value) => { setStaffEmail(value); setStaffFormError(null); }} />
      <PasswordInput placeholder={t("tenantUsers.password")} value={password} onChangeText={(value) => { setPassword(value); setStaffFormError(null); }} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <View style={styles.options}>{staffRoles.map((item) => <Chip key={item} label={t(roleKey(item))} selected={item === staffRole} onPress={() => { setStaffRole(item); setStaffFormError(null); }} />)}</View>
      {staffRole === "STAFF" && <><AppText variant="label">{t("tenantUsers.branch")}</AppText>{activeBranches.length === 0 ? <Banner tone="danger" title={t("tenantUsers.branchRequired")} /> : <View style={styles.options}>{activeBranches.map((branch) => <Chip key={branch.id} label={branch.name} selected={branch.id === staffBranchId} onPress={() => { setStaffBranchId(branch.id); setStaffFormError(null); }} />)}</View>}<ToggleSwitch label={t("tenantUsers.programPermission")} description={t("tenantUsers.programPermissionDescription")} value={canManageChildPrograms} onValueChange={setCanManageChildPrograms} accessibilityLabel={t("tenantUsers.programPermission")} /><ToggleSwitch label={t("tenantUsers.developmentCategoryPermission")} description={t("tenantUsers.developmentCategoryPermissionDescription")} value={canManageDevelopmentCategories} onValueChange={setCanManageDevelopmentCategories} accessibilityLabel={t("tenantUsers.developmentCategoryPermission")} /></>}
    </BottomSheet>
    <BottomSheet visible={sheet === "edit"} onClose={closeEditStaff} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.editStaffAccount")} negativeAction={{ label: t("common.cancel"), onPress: closeEditStaff }} positiveAction={{ label: t("tenantUsers.saveStaffAccount"), loading: updateTenantUser.isPending, onPress: () => void submitStaffEdit() }}>
      {editFormError && <Banner tone="danger" title={editFormError} />}
      <TextField label={t("tenantUsers.displayName")} value={editDisplayName} onChangeText={(value) => { setEditDisplayName(value); setEditFormError(null); }} />
      <TextField label={t("tenantUsers.username")} autoCapitalize="none" value={editUsername} onChangeText={(value) => { setEditUsername(value); setEditFormError(null); }} />
      <TextField label={t("tenantUsers.email")} autoCapitalize="none" keyboardType="email-address" value={editEmail} onChangeText={(value) => { setEditEmail(value); setEditFormError(null); }} />
      <AppText variant="label">{t("tenantUsers.branch")}</AppText>
      <View style={styles.options}>{branches.data?.filter((branch) => branch.active).map((branch) => <Chip key={branch.id} label={branch.name} selected={branch.id === editBranchId} onPress={() => { setEditBranchId(branch.id); setEditFormError(null); }} />)}</View>
      <ToggleSwitch label={t("tenantUsers.programPermission")} description={t("tenantUsers.programPermissionDescription")} value={editCanManageChildPrograms} onValueChange={setEditCanManageChildPrograms} accessibilityLabel={t("tenantUsers.programPermission")} />
      <ToggleSwitch label={t("tenantUsers.developmentCategoryPermission")} description={t("tenantUsers.developmentCategoryPermissionDescription")} value={editCanManageDevelopmentCategories} onValueChange={setEditCanManageDevelopmentCategories} accessibilityLabel={t("tenantUsers.developmentCategoryPermission")} />
    </BottomSheet>
    <BottomSheet visible={sheet === "parent"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.parentInvitation")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenantUsers.invite"), loading: inviteParent.isPending, onPress: () => void submitParentInvitation() }}>
      {parentInvitationError && <Banner tone="danger" title={parentInvitationError} />}
      <TextField label={t("tenantUsers.email")} autoCapitalize="none" keyboardType="email-address" value={parentEmail} onChangeText={(value) => { setParentEmail(value); setParentInvitationError(null); }} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  userHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1, gap: 2 },
  form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  feedback: { gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  user: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
