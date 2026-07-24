import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, colors, PasswordInput, radius, spacing } from "@daycare/ui";
import type { Role } from "@daycare/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";
import { BranchFilterControl } from "@/branches/BranchFilterSheet";

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
  const updateTenantUserChildProgramPermission = useMutation({ mutationFn: ({ userId, canManageChildPrograms }: { userId: string; canManageChildPrograms: boolean }) => api.updateTenantUserChildProgramPermission(userId, canManageChildPrograms), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const updateTenantUserDevelopmentCategoryPermission = useMutation({ mutationFn: ({ userId, canManageDevelopmentCategories }: { userId: string; canManageDevelopmentCategories: boolean }) => api.updateTenantUserDevelopmentCategoryPermission(userId, canManageDevelopmentCategories), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const inviteParent = useMutation({ mutationFn: api.inviteTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const deactivateTenantUser = useMutation({ mutationFn: api.deactivateTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const [displayName, setDisplayName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState<Extract<Role, "STAFF_ADMIN" | "STAFF">>("STAFF");
  const [staffBranchId, setStaffBranchId] = useState<string>();
  const [canManageChildPrograms, setCanManageChildPrograms] = useState(false);
  const [canManageDevelopmentCategories, setCanManageDevelopmentCategories] = useState(false);
  const [parentEmail, setParentEmail] = useState("");
  const [sheet, setSheet] = useState<"staff" | "parent" | null>(null);
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const submitStaffAccount = async () => {
    if (!displayName.trim() || !staffEmail.trim() || password.length < 6) return Alert.alert(t("tenantUsers.staffAccountRequired"));
    if (staffRole === "STAFF" && !staffBranchId) return Alert.alert(t("tenantUsers.branchRequired"));
    try {
      await createTenantUser.mutateAsync({ displayName: displayName.trim(), email: staffEmail.trim(), password, role: staffRole, branchId: staffRole === "STAFF" ? staffBranchId : undefined, canManageChildPrograms: staffRole === "STAFF" && canManageChildPrograms, canManageDevelopmentCategories: staffRole === "STAFF" && canManageDevelopmentCategories });
      setDisplayName("");
      setStaffEmail("");
      setPassword("");
      setStaffBranchId(undefined);
      setCanManageChildPrograms(false);
      setCanManageDevelopmentCategories(false);
      setSheet(null);
      Alert.alert(t("tenantUsers.staffAccountCreated"), t("tenantUsers.staffAccountCreatedDescription"));
    } catch (error) { Alert.alert(t("tenantUsers.staffAccountCreateFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const submitParentInvitation = async () => {
    if (!parentEmail.trim()) return Alert.alert(t("tenantUsers.emailRequired"));
    try {
      await inviteParent.mutateAsync({ email: parentEmail.trim(), role: "PARENT" });
      setParentEmail("");
      setSheet(null);
      Alert.alert(t("tenantUsers.invited"), t("tenantUsers.invitedDescription"));
    } catch (error) { Alert.alert(t("tenantUsers.inviteFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const deactivate = async (userId: string) => {
    try { await deactivateTenantUser.mutateAsync(userId); }
    catch (error) { Alert.alert(t("tenantUsers.deactivateFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const updateProgramPermission = async (userId: string, nextValue: boolean) => {
    try { await updateTenantUserChildProgramPermission.mutateAsync({ userId, canManageChildPrograms: nextValue }); }
    catch (error) { Alert.alert(t("tenantUsers.programPermissionFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const updateDevelopmentCategoryPermission = async (userId: string, nextValue: boolean) => {
    try { await updateTenantUserDevelopmentCategoryPermission.mutateAsync({ userId, canManageDevelopmentCategories: nextValue }); }
    catch (error) { Alert.alert(t("tenantUsers.developmentCategoryPermissionFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenantUsers.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("tenantUsers.subtitle")}</AppText>
    {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {canManage && <Button variant="secondary" onPress={() => router.push("/staff-passwords")}>{t("tenantUsers.managePasswords")}</Button>}
    {canManage && <View style={styles.options}>
      <Button onPress={() => setSheet("staff")}>{t("tenantUsers.createStaffAccount")}</Button>
      <Button variant="secondary" onPress={() => setSheet("parent")}>{t("tenantUsers.parentInvitation")}</Button>
    </View>}
    <BranchFilterControl branchId={filterBranchId} onChange={setFilterBranchId} />
    <AppText variant="heading">{t("tenantUsers.accounts")}</AppText>
    {tenantUsers.isLoading && <AppText>{t("tenantUsers.loading")}</AppText>}
    {tenantUsers.isError && <Button variant="secondary" onPress={() => tenantUsers.refetch()}>{t("common.retry")}</Button>}
    {tenantUsers.data?.map((item) => <View key={item.id} style={styles.user}>
      <AppText variant="label">{item.displayName ?? item.email ?? t("common.noData")}</AppText>
      <AppText tone="muted">{t(roleKey(item.role))} · {t(`status.${item.status}` as Parameters<typeof t>[0])}{item.role === "STAFF" ? ` · ${branches.data?.find((branch) => branch.id === item.branchId)?.name ?? t("tenantUsers.noBranch")}` : ""}</AppText>
      {item.role === "STAFF" && <AppText tone="muted">{item.canManageChildPrograms ? t("tenantUsers.programPermissionEnabled") : t("tenantUsers.programPermissionDisabled")}</AppText>}
      {item.role === "STAFF" && <AppText tone="muted">{item.canManageDevelopmentCategories ? t("tenantUsers.developmentCategoryPermissionEnabled") : t("tenantUsers.developmentCategoryPermissionDisabled")}</AppText>}
      {canManage && item.status === "ACTIVE" && item.userId && (item.role === "STAFF_ADMIN" || item.role === "STAFF") && <View style={styles.options}>
        {item.role === "STAFF" && <Button variant={item.canManageChildPrograms ? "secondary" : "primary"} loading={updateTenantUserChildProgramPermission.isPending} onPress={() => void updateProgramPermission(item.userId!, !item.canManageChildPrograms)}>{item.canManageChildPrograms ? t("tenantUsers.revokeProgramPermission") : t("tenantUsers.grantProgramPermission")}</Button>}
        {item.role === "STAFF" && <Button variant={item.canManageDevelopmentCategories ? "secondary" : "primary"} loading={updateTenantUserDevelopmentCategoryPermission.isPending} onPress={() => void updateDevelopmentCategoryPermission(item.userId!, !item.canManageDevelopmentCategories)}>{item.canManageDevelopmentCategories ? t("tenantUsers.revokeDevelopmentCategoryPermission") : t("tenantUsers.grantDevelopmentCategoryPermission")}</Button>}
        <Button variant="danger" loading={deactivateTenantUser.isPending} onPress={() => void deactivate(item.userId!)}>{t("tenantUsers.deactivate")}</Button>
      </View>}
    </View>)}
    <BottomSheet visible={sheet === "staff"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.createStaffAccount")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenantUsers.createStaffAccount"), loading: createTenantUser.isPending, onPress: () => void submitStaffAccount() }}>
      <TextInput style={styles.input} placeholder={t("tenantUsers.displayName")} value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={staffEmail} onChangeText={setStaffEmail} />
      <PasswordInput placeholder={t("tenantUsers.password")} value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <View style={styles.options}>{staffRoles.map((item) => <Button key={item} variant={item === staffRole ? "primary" : "secondary"} onPress={() => setStaffRole(item)}>{t(roleKey(item))}</Button>)}</View>
      {staffRole === "STAFF" && <><AppText variant="label">{t("tenantUsers.branch")}</AppText><View style={styles.options}>{branches.data?.filter((branch) => branch.active).map((branch) => <Button key={branch.id} variant={branch.id === staffBranchId ? "primary" : "secondary"} onPress={() => setStaffBranchId(branch.id)}>{branch.name}</Button>)}</View><AppText variant="label">{t("tenantUsers.programPermission")}</AppText><AppText tone="muted">{t("tenantUsers.programPermissionDescription")}</AppText><View style={styles.options}><Button variant={canManageChildPrograms ? "primary" : "secondary"} onPress={() => setCanManageChildPrograms(true)}>{t("tenantUsers.programPermissionAllow")}</Button><Button variant={!canManageChildPrograms ? "primary" : "secondary"} onPress={() => setCanManageChildPrograms(false)}>{t("tenantUsers.programPermissionDeny")}</Button></View><AppText variant="label">{t("tenantUsers.developmentCategoryPermission")}</AppText><AppText tone="muted">{t("tenantUsers.developmentCategoryPermissionDescription")}</AppText><View style={styles.options}><Button variant={canManageDevelopmentCategories ? "primary" : "secondary"} onPress={() => setCanManageDevelopmentCategories(true)}>{t("tenantUsers.programPermissionAllow")}</Button><Button variant={!canManageDevelopmentCategories ? "primary" : "secondary"} onPress={() => setCanManageDevelopmentCategories(false)}>{t("tenantUsers.programPermissionDeny")}</Button></View></>}
    </BottomSheet>
    <BottomSheet visible={sheet === "parent"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantUsers.parentInvitation")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("tenantUsers.invite"), loading: inviteParent.isPending, onPress: () => void submitParentInvitation() }}>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={parentEmail} onChangeText={setParentEmail} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  user: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
