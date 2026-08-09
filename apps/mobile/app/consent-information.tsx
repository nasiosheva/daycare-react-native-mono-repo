import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BackButton, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

const informationSections = [
  ["consent.informationCurrentTitle", "consent.informationCurrentDescription"],
  ["consent.informationParentTitle", "consent.informationParentDescription"],
  ["consent.informationRevisionTitle", "consent.informationRevisionDescription"],
  ["consent.informationPurposeTitle", "consent.informationPurposeDescription"],
  ["consent.informationLimitTitle", "consent.informationLimitDescription"],
  ["consent.informationPracticeTitle", "consent.informationPracticeDescription"],
] as const;

export default function ConsentInformationScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const canRead = membership?.role === "STAFF_ADMIN" && membership.active !== false && hasOfferingCapability(access.data, "DAYCARE_OPERATIONS");

  if (!profile || access.isLoading) return null;
  if (!canRead) return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("consent.informationTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText tone="muted">{t("consent.informationIntro")}</AppText>
    {informationSections.map(([title, description]) => <View key={title} style={styles.card}>
      <AppText variant="heading">{t(title)}</AppText>
      <AppText tone="muted">{t(description)}</AppText>
    </View>)}
  </View></AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
