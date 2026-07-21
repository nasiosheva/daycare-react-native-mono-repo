import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import type { Role } from "@daycare/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";

const inviteRoles: Extract<Role, "STAFF" | "PARENT">[] = ["STAFF", "PARENT"];

export default function TenantUsersScreen() {
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const queryClient = useQueryClient();
  const tenantUsers = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const invite = useMutation({ mutationFn: api.inviteTenantUser.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", organizationId] }) });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Extract<Role, "STAFF" | "PARENT">>("STAFF");
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const submit = async () => {
    if (!email.trim()) return Alert.alert(t("tenantUsers.emailRequired"));
    try {
      await invite.mutateAsync({ email: email.trim(), role });
      setEmail("");
      Alert.alert(t("tenantUsers.invited"), t("tenantUsers.invitedDescription"));
    } catch (error) { Alert.alert(t("tenantUsers.inviteFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen><AppText variant="title">{t("tenantUsers.title")}</AppText>
    <AppText tone="muted">{t("tenantUsers.subtitle")}</AppText>
    <Button variant="secondary" onPress={() => router.push("/staff-passwords")}>{t("tenantUsers.managePasswords")}</Button>
    <View style={styles.form}>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenantUsers.email")} value={email} onChangeText={setEmail} />
      <View style={styles.options}>{inviteRoles.map((item) => <Button key={item} variant={item === role ? "primary" : "secondary"} onPress={() => setRole(item)}>{item === "STAFF" ? t("tenantUsers.staff") : t("tenantUsers.parent")}</Button>)}</View>
      <Button loading={invite.isPending} onPress={() => void submit()}>{t("tenantUsers.invite")}</Button>
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
