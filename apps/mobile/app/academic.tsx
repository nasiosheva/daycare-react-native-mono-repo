import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, colors, radius, spacing } from "@daycare/ui";
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
    {membership.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <View style={styles.actionsGrid}>
      {hasLegacyClasses && <ActionCard title={t("learning.classroom")} description={t("learning.addClassroomDescription")} attention={needsClassroom} attentionLabel={t(tenantReadinessIssueKey("ACTIVE_CLASSROOM_REQUIRED"))} onPress={() => router.push("/classrooms")} />}
      {hasAcademicOffering && <>
        <ActionCard title={t("academic.year")} description={t("academic.addYearDescription")} onPress={() => router.push("/academic-years")} />
        <ActionCard title={t("academic.program")} description={t("academic.addProgramDescription")} onPress={() => router.push("/curriculum-programs")} />
        {membership.role === "STAFF_ADMIN" && <ActionCard title={t("learning.level")} description={t("learning.addLevelDescription")} onPress={() => router.push("/learning-levels")} />}
        <ActionCard title={t("learning.activities")} description={t("learning.addActivityDescription")} onPress={() => router.push("/curriculum-activities")} />
      </>}
    </View>
    {!access.isLoading && !hasLegacyClasses && <AppText tone="muted">{t("learning.noClassrooms")}</AppText>}
  </AppScreen>;
}

function ActionCard({ title, description, attention, attentionLabel, onPress }: { title: string; description: string; attention?: boolean; attentionLabel?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.actionCard, attention && styles.actionCardAttention, pressed && styles.actionCardPressed]}>
    <AppText variant="label">{title}</AppText>
    <AppText variant="caption" tone="muted">{description}</AppText>
    {attention && <AppText variant="caption" tone="danger">• {attentionLabel}</AppText>}
  </Pressable>;
}

const styles = StyleSheet.create({
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionCard: { flexBasis: "47%", flexGrow: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionCardAttention: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  actionCardPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
});
