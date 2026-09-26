import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Badge, Button, MenuItem, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { isInactiveStaffMembership } from "@/navigation/inactiveStaffRouteAccess";

export default function ContextSelectionScreen() {
  const router = useRouter();
  const { profile, loading, selectOrganization } = useAuth();
  const { t } = useI18n();

  if (loading) return null;
  if (!profile) return <Redirect href="/home" />;
  if (profile.isPlatformAdmin || profile.memberships.length === 0) return <Redirect href="/home" />;

  const chooseOrganization = (organizationId: string) => {
    if (selectOrganization(organizationId)) router.replace("/home");
  };

  return <AppScreen showBottomNavigation={false}>
    <View style={styles.content}>
      <AppText variant="title">{t("parentEnrollment.tenant")}</AppText>
      <AppText tone="muted">{t("contextSelection.description")}</AppText>
      <View style={styles.choices}>
        {profile.memberships.map((membership) => <MenuItem key={membership.organizationId} icon="business-outline" title={membership.organizationName} description={t("profile.roleTenant", { role: t(roleKey(membership.role)) })} badge={isInactiveStaffMembership(membership) ? <Badge tone="warning" label={t("staffOperations.readOnlyShort")} /> : undefined} onPress={() => chooseOrganization(membership.organizationId)} />)}
      </View>
      <Button variant="ghost" onPress={() => router.push("/profile")}>{t("nav.profile")}</Button>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: spacing.md, padding: spacing.md, justifyContent: "center" },
  choices: { gap: spacing.sm },
  choice: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
