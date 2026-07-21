import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import { AppText, Button, colors, PasswordInput, radius, spacing } from "@daycare/ui";
import type { Role } from "@daycare/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";

const staffRoles: Extract<Role, "STAFF_ADMIN" | "STAFF">[] = ["STAFF_ADMIN", "STAFF"];

export default function TenantUsersScreen() {
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const queryClient = useQueryClient();
  const tenantUsers = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const createTenantUser = useMutation({ mutationFn: api.createTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const inviteParent = useMutation({ mutationFn: api.inviteTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const [displayName, setDisplayName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState<Extract<Role, "STAFF_ADMIN" | "STAFF">>("STAFF");
  const [parentEmail, setParentEmail] = useState("");
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const submitStaffAccount = async () => {
    if (!displayName.trim() || !staffEmail.trim() || password.length < 6) return Alert.alert(t("tenantUsers.staffAccountRequired"));
    try {
      await createTenantUser.mutateAsync({ displayName: displayName.trim(), email: staffEmail.trim(), password, role: staffRole });
      setDisplayName("");
      setStaffEmail("");
      setPassword("");
      Alert.alert(t("tenantUsers.staffAccountCreated"), t("tenantUsers.staffAccountCreatedDescription"));
    } catch (error) { Alert.alert(t("tenantUsers.staffAccountCreateFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const submitParentInvitation = async () => {
    if (!parentEmail.trim()) return Alert.alert(t("tenantUsers.emailRequired"));
    try {
      await inviteParent.mutateAsync({ email: parentEmail.trim(), role: "PARENT" });
      setParentEmail("");
      Alert.alert(t("tenantUsers.invited"), t("tenantUsers.invitedDescription"));
    } catch (error) { Alert.alert(t("tenantUsers.inviteFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen><AppText variant="title">{t("tenantUsers.title")}</AppText>
    <AppText tone="muted">{t("tenantUsers.subtitle")}</AppText>
    <Button variant="secondary" onPress={() => router.push("/staff-passwords")}>{t("tenantUsers.managePasswords")}</Button>
    <View style={styles.form}>
      <AppText variant="heading">{t("tenantUsers.createStaffAccount")}</AppText>
      <TextInput style={styles.input} placeholder={t("tenantUsers.displayName")} value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={staffEmail} onChangeText={setStaffEmail} />
      <PasswordInput placeholder={t("tenantUsers.password")} value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <View style={styles.options}>{staffRoles.map((item) => <Button key={item} variant={item === staffRole ? "primary" : "secondary"} onPress={() => setStaffRole(item)}>{t(roleKey(item))}</Button>)}</View>
      <Button loading={createTenantUser.isPending} onPress={() => void submitStaffAccount()}>{t("tenantUsers.createStaffAccount")}</Button>
    </View>
    <View style={styles.form}>
      <AppText variant="heading">{t("tenantUsers.parentInvitation")}</AppText>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={parentEmail} onChangeText={setParentEmail} />
      <Button loading={inviteParent.isPending} onPress={() => void submitParentInvitation()}>{t("tenantUsers.invite")}</Button>
    </View>
    <AppText variant="heading">{t("tenantUsers.accounts")}</AppText>
    {tenantUsers.isLoading && <AppText>{t("tenantUsers.loading")}</AppText>}
    {tenantUsers.isError && <Button variant="secondary" onPress={() => tenantUsers.refetch()}>{t("common.retry")}</Button>}
    {tenantUsers.data?.map((item) => <View key={item.id} style={styles.user}>
      <AppText variant="label">{item.displayName ?? item.email ?? t("common.noData")}</AppText>
      <AppText tone="muted">{t(roleKey(item.role))} · {t(`status.${item.status}` as Parameters<typeof t>[0])}</AppText>
    </View>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  user: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
