import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import type { OperatingDay } from "@daycare/api-client";
import { AppText, ShimmerList, colors, radius, shadows, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

const weekOrder: OperatingDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function todayInTimezone(timezone: string): OperatingDay {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(new Date()).toUpperCase();
  return weekOrder.find((day) => day === weekday) ?? weekOrder[0];
}

export default function OperationalHoursScreen() {
  const { api, profile, user } = useAuth();
  const { t, formatCurrency } = useI18n();
  const isParent = profile?.memberships.some((item) => item.role === "PARENT") ?? false;
  const hours = useQuery({ queryKey: ["parent-operating-hours-all-tenants", user?.uid], queryFn: () => api.parentOperatingHoursAllTenants(), enabled: Boolean(user) && isParent });
  if (!profile) return null;
  if (!isParent) return <Redirect href="/home" />;

  return <AppScreen title={t("overtime.parentTitle")}>
    <AppText tone="muted">{t("overtime.parentDescription")}</AppText>
    {hours.isFetching && <ShimmerList />}
    {!hours.isFetching && hours.data?.map((entry) => {
      const today = todayInTimezone(entry.timezone);
      return <View key={entry.childId} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}><AppText variant="h6" style={styles.avatarText}>{entry.childName.trim().charAt(0).toUpperCase() || "?"}</AppText></View>
          <View style={styles.cardHeading}>
            <AppText variant="h5">{entry.childName}</AppText>
            <View style={styles.tenantRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <AppText tone="muted" variant="bodySmall">{t("overtime.childTenantLabel", { organization: entry.organizationName, branch: entry.branchName })}</AppText>
            </View>
          </View>
        </View>

        <View style={styles.daysGrid}>
          {entry.hours.map((hour) => {
            const isToday = hour.dayOfWeek === today;
            return <View key={hour.dayOfWeek} style={[styles.dayChip, hour.active ? styles.dayChipOpen : styles.dayChipClosed, isToday && styles.dayChipToday]}>
              <View style={styles.dayChipHeader}>
                <AppText variant="caption" style={hour.active ? styles.dayChipOpenText : styles.dayChipClosedText}>{t(`overtime.day.${hour.dayOfWeek}`)}</AppText>
                {isToday && <View style={[styles.todayDot, hour.active ? styles.todayDotOnOpen : styles.todayDotOnClosed]} />}
              </View>
              <AppText variant="caption" style={hour.active ? styles.dayChipOpenText : styles.dayChipClosedText}>{hour.active ? `${hour.opensAt}–${hour.closesAt}` : t("overtime.closed")}</AppText>
            </View>;
          })}
        </View>

        {entry.tiers.length > 0 && <View style={styles.tiersSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={16} color={colors.danger} />
            <AppText variant="label">{t("overtime.rateTiers")}</AppText>
          </View>
          <View style={styles.tiersRow}>
            {entry.tiers.map((tier, index) => <View key={`${tier.durationMinutes}-${index}`} style={styles.tierPill}>
              <Ionicons name="time-outline" size={14} color={colors.danger} />
              <AppText variant="caption" style={styles.tierText}>{t("overtime.parentTier", { duration: tier.durationMinutes, amount: formatCurrency(tier.amount) })}</AppText>
            </View>)}
          </View>
        </View>}
      </View>;
    })}
    {!hours.isFetching && hours.data?.length === 0 && <AppText tone="muted">{t("overtime.noParentBranches")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...shadows.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onPrimary },
  cardHeading: { flex: 1, gap: spacing.xs },
  tenantRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  dayChip: { flexBasis: "22%", flexGrow: 1, gap: spacing.xs / 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radius.md, borderWidth: 1.5, borderColor: "transparent" },
  dayChipOpen: { backgroundColor: colors.accentSoft },
  dayChipClosed: { backgroundColor: colors.disabled },
  dayChipToday: { borderColor: colors.primary },
  dayChipHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayChipOpenText: { color: colors.primaryPressed },
  dayChipClosedText: { color: colors.muted },
  todayDot: { width: 6, height: 6, borderRadius: radius.pill },
  todayDotOnOpen: { backgroundColor: colors.primaryPressed },
  todayDotOnClosed: { backgroundColor: colors.muted },
  tiersSection: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tiersRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tierPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  tierText: { color: colors.danger },
});
