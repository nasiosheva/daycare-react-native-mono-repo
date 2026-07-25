import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function OperationalHoursScreen() {
  const { api, profile, organizationId } = useAuth(); const { t, formatCurrency } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const hours = useQuery({ queryKey: ["parent-operating-hours", organizationId], queryFn: () => api.parentOperatingHours(), enabled: membership?.role === "PARENT" });
  if (!profile) return null;
  if (membership?.role !== "PARENT") return <Redirect href="/home" />;
  return <AppScreen title={t("overtime.parentTitle")}><AppText tone="muted">{t("overtime.parentDescription")}</AppText>
    {hours.isLoading && <AppText>{t("common.loading")}</AppText>}
    {hours.data?.map((branch) => <View key={branch.branchId} style={styles.card}><AppText variant="heading">{branch.branchName}</AppText><AppText tone="muted">{t("overtime.branchOperatingHours")}</AppText>
      {branch.hours.map((hour) => <View key={hour.dayOfWeek} style={styles.row}><AppText>{t(`overtime.day.${hour.dayOfWeek}`)}</AppText><AppText tone="muted">{hour.active ? `${hour.opensAt}–${hour.closesAt}` : t("overtime.closed")}</AppText></View>)}
      <AppText variant="h5">{t("overtime.rateTiers")}</AppText>{branch.tiers.map((tier, index) => <AppText key={`${tier.durationMinutes}-${index}`} tone="muted">{t("overtime.parentTier", { duration: tier.durationMinutes, amount: formatCurrency(tier.amount) })}</AppText>)}
    </View>)}
    {!hours.isLoading && hours.data?.length === 0 && <AppText tone="muted">{t("overtime.noParentBranches")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm } });
