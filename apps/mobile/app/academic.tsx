import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, Badge, Banner, EmptyState, MenuItem, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantReadinessIssueKey } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";
import { hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function AcademicScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const hasLegacyClasses = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const readiness = useQuery({ queryKey: ["organization-readiness", organizationId], queryFn: () => api.organizationReadiness(), enabled: membership?.role === "STAFF_ADMIN" });
  const needsClassroom = Boolean(readiness.data?.issues.includes("ACTIVE_CLASSROOM_REQUIRED"));

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  return <AppScreen>
    <AppText variant="title">{t("learning.title")}</AppText>
    <AppText tone="muted">{t("learning.subtitle")}</AppText>
    {membership.active === false && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    <View style={styles.actions}>
      {hasLegacyClasses && <MenuItem icon="grid-outline" title={t("learning.classroom")} description={t("learning.addClassroomDescription")} attention={needsClassroom} badge={needsClassroom ? <Badge tone="danger" icon="alert-circle" label={t("tenantReadiness.needsAttention")} /> : undefined} onPress={() => router.push("/classrooms")} />}
      {needsClassroom && <AppText variant="caption" tone="danger" style={styles.attentionDetail}>• {t(tenantReadinessIssueKey("ACTIVE_CLASSROOM_REQUIRED"))}</AppText>}
      {hasAcademicOffering && <>
        <MenuItem icon="calendar-number-outline" title={t("academic.year")} description={t("academic.addYearDescription")} onPress={() => router.push("/academic-years")} />
        <MenuItem icon="library-outline" title={t("academic.program")} description={t("academic.addProgramDescription")} onPress={() => router.push("/curriculum-programs")} />
        {membership.role === "STAFF_ADMIN" && <MenuItem icon="layers-outline" title={t("learning.level")} description={t("learning.addLevelDescription")} onPress={() => router.push("/learning-levels")} />}
        <MenuItem icon="color-palette-outline" title={t("learning.activities")} description={t("learning.addActivityDescription")} onPress={() => router.push("/curriculum-activities")} />
      </>}
    </View>
    {!access.isLoading && !hasLegacyClasses && <EmptyState icon="school-outline" title={t("learning.noClassrooms")} />}
  </AppScreen>;
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  attentionDetail: { paddingHorizontal: spacing.md },
});
