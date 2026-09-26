import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ChildListFilter } from "@daycare/api-client";
import { AppText, Avatar, Badge, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, SearchField, ShimmerList, TabBar, TextField, colors, spacing, type Tone } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useRecordAttendance } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";
import { DatePicker } from "@/date-picker/DatePicker";
import { dateFromIsoTime, formatIsoTime } from "@/date-picker/date";
import { attendanceStatus, filterRoster, rosterCounts, type AttendanceStatus, type AttendanceStatusFilter } from "@/attendance/attendanceRoster";
import { notify } from "@/notify/notify";

const statusTones: Record<AttendanceStatus, Tone> = { NOT_YET: "neutral", PRESENT: "success", LEFT: "info" };
const statusIcons = { NOT_YET: "time-outline", PRESENT: "checkmark-circle", LEFT: "home-outline" } as const;

type ConfirmState = { childId: string; childName: string; action: "CHECK_IN" | "CHECK_OUT" };

export default function AttendanceScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatTime } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const readOnly = membership?.active === false;
  const [filterVisible, setFilterVisible] = useState(false);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>("ALL");
  const [time, setTime] = useState("");
  const [pickupAuthorizationId, setPickupAuthorizationId] = useState<string | null>(null);
  const [pickupExceptionReason, setPickupExceptionReason] = useState("");
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const record = useRecordAttendance();
  const pickupAuthorizations = useQuery({ queryKey: ["pickup-authorizations", organizationId, confirm?.childId], queryFn: () => api.pickupAuthorizations(confirm!.childId), enabled: Boolean(confirm?.childId && confirm.action === "CHECK_OUT") });
  const totalChildren = children.data?.length ?? 0;
  const counts = useMemo(() => rosterCounts(children.data ?? []), [children.data]);
  const visibleChildren = useMemo(() => filterRoster(children.data ?? [], search, statusFilter), [children.data, search, statusFilter]);
  const statusLabels: Record<AttendanceStatus, string> = { NOT_YET: t("attendance.statusNotYet"), PRESENT: t("attendance.statusCheckedIn"), LEFT: t("attendance.statusCheckedOut") };
  const hasChildFilter = Boolean(childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId);
  const confirmLabel = confirm?.action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut");
  const openConfirm = (child: { id: string; fullName: string }, action: "CHECK_IN" | "CHECK_OUT") => {
    setTime(formatIsoTime(new Date()));
    setPickupAuthorizationId(null);
    setPickupExceptionReason("");
    setConfirm({ childId: child.id, childName: child.fullName, action });
  };
  const submit = async () => {
    if (!confirm) return;
    const actionLabel = confirm.action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut");
    try {
      await record.mutateAsync({ childId: confirm.childId, action: confirm.action, method: "MANUAL", at: dateFromIsoTime(time).toISOString(), pickupAuthorizationId: confirm.action === "CHECK_OUT" ? pickupAuthorizationId ?? undefined : undefined, pickupExceptionReason: confirm.action === "CHECK_OUT" ? pickupExceptionReason.trim() || undefined : undefined });
      setConfirm(null);
      notify(t("attendance.success"), t("attendance.recorded", { action: actionLabel }), "success");
    } catch (error) {
      notify(t("attendance.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger");
    }
  };
  return <AppScreen showBottomNavigation={false} title={t("attendance.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {readOnly && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    {!readOnly && <Button leadingIcon={<Ionicons name="qr-code-outline" size={20} color={colors.onPrimary} />} onPress={() => router.push("/attendance-scan")}>{t("attendance.scan")}</Button>}
    {!children.isFetching && totalChildren > 0 && <AppText variant="label">{t("attendance.rosterSummary", { present: counts.PRESENT + counts.LEFT, total: totalChildren })}</AppText>}
    <TabBar<AttendanceStatusFilter>
      accessibilityLabel={t("attendance.title")}
      selected={statusFilter}
      onSelect={setStatusFilter}
      items={[
        { key: "ALL", label: t("attendance.filterAll"), count: counts.ALL },
        { key: "NOT_YET", label: statusLabels.NOT_YET, count: counts.NOT_YET },
        { key: "PRESENT", label: statusLabels.PRESENT, count: counts.PRESENT },
        { key: "LEFT", label: statusLabels.LEFT, count: counts.LEFT },
      ]}
    />
    <View style={styles.searchRow}>
      <SearchField containerStyle={styles.grow} accessibilityLabel={t("attendance.searchChild")} placeholder={t("attendance.searchChild")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
      {isStaffAdmin && <Button variant={hasChildFilter ? "primary" : "secondary"} accessibilityLabel={t(hasChildFilter ? "children.filterActive" : "children.filter")} leadingIcon={<Ionicons name="options-outline" size={18} color={hasChildFilter ? colors.onPrimary : colors.primary} />} onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}
    </View>
    {children.isFetching && <ShimmerList />}
    {children.isError && !children.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void children.refetch()} />}
    {!children.isFetching && !children.isError && totalChildren === 0 && <EmptyState icon="happy-outline" title={t("children.empty")} />}
    {!children.isFetching && !children.isError && totalChildren > 0 && visibleChildren.length === 0 && <EmptyState compact icon="search-outline" title={t("common.noResults")} action={{ label: t("attendance.resetFilter"), onPress: () => { setSearch(""); setStatusFilter("ALL"); } }} />}
    {!children.isFetching && visibleChildren.map((child) => {
      const status = attendanceStatus(child);
      const allowedActions = child.attendanceContext?.allowedActions ?? [];
      return <Card key={child.id}>
        <View style={styles.cardHeader}>
          <Avatar name={child.fullName} />
          <View style={styles.grow}>
            <AppText variant="h6">{child.fullName}</AppText>
            <AppText variant="caption" tone="muted">{t("attendance.checkInTime")}: {child.todayCheckedInAt ? formatTime(child.todayCheckedInAt) : "—"} · {t("attendance.checkOutTime")}: {child.todayCheckedOutAt ? formatTime(child.todayCheckedOutAt) : "—"}</AppText>
          </View>
          <Badge tone={statusTones[status]} icon={statusIcons[status]} label={statusLabels[status]} />
        </View>
        {!readOnly && <View style={styles.actions}>
          <Button style={styles.grow} leadingIcon={<Ionicons name="log-in-outline" size={18} color={allowedActions.includes("CHECK_IN") ? colors.onPrimary : colors.muted} />} disabled={record.isPending || !allowedActions.includes("CHECK_IN")} onPress={() => openConfirm(child, "CHECK_IN")}>{t("attendance.checkIn")}</Button>
          <Button style={styles.grow} variant="secondary" leadingIcon={<Ionicons name="log-out-outline" size={18} color={allowedActions.includes("CHECK_OUT") ? colors.primary : colors.muted} />} disabled={record.isPending || !allowedActions.includes("CHECK_OUT")} onPress={() => openConfirm(child, "CHECK_OUT")}>{t("attendance.checkOut")}</Button>
        </View>}
        {!readOnly && child.attendanceContext?.unavailableReason && <AppText variant="caption" tone="muted">{child.attendanceContext.unavailableReason}</AppText>}
      </Card>;
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
      {confirm?.action === "CHECK_OUT" && <View style={styles.pickupSection}>
        <AppText variant="label">{t("pickup.title")}</AppText>
        {pickupAuthorizations.isFetching && <ShimmerList variant="row" count={1} />}
        <ChipGroup accessibilityLabel={t("pickup.title")}>{pickupAuthorizations.data?.filter((item) => item.status === "ACTIVE").map((item) => <Chip key={item.id} label={`${item.pickupPersonName} · ${item.relationship}`} selected={pickupAuthorizationId === item.id} onPress={() => { setPickupAuthorizationId(item.id); setPickupExceptionReason(""); }} />)}</ChipGroup>
        {!pickupAuthorizations.isFetching && !pickupAuthorizations.data?.some((item) => item.status === "ACTIVE") && <AppText variant="bodySmall" tone="muted">{t("pickup.empty")}</AppText>}
        {!isStaffAdmin && !pickupAuthorizationId && <Banner tone="warning" title={t("pickup.exceptionOnlyAdmin")} />}
        {isStaffAdmin && !pickupAuthorizationId && <TextField label={t("pickup.exception")} placeholder={t("pickup.exceptionReason")} value={pickupExceptionReason} onChangeText={setPickupExceptionReason} multiline />}
      </View>}
      <View style={styles.timeField}>
        <AppText variant="label">{t("attendance.time")}</AppText>
        <DatePicker mode="time" value={time} onChange={setTime} placeholder={t("attendance.time")} />
      </View>
    </BottomSheet>
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}
const styles = StyleSheet.create({
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  timeField: { gap: spacing.xs },
  pickupSection: { gap: spacing.sm },
});
