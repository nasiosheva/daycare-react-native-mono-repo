import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, PasswordInput, radius, spacing } from "@daycare/ui";
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
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const changePassword = useMutation({ mutationFn: ({ userId, password }: { userId: string; password: string }) => api.changeTenantUserPassword(userId, password) });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const eligibleUsers = users.data?.filter((user) => user.status === "ACTIVE" && user.userId && (user.role === "STAFF_ADMIN" || user.role === "STAFF")) ?? [];
  const selectedUser = eligibleUsers.find((user) => user.userId === selectedUserId);
  const submit = async () => {
    if (!selectedUser?.userId) return;
    if (password.length < 6) return Alert.alert(t("password.minLength"));
    try {
      await changePassword.mutateAsync({ userId: selectedUser.userId, password });
      setPassword("");
      Alert.alert(t("tenantUsers.passwordChanged"), t("tenantUsers.passwordChangedDescription", { name: selectedUser.displayName ?? selectedUser.email ?? t("tenantUsers.accounts") }));
    } catch (error) { Alert.alert(t("tenantUsers.passwordChangeFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenantUsers.staffPasswords")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("tenantUsers.staffPasswordSubtitle")}</AppText>
    {!canManage && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {users.isLoading && <AppText>{t("tenantUsers.loadingStaff")}</AppText>}
    {users.isError && <Button variant="secondary" onPress={() => users.refetch()}>{t("common.retry")}</Button>}
    {canManage && !selectedUser && eligibleUsers.map((user) => <View key={user.id} style={styles.user}>
      <View><AppText variant="label">{user.displayName ?? user.email ?? t("common.noData")}</AppText><AppText tone="muted">{t(roleKey(user.role))} · {user.email}</AppText></View>
      <Button variant="secondary" onPress={() => setSelectedUserId(user.userId)}>{t("tenantUsers.changePassword")}</Button>
    </View>)}
    <BottomSheet visible={Boolean(selectedUser)} onClose={() => { setSelectedUserId(null); setPassword(""); }} closeAccessibilityLabel={t("common.close")} title={selectedUser?.displayName ?? selectedUser?.email ?? undefined} negativeAction={{ label: t("common.cancel"), onPress: () => { setSelectedUserId(null); setPassword(""); } }} positiveAction={{ label: t("tenantUsers.savePassword"), loading: changePassword.isPending, disabled: !password, onPress: () => void submit() }}>
      <PasswordInput placeholder={t("password.new")} value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
    {!users.isLoading && !users.isError && eligibleUsers.length === 0 && <AppText tone="muted">{t("tenantUsers.noStaff")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  user: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
