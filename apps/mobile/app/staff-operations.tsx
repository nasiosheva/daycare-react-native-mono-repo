import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, MenuItem, MenuSection } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function StaffOperationsScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);

  if (!profile) return null;
  if (membership?.role !== "STAFF") return <Redirect href="/home" />;

  return <AppScreen>
    <AppText variant="title">{t("staffOperations.title")}</AppText>
    <AppText tone="muted">{t("staffOperations.subtitle")}</AppText>
    <MenuSection title={t("menu.groupDaily")}>
      <MenuItem icon="checkbox-outline" title={t("attendance.title")} description={t("staffOperations.attendanceDescription")} onPress={() => router.push("/attendance")} />
      <MenuItem icon="people-outline" title={t("children.title")} description={t("staffOperations.childrenDescription")} onPress={() => router.push("/children")} />
      <MenuItem icon="sparkles-outline" title={t("development.title")} description={t("staffOperations.developmentDescription")} onPress={() => router.push("/development")} />
      <MenuItem icon="calendar-outline" title={t("absence.menu")} description={t("absence.menuDescription")} onPress={() => router.push("/absence-requests")} />
    </MenuSection>
  </AppScreen>;
}
