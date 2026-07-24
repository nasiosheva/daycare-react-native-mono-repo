import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useRecordAttendance } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function AttendanceScreen() {
  const router = useRouter();
  const children = useChildren();
  const record = useRecordAttendance();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const readOnly = profile?.memberships.find((item) => item.organizationId === organizationId)?.active === false;
  const submit = async (childId: string, action: "CHECK_IN" | "CHECK_OUT") => {
    try { const actionLabel = action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut"); await record.mutateAsync({ childId, action, method: "MANUAL" }); Alert.alert(t("attendance.success"), t("attendance.recorded", { action: actionLabel })); }
    catch (error) { Alert.alert(t("attendance.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const isPending = (childId: string, action: "CHECK_IN" | "CHECK_OUT") => record.isPending && record.variables?.childId === childId && record.variables?.action === action;
  return <AppScreen showBottomNavigation={false} title={t("attendance.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {!readOnly && <Button variant="secondary" onPress={() => router.push("/attendance-scan")}>{t("attendance.scan")}</Button>}
    {children.isLoading && <AppText>{t("attendance.loading")}</AppText>}
    {children.isError && <Button onPress={() => children.refetch()}>{t("common.retry")}</Button>}
    {children.data?.map((child) => {
      const checkedIn = Boolean(child.todayCheckedInAt);
      const checkedOut = Boolean(child.todayCheckedOutAt);
      return <View key={child.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText variant="heading">{child.fullName}</AppText>
          <View style={[styles.statusBadge, checkedOut ? styles.statusBadgeOut : checkedIn ? styles.statusBadgeIn : styles.statusBadgeNone]}>
            <AppText variant="caption" tone={checkedIn || checkedOut ? "default" : "muted"}>{checkedOut ? t("attendance.statusCheckedOut") : checkedIn ? t("attendance.statusCheckedIn") : t("attendance.statusNotYet")}</AppText>
          </View>
        </View>
        {!readOnly && <View style={styles.actions}>
          <Button loading={isPending(child.id, "CHECK_IN")} disabled={record.isPending || checkedIn} onPress={() => void submit(child.id, "CHECK_IN")}>{t("attendance.checkIn")}</Button>
          <Button variant="secondary" loading={isPending(child.id, "CHECK_OUT")} disabled={record.isPending || !checkedIn || checkedOut} onPress={() => void submit(child.id, "CHECK_OUT")}>{t("attendance.checkOut")}</Button>
        </View>}
      </View>;
    })}
  </AppScreen>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill },
  statusBadgeIn: { backgroundColor: colors.accentSoft },
  statusBadgeOut: { backgroundColor: colors.disabled },
  statusBadgeNone: { backgroundColor: colors.surfaceTint },
});
