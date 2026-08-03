import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function AcademicScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const hasLegacyClasses = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  return <AppScreen>
    <AppText variant="title">{t("learning.title")}</AppText>
    <AppText tone="muted">{t("learning.subtitle")}</AppText>
    {membership.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <View style={styles.actionsGrid}>
      {hasLegacyClasses && <ActionCard title={t("learning.classroom")} description={t("learning.addClassroomDescription")} onPress={() => router.push("/classrooms")} />}
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

function ActionCard({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}>
    <AppText variant="label">{title}</AppText>
    <AppText variant="caption" tone="muted">{description}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionCard: { flexBasis: "47%", flexGrow: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionCardPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
});
