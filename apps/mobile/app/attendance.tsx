import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { ChildListFilter } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useRecordAttendance } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";
import { DatePicker } from "@/date-picker/DatePicker";
import { dateFromIsoTime, formatIsoTime } from "@/date-picker/date";

type ConfirmState = { childId: string; childName: string; action: "CHECK_IN" | "CHECK_OUT" };

export default function AttendanceScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t, formatTime } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const readOnly = membership?.active === false;
  const [filterVisible, setFilterVisible] = useState(false);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [time, setTime] = useState("");
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const record = useRecordAttendance();
  const totalChildren = children.data?.length ?? 0;
  const presentCount = children.data?.filter((child) => child.todayCheckedInAt).length ?? 0;
  const confirmLabel = confirm?.action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut");
  const openConfirm = (child: { id: string; fullName: string }, action: "CHECK_IN" | "CHECK_OUT") => {
    setTime(formatIsoTime(new Date()));
    setConfirm({ childId: child.id, childName: child.fullName, action });
  };
  const submit = async () => {
    if (!confirm) return;
    const actionLabel = confirm.action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut");
    try {
      await record.mutateAsync({ childId: confirm.childId, action: confirm.action, method: "MANUAL", at: dateFromIsoTime(time).toISOString() });
      setConfirm(null);
      Alert.alert(t("attendance.success"), t("attendance.recorded", { action: actionLabel }));
    } catch (error) {
      Alert.alert(t("attendance.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };
  return <AppScreen showBottomNavigation={false} title={t("attendance.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {isStaffAdmin && <Button variant="secondary" onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}
    {isStaffAdmin && (childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
    {!readOnly && <Button variant="secondary" onPress={() => router.push("/attendance-scan")}>{t("attendance.scan")}</Button>}
    {!children.isFetching && totalChildren > 0 && <AppText tone="muted">{t("attendance.rosterSummary", { present: presentCount, total: totalChildren })}</AppText>}
    {children.isFetching && <ShimmerList />}
    {children.isError && <Button onPress={() => children.refetch()}>{t("common.retry")}</Button>}
    {!children.isFetching && !children.isError && totalChildren === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
    {!children.isFetching && children.data?.map((child) => {
      const checkedIn = Boolean(child.todayCheckedInAt);
      const checkedOut = Boolean(child.todayCheckedOutAt);
      return <View key={child.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText variant="heading">{child.fullName}</AppText>
          <View style={[styles.statusBadge, checkedOut ? styles.statusBadgeOut : checkedIn ? styles.statusBadgeIn : styles.statusBadgeNone]}>
            <AppText variant="caption" tone={checkedIn || checkedOut ? "default" : "muted"}>{checkedOut ? t("attendance.statusCheckedOut") : checkedIn ? t("attendance.statusCheckedIn") : t("attendance.statusNotYet")}</AppText>
          </View>
        </View>
        <View style={styles.times}>
          <AppText variant="caption" tone="muted">{t("attendance.checkInTime")}: {child.todayCheckedInAt ? formatTime(child.todayCheckedInAt) : "—"}</AppText>
          <AppText variant="caption" tone="muted">{t("attendance.checkOutTime")}: {child.todayCheckedOutAt ? formatTime(child.todayCheckedOutAt) : "—"}</AppText>
        </View>
        {!readOnly && <View style={styles.actions}>
          <Button disabled={record.isPending || checkedIn} onPress={() => openConfirm(child, "CHECK_IN")}>{t("attendance.checkIn")}</Button>
          <Button variant="secondary" disabled={record.isPending || !checkedIn || checkedOut} onPress={() => openConfirm(child, "CHECK_OUT")}>{t("attendance.checkOut")}</Button>
        </View>}
      </View>;
    })}
    <BottomSheet
      visible={confirm !== null}
      onClose={() => setConfirm(null)}
      closeAccessibilityLabel={t("common.close")}
      title={t("attendance.confirmTitle")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setConfirm(null) }}
      positiveAction={{ label: confirmLabel, loading: record.isPending, onPress: () => void submit() }}
    >
      {confirm && <AppText>{t("attendance.confirmMessage", { action: confirmLabel, name: confirm.childName })}</AppText>}
      <View style={styles.timeField}>
        <AppText variant="label">{t("attendance.time")}</AppText>
        <DatePicker mode="time" value={time} onChange={setTime} placeholder={t("attendance.time")} />
      </View>
    </BottomSheet>
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  times: { gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  timeField: { gap: spacing.xs },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill },
  statusBadgeIn: { backgroundColor: colors.accentSoft },
  statusBadgeOut: { backgroundColor: colors.disabled },
  statusBadgeNone: { backgroundColor: colors.surfaceTint },
});
