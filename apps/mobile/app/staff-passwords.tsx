import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppText, Avatar, BackButton, Banner, BottomSheet, Button, EmptyState, ErrorState, PasswordInput, ShimmerList, TabBar, colors, radius, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";

export default function StaffPasswordsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active !== false;
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const users = useQuery({ queryKey: ["tenant-users", organizationId, filterBranchId], queryFn: () => api.tenantUsers({ branchId: filterBranchId }), enabled: membership?.role === "STAFF_ADMIN" });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const changePassword = useMutation({ mutationFn: ({ userId, password }: { userId: string; password: string }) => api.changeTenantUserPassword(userId, password) });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const eligibleUsers = users.data?.filter((user) => user.status === "ACTIVE" && user.userId && (user.role === "STAFF_ADMIN" || user.role === "STAFF")) ?? [];
  const selectedUser = eligibleUsers.find((user) => user.userId === selectedUserId);
  const selectUser = (userId: string) => setSelectedUserId(userId);
  const submit = async () => {
    if (!selectedUser?.userId) return;
    if (password.length < 6) return notify(t("password.minLength"), undefined, "warning");
    try {
      await changePassword.mutateAsync({ userId: selectedUser.userId, password });
      setPassword("");
      notify(t("tenantUsers.passwordChanged"), t("tenantUsers.passwordChangedDescription", { name: selectedUser.displayName ?? selectedUser.email ?? t("tenantUsers.accounts") }), "success");
    } catch (error) { notify(t("tenantUsers.passwordChangeFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenantUsers.staffPasswords")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("tenantUsers.staffPasswordSubtitle")}</AppText>
    {!canManage && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    <TabBar accessibilityLabel={t("branchFilter.allBranches")} selected={filterBranchId ?? ""} onSelect={(key) => setFilterBranchId(key || undefined)} items={[{ key: "", label: t("branchFilter.allBranches") }, ...(branches.data?.map((branch) => ({ key: branch.id, label: branch.name })) ?? [])]} />
    {users.isFetching && <ShimmerList variant="row" />}
    {users.isError && !users.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void users.refetch()} />}
    {canManage && !users.isFetching && eligibleUsers.map((user) => <View key={user.id} style={styles.user}>
      <Avatar name={user.displayName ?? user.email ?? "?"} />
      <View style={styles.grow}><AppText variant="h6">{user.displayName ?? user.email ?? t("common.noData")}</AppText><AppText variant="bodySmall" tone="muted">{t(roleKey(user.role))} · {user.email}</AppText></View>
      <Button variant="secondary" leadingIcon={<Ionicons name="key-outline" size={18} color={colors.primary} />} onPress={() => selectUser(user.userId!)}>{t("tenantUsers.changePassword")}</Button>
    </View>)}
    {!users.isFetching && !users.isError && eligibleUsers.length === 0 && <EmptyState compact title={t("tenantUsers.noStaff")} />}
    <BottomSheet visible={Boolean(selectedUser)} onClose={() => { setSelectedUserId(null); setPassword(""); }} closeAccessibilityLabel={t("common.close")} title={selectedUser?.displayName ?? selectedUser?.email ?? undefined} negativeAction={{ label: t("common.cancel"), onPress: () => { setSelectedUserId(null); setPassword(""); } }} positiveAction={{ label: t("tenantUsers.savePassword"), loading: changePassword.isPending, disabled: !password, onPress: () => void submit() }}>
      <AppText variant="label">{t("password.new")}</AppText>
      <PasswordInput value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
  </AppScreen>;
}


const styles = StyleSheet.create({
  grow: { flex: 1, gap: 2 },
  user: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
