// Mories Deo Hutapea,S.E.,S.Kom
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, Avatar, Badge, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, SearchField, ShimmerList, TabBar, TextField, colors, spacing, type Tone } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { hasLegacyDaycareRouteAccess, legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";
import { useChildren, useCreatePickupExceptionRequest, usePickupExceptionRequests, useRecordAttendance } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { dateFromIsoTime, formatIsoTime } from "@/date-picker/date";
import { attendanceAction, attendanceStatus, filterRoster, rosterCounts, type AttendanceStatus, type AttendanceStatusFilter } from "@/attendance/attendanceRoster";
import { notify } from "@/notify/notify";

const statusTones: Record<AttendanceStatus, Tone> = { NOT_YET: "neutral", PRESENT: "success", LEFT: "info" };
const statusIcons = { NOT_YET: "time-outline", PRESENT: "checkmark-circle", LEFT: "home-outline" } as const;

type ConfirmState = { childId: string; childName: string; action: "CHECK_IN" | "CHECK_OUT" };

export default function AttendanceScreen() {
  const { profile, organizationId } = useAuth();
  if (!profile) return null;
  if (!hasLegacyDaycareRouteAccess(profile, organizationId, legacyDaycareRoutePolicies.attendance, false)) return <Redirect href="/home" />;
  return <AttendanceScreenContent />;
}

function AttendanceScreenContent() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatTime } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const readOnly = membership?.active === false;
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>("ALL");
  const [time, setTime] = useState("");
  const [timeEditable, setTimeEditable] = useState(false);
  const [pickupAuthorizationId, setPickupAuthorizationId] = useState<string | null>(null);
  const [pickupExceptionRequestId, setPickupExceptionRequestId] = useState<string | null>(null);
  const [pickupPersonName, setPickupPersonName] = useState("");
  const [pickupRelationship, setPickupRelationship] = useState("");
  const [pickupExceptionReason, setPickupExceptionReason] = useState("");
  const children = useChildren({});
  const confirmedChild = children.data?.find((child) => child.id === confirm?.childId);
  const requiresPickupAuthorization = confirm?.action === "CHECK_OUT" && confirmedChild?.attendanceContext?.attendancePolicy === "DAYCARE_BOOKING_REQUIRED";
  const record = useRecordAttendance();
  const createPickupException = useCreatePickupExceptionRequest();
  const pickupAuthorizations = useQuery({ queryKey: ["pickup-authorizations", organizationId, confirm?.childId], queryFn: () => api.pickupAuthorizations(confirm!.childId), enabled: Boolean(confirm?.childId && requiresPickupAuthorization) });
  const pickupExceptionRequests = usePickupExceptionRequests(confirm?.childId ?? null, Boolean(requiresPickupAuthorization));
  const now = Date.now();
  const activePickupAuthorizations = pickupAuthorizations.data?.filter((item) => item.status === "ACTIVE" && new Date(item.effectiveFrom).getTime() <= now && (!item.effectiveUntil || new Date(item.effectiveUntil).getTime() > now)) ?? [];
  const approvedPickupExceptions = pickupExceptionRequests.data?.filter((item) => item.status === "APPROVED" && item.approvalExpiresAt && new Date(item.approvalExpiresAt).getTime() > Date.now()) ?? [];
  const selectedPickupAuthorized = Boolean(pickupAuthorizationId && activePickupAuthorizations.some((item) => item.id === pickupAuthorizationId));
  const selectedPickupException = Boolean(pickupExceptionRequestId && approvedPickupExceptions.some((item) => item.id === pickupExceptionRequestId));
  const pickupSelectionReady = !requiresPickupAuthorization || (pickupAuthorizations.isSuccess && pickupExceptionRequests.isSuccess && !pickupAuthorizations.isFetching && !pickupExceptionRequests.isFetching && (selectedPickupAuthorized || selectedPickupException));
  const totalChildren = children.data?.length ?? 0;
  const counts = useMemo(() => rosterCounts(children.data ?? []), [children.data]);
  const visibleChildren = useMemo(() => filterRoster(children.data ?? [], search, statusFilter), [children.data, search, statusFilter]);
  const statusLabels: Record<AttendanceStatus, string> = { NOT_YET: t("attendance.statusNotYet"), PRESENT: t("attendance.statusCheckedIn"), LEFT: t("attendance.statusCheckedOut") };
  const confirmLabel = confirm?.action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut");
  const openConfirm = (child: { id: string; fullName: string }, action: "CHECK_IN" | "CHECK_OUT") => {
    setTime(formatIsoTime(new Date()));
    setTimeEditable(false);
    setPickupAuthorizationId(null);
    setPickupExceptionRequestId(null);
    setPickupPersonName("");
    setPickupRelationship("");
    setPickupExceptionReason("");
    setConfirm({ childId: child.id, childName: child.fullName, action });
  };
  const submit = async () => {
    if (!confirm) return;
    if (confirm.action === "CHECK_OUT" && !pickupSelectionReady) return;
    const actionLabel = confirm.action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut");
    try {
      await record.mutateAsync({ childId: confirm.childId, action: confirm.action, method: "MANUAL", at: dateFromIsoTime(time).toISOString(), pickupAuthorizationId: confirm.action === "CHECK_OUT" && selectedPickupAuthorized ? pickupAuthorizationId ?? undefined : undefined, pickupExceptionRequestId: confirm.action === "CHECK_OUT" && selectedPickupException ? pickupExceptionRequestId ?? undefined : undefined });
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
    </View>
    {children.isFetching && <ShimmerList />}
    {children.isError && !children.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void children.refetch()} />}
    {!children.isFetching && !children.isError && totalChildren === 0 && <EmptyState icon="happy-outline" title={t("children.empty")} />}
    {!children.isFetching && !children.isError && totalChildren > 0 && visibleChildren.length === 0 && <EmptyState compact icon="search-outline" title={t("common.noResults")} action={{ label: t("attendance.resetFilter"), onPress: () => { setSearch(""); setStatusFilter("ALL"); } }} />}
    {!children.isFetching && visibleChildren.map((child) => {
      const status = attendanceStatus(child);
      const nextAction = attendanceAction(status);
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
        {!readOnly && nextAction && <Button
          leadingIcon={<Ionicons name={nextAction === "CHECK_IN" ? "log-in-outline" : "log-out-outline"} size={18} color={allowedActions.includes(nextAction) ? colors.onPrimary : colors.muted} />}
          disabled={record.isPending || !allowedActions.includes(nextAction)}
          onPress={() => openConfirm(child, nextAction)}
        >{t(nextAction === "CHECK_IN" ? "attendance.checkIn" : "attendance.checkOut")}</Button>}
        {!readOnly && child.attendanceContext?.unavailableReason && <AppText variant="caption" tone="muted">{child.attendanceContext.unavailableReason}</AppText>}
      </Card>;
    })}
    <BottomSheet
      visible={confirm !== null}
      onClose={() => setConfirm(null)}
      closeAccessibilityLabel={t("common.close")}
      title={t("attendance.confirmTitle")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setConfirm(null) }}
      positiveAction={{ label: confirmLabel, loading: record.isPending, disabled: confirm?.action === "CHECK_OUT" && !pickupSelectionReady, onPress: () => void submit() }}
    >
      {confirm && <AppText>{t("attendance.confirmMessage", { action: confirmLabel, name: confirm.childName })}</AppText>}
      {requiresPickupAuthorization && <View style={styles.pickupSection}>
        <AppText variant="label">{t("pickup.title")}</AppText>
        {pickupAuthorizations.isFetching && <ShimmerList variant="row" count={1} />}
        <ChipGroup accessibilityLabel={t("pickup.title")}>
          {activePickupAuthorizations.map((item) => <Chip key={item.id} label={`${item.pickupPersonName} · ${item.relationship}`} selected={pickupAuthorizationId === item.id && !pickupExceptionRequestId} onPress={() => { setPickupAuthorizationId(item.id); setPickupExceptionRequestId(null); }} />)}
          {approvedPickupExceptions.map((request) => <Chip key={request.id} label={t("pickupException.approvedGrant", { name: request.pickupPersonName })} selected={pickupExceptionRequestId === request.id} onPress={() => { setPickupExceptionRequestId(request.id); setPickupAuthorizationId(null); }} />)}
        </ChipGroup>
        {pickupAuthorizations.isSuccess && !pickupAuthorizations.isFetching && activePickupAuthorizations.length === 0 && <AppText variant="bodySmall" tone="muted">{t("pickupException.noAuthorization")}</AppText>}
        {pickupAuthorizations.isError && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void pickupAuthorizations.refetch()} />}
        {pickupExceptionRequests.isError && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void pickupExceptionRequests.refetch()} />}
        {pickupExceptionRequests.data?.filter((request) => request.status === "PENDING").map((request) => <Banner key={request.id} tone="warning" title={t("pickupException.waitingApproval")} message={t("pickupException.pendingExpires", { date: formatTime(request.requestExpiresAt) })} />)}
        {pickupExceptionRequests.data?.filter((request) => request.status === "REJECTED").slice(0, 1).map((request) => <Banner key={request.id} tone="danger" title={t("pickupException.rejected")} message={request.rejectionReason ?? t("pickupException.rejectedHelp")} />)}
        {pickupAuthorizations.isSuccess && pickupExceptionRequests.isSuccess && !pickupAuthorizations.isFetching && !pickupExceptionRequests.isFetching && activePickupAuthorizations.length === 0 && approvedPickupExceptions.length === 0 && <View style={styles.exceptionRequest}>
          <Banner tone="warning" title={t("pickupException.requestTitle")} message={t("pickupException.requestDescription")} />
          <TextField label={t("pickup.name")} required maxLength={160} value={pickupPersonName} onChangeText={setPickupPersonName} />
          <TextField label={t("pickup.relationship")} required maxLength={100} value={pickupRelationship} onChangeText={setPickupRelationship} />
          <TextField label={t("pickupException.staffReasonLabel")} required multiline maxLength={500} value={pickupExceptionReason} onChangeText={setPickupExceptionReason} />
          <Button variant="secondary" loading={createPickupException.isPending} disabled={createPickupException.isPending || !pickupPersonName.trim() || !pickupRelationship.trim() || !pickupExceptionReason.trim() || pickupExceptionRequests.data?.some((request) => request.status === "PENDING")} onPress={() => {
            if (!confirm) return;
            void createPickupException.mutateAsync({ childId: confirm.childId, input: { pickupPersonName, relationship: pickupRelationship, reason: pickupExceptionReason } }).then(() => {
              setPickupPersonName(""); setPickupRelationship(""); setPickupExceptionReason("");
              notify(t("pickupException.requestSent"), t("pickupException.waitingApproval"), "success");
            }).catch((error: unknown) => notify(t("pickupException.requestFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
          }}>{t("pickupException.requestApproval")}</Button>
        </View>}
      </View>}
      <View style={styles.timeField}>
        <View style={styles.timeSummary}>
          <AppText variant="label">{t("attendance.time")}: {time}</AppText>
          <Button variant="secondary" onPress={() => setTimeEditable((current) => !current)}>{t(timeEditable ? "common.ok" : "common.edit")}</Button>
        </View>
        {timeEditable && <DatePicker mode="time" value={time} onChange={setTime} placeholder={t("attendance.time")} />}
      </View>
    </BottomSheet>
  </AppScreen>;
}
const styles = StyleSheet.create({
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeField: { gap: spacing.xs },
  timeSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  pickupSection: { gap: spacing.sm },
  exceptionRequest: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
