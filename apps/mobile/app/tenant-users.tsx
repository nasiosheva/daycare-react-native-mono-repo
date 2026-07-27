import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, ToggleSwitch, colors, PasswordInput, radius, spacing } from "@daycare/ui";
import type { Role } from "@daycare/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";
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
      setStaffBranchId(undefined);
      setCanManageChildPrograms(false);
      setCanManageDevelopmentCategories(false);
      setSheet(null);
      Alert.alert(t("tenantUsers.staffAccountCreated"), t("tenantUsers.staffAccountCreatedDescription"));
    } catch (error) { setStaffFormError(errorMessage(error)); }
  };
  const submitParentInvitation = async () => {
    if (!parentEmail.trim()) return setParentInvitationError(t("tenantUsers.emailRequired"));
    setParentInvitationError(null);
    try {
      await inviteParent.mutateAsync({ email: parentEmail.trim(), role: "PARENT" });
      setParentEmail("");
      setSheet(null);
      Alert.alert(t("tenantUsers.invited"), t("tenantUsers.invitedDescription"));
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
      Alert.alert(t("tenantUsers.staffAccountUpdated"), t("tenantUsers.staffAccountUpdatedDescription"));
    } catch (error) { setEditFormError(errorMessage(error)); }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenantUsers.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton accessibilityLabel={t("tenantUsers.createStaffAccount")} onPress={() => setSheet("staff")}>+ {t("tenantUsers.createStaffAccount")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("tenantUsers.subtitle")}</AppText>
    {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {canManage && <Button variant="secondary" onPress={() => router.push("/staff-passwords")}>{t("tenantUsers.managePasswords")}</Button>}
    {canManage && <Button variant="secondary" onPress={() => setSheet("parent")}>{t("tenantUsers.parentInvitation")}</Button>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <BranchTab label={t("branchFilter.allBranches")} selected={!filterBranchId} onPress={() => setFilterBranchId(undefined)} />
      {branches.data?.map((branch) => <BranchTab key={branch.id} label={branch.name} selected={filterBranchId === branch.id} onPress={() => setFilterBranchId(branch.id)} />)}
    </ScrollView>
    <AppText variant="heading">{t("tenantUsers.accounts")}</AppText>
    {tenantUsers.isFetching && <ShimmerList variant="row" />}
    {tenantUsers.isError && <View style={styles.feedback}><AppText accessibilityRole="alert" tone="danger">{t("common.error")}</AppText><Button variant="secondary" onPress={() => tenantUsers.refetch()}>{t("common.retry")}</Button></View>}
    {!tenantUsers.isFetching && tenantUsers.data?.map((item) => <View key={item.id} style={styles.user}>
      <AppText variant="label">{item.displayName ?? item.email ?? t("common.noData")}</AppText>
      {item.username && <AppText tone="muted">{t("tenantUsers.usernameValue", { username: item.username })}</AppText>}
      <AppText tone="muted">{t(roleKey(item.role))} · {t(`status.${item.status}` as Parameters<typeof t>[0])}{item.role === "STAFF" ? ` · ${branches.data?.find((branch) => branch.id === item.branchId)?.name ?? t("tenantUsers.noBranch")}` : ""}</AppText>
      {item.role === "STAFF" && <AppText tone="muted">{item.canManageChildPrograms ? t("tenantUsers.programPermissionEnabled") : t("tenantUsers.programPermissionDisabled")}</AppText>}
      {item.role === "STAFF" && <AppText tone="muted">{item.canManageDevelopmentCategories ? t("tenantUsers.developmentCategoryPermissionEnabled") : t("tenantUsers.developmentCategoryPermissionDisabled")}</AppText>}
      {accountActionError?.userId === item.userId && <AppText accessibilityRole="alert" tone="danger">{accountActionError.message}</AppText>}
      {canManage && item.status === "ACTIVE" && item.userId && (item.role === "STAFF_ADMIN" || item.role === "STAFF") && <View style={styles.options}>
        {item.role === "STAFF" && <Button variant="secondary" onPress={() => openEditStaff(item)}>{t("tenantUsers.editStaffAccount")}</Button>}
        <Button variant="danger" loading={deactivateTenantUser.isPending} onPress={() => void deactivate(item.userId!)}>{t("tenantUsers.deactivate")}</Button>
      </View>}
    </View>)}
    <BottomSheet visible={sheet === "staff"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.createStaffAccount")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenantUsers.createStaffAccount"), loading: createTenantUser.isPending, onPress: () => void submitStaffAccount() }}>
      {staffFormError && <AppText accessibilityRole="alert" tone="danger">{staffFormError}</AppText>}
      <TextInput style={styles.input} placeholder={t("tenantUsers.displayName")} value={displayName} onChangeText={(value) => { setDisplayName(value); setStaffFormError(null); }} />
      <TextInput style={styles.input} autoCapitalize="none" placeholder={t("tenantUsers.username")} value={username} onChangeText={(value) => { setUsername(value); setStaffFormError(null); }} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={staffEmail} onChangeText={(value) => { setStaffEmail(value); setStaffFormError(null); }} />
      <PasswordInput placeholder={t("tenantUsers.password")} value={password} onChangeText={(value) => { setPassword(value); setStaffFormError(null); }} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <View style={styles.options}>{staffRoles.map((item) => <Button key={item} variant={item === staffRole ? "primary" : "secondary"} onPress={() => { setStaffRole(item); setStaffFormError(null); }}>{t(roleKey(item))}</Button>)}</View>
      {staffRole === "STAFF" && <><AppText variant="label">{t("tenantUsers.branch")}</AppText><View style={styles.options}>{branches.data?.filter((branch) => branch.active).map((branch) => <Button key={branch.id} variant={branch.id === staffBranchId ? "primary" : "secondary"} onPress={() => { setStaffBranchId(branch.id); setStaffFormError(null); }}>{branch.name}</Button>)}</View><ToggleSwitch label={t("tenantUsers.programPermission")} description={t("tenantUsers.programPermissionDescription")} value={canManageChildPrograms} onValueChange={setCanManageChildPrograms} accessibilityLabel={t("tenantUsers.programPermission")} /><ToggleSwitch label={t("tenantUsers.developmentCategoryPermission")} description={t("tenantUsers.developmentCategoryPermissionDescription")} value={canManageDevelopmentCategories} onValueChange={setCanManageDevelopmentCategories} accessibilityLabel={t("tenantUsers.developmentCategoryPermission")} /></>}
    </BottomSheet>
    <BottomSheet visible={sheet === "edit"} onClose={closeEditStaff} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.editStaffAccount")} negativeAction={{ label: t("common.cancel"), onPress: closeEditStaff }} positiveAction={{ label: t("tenantUsers.saveStaffAccount"), loading: updateTenantUser.isPending, onPress: () => void submitStaffEdit() }}>
      {editFormError && <AppText accessibilityRole="alert" tone="danger">{editFormError}</AppText>}
      <TextInput style={styles.input} placeholder={t("tenantUsers.displayName")} value={editDisplayName} onChangeText={(value) => { setEditDisplayName(value); setEditFormError(null); }} />
      <TextInput style={styles.input} autoCapitalize="none" placeholder={t("tenantUsers.username")} value={editUsername} onChangeText={(value) => { setEditUsername(value); setEditFormError(null); }} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={editEmail} onChangeText={(value) => { setEditEmail(value); setEditFormError(null); }} />
      <AppText variant="label">{t("tenantUsers.branch")}</AppText>
      <View style={styles.options}>{branches.data?.filter((branch) => branch.active).map((branch) => <Button key={branch.id} variant={branch.id === editBranchId ? "primary" : "secondary"} onPress={() => { setEditBranchId(branch.id); setEditFormError(null); }}>{branch.name}</Button>)}</View>
      <ToggleSwitch label={t("tenantUsers.programPermission")} description={t("tenantUsers.programPermissionDescription")} value={editCanManageChildPrograms} onValueChange={setEditCanManageChildPrograms} accessibilityLabel={t("tenantUsers.programPermission")} />
      <ToggleSwitch label={t("tenantUsers.developmentCategoryPermission")} description={t("tenantUsers.developmentCategoryPermissionDescription")} value={editCanManageDevelopmentCategories} onValueChange={setEditCanManageDevelopmentCategories} accessibilityLabel={t("tenantUsers.developmentCategoryPermission")} />
    </BottomSheet>
    <BottomSheet visible={sheet === "parent"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.parentInvitation")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenantUsers.invite"), loading: inviteParent.isPending, onPress: () => void submitParentInvitation() }}>
      {parentInvitationError && <AppText accessibilityRole="alert" tone="danger">{parentInvitationError}</AppText>}
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={parentEmail} onChangeText={(value) => { setParentEmail(value); setParentInvitationError(null); }} />
    </BottomSheet>
  </AppScreen>;
}

function BranchTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  feedback: { gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  user: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
});
