import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BranchOperatingHours, ParentChildOperatingHours, PushNotificationMuteDuration } from "@daycare/api-client";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, BackButton, Banner, BottomSheet, Button, Chip, ChipGroup, EmptyState, ErrorState, SearchField, ShimmerList, ToggleSwitch, colors, radius, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { getDeviceInstallationId } from "@/device/installationId";
import { deviceNotificationPreferenceQuery } from "@/notifications/deviceNotificationPreference";
import { inboxNotificationScope } from "@/notifications/inboxLocalNotificationPolicy";
import { useLocalNotificationScope } from "@/notifications/useLocalNotificationScope";
import { notificationMuteDurationKeys, notificationMuteDurations, notificationPreferenceQueryKey } from "@/notifications/mutePreferences";
import { browserNotificationMutedUntil, muteBrowserNotifications, requestBrowserNotificationPermission, unmuteBrowserNotifications } from "../src/notifications/browserNotifications";
import { canOpenNotificationRoute, isSelfServiceNotificationRoute, notificationRouteRequiresDaycareCapability, notificationRouteWithOrganizationId } from "@/navigation/notificationRouteAccess";
import { hasOfferingCapability } from "@/education/useUiAccessContext";
import { useInboxNotifications } from "@/notifications/useInboxNotifications";
import { pendingActionState } from "@/ui/pendingAction";
import type { NotificationWithTenant } from "@/notifications/inboxTenants";
import { nativeNotificationPlatform, registerNativePushDevice, requestNativeNotificationPermission, type NativeNotificationPermission } from "@/notifications/nativePush";
import { hasOperationalTenantSubscription } from "@/auth/tenantSubscription";
import { loadOperationalCloseReminderEnabled, saveOperationalCloseReminderEnabled } from "@/reminders/operationalCloseReminderPreference";
import { cancelOperationalCloseReminderSchedules, reconcileOperationalCloseReminderSchedules } from "@/reminders/operationalCloseReminderScheduler";
import type { OperationalCloseReminderSource } from "@/reminders/operationalCloseReminder";

export default function NotificationsScreen() {
  const router = useRouter();
  const { api, organizationId, profile } = useAuth();
  const { t, formatDateTime } = useI18n();
  const client = useQueryClient();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => setPage(0), [debouncedSearch]);
  const [selectedMuteDuration, setSelectedMuteDuration] = useState<PushNotificationMuteDuration | null | undefined>(undefined);
  const [selectedOperationalCloseReminder, setSelectedOperationalCloseReminder] = useState<boolean | undefined>(undefined);
  const [operationalCloseReminderEnabled, setOperationalCloseReminderEnabled] = useState<boolean | null>(null);
  const [nativePermission, setNativePermission] = useState<NativeNotificationPermission | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [browserMutedUntil, setBrowserMutedUntil] = useState<string | undefined>(() => browserNotificationMutedUntil());
  const isNative = nativeNotificationPlatform() !== null;
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const subscriptionActive = hasOperationalTenantSubscription(membership?.subscriptionStatus);
  const isParent = profile?.registrationRole === "PARENT" || profile?.memberships.some((item) => item.role === "PARENT" && item.active) === true;
  const isStaffAdmin = membership?.role === "STAFF_ADMIN" && membership.active === true;
  const operationalCloseReminderSupported = isNative && (isParent || isStaffAdmin);
  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    const requestNativePermission = async () => {
      try {
        const requested = await requestNativeNotificationPermission();
        if (!cancelled && requested) {
          setNativePermission(requested);
          console.info(`[notifications] Native permission status: ${requested.status}`);
          if (requested.status === "granted" && organizationId && profile && subscriptionActive) {
            await registerNativePushDevice(api, requested);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[notifications] Native permission request failed: ${message}`);
      }
    };
    void requestNativePermission();
    return () => { cancelled = true; };
  }, [api, isNative, organizationId, profile, subscriptionActive]);
  useEffect(() => {
    if (!operationalCloseReminderSupported) {
      setOperationalCloseReminderEnabled(null);
      return;
    }
    let cancelled = false;
    void loadOperationalCloseReminderEnabled().then((enabled) => {
      if (!cancelled) setOperationalCloseReminderEnabled(enabled);
    });
    return () => { cancelled = true; };
  }, [operationalCloseReminderSupported]);
  // A Parent sees one merged inbox across every Parent tenant (docs/business-rules.md §8); every
  // mark-read and opened action below uses the notification's own tenant, not the active one.
  const inbox = useInboxNotifications(debouncedSearch, page);
  const notificationPreference = useQuery({ ...deviceNotificationPreferenceQuery(api, organizationId), enabled: isNative && Boolean(organizationId) });
  const parentOperatingHours = useQuery({
    queryKey: ["operational-close-reminder-parent-hours", profile?.id],
    queryFn: () => api.parentOperatingHoursAllTenants(),
    enabled: operationalCloseReminderSupported && isParent,
    staleTime: 5 * 60 * 1000,
  });
  const staffOperatingHours = useQuery({
    queryKey: ["operational-close-reminder-staff-hours", organizationId],
    queryFn: async () => {
      const branches = await api.branches();
      const results = await Promise.allSettled(branches.filter((branch) => branch.active).map((branch) => api.branchOperatingHours(branch.id)));
      return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    },
    enabled: operationalCloseReminderSupported && isStaffAdmin && Boolean(organizationId) && subscriptionActive,
    staleTime: 5 * 60 * 1000,
  });
  const operationalCloseReminderSources = useMemo<OperationalCloseReminderSource[]>(() => {
    const parentSources: ParentChildOperatingHours[] = parentOperatingHours.data ?? [];
    const staffSources: BranchOperatingHours[] = staffOperatingHours.data ?? [];
    const raw = isParent ? parentSources : staffSources;
    const unique = new Map<string, OperationalCloseReminderSource>();
    for (const source of raw) {
      if (!unique.has(source.branchId)) unique.set(source.branchId, { branchId: source.branchId, branchName: source.branchName, timezone: source.timezone, hours: source.hours });
    }
    return [...unique.values()];
  }, [isParent, parentOperatingHours.data, staffOperatingHours.data]);
  const operationalCloseReminderSourcesReady = operationalCloseReminderSupported && (isParent ? !parentOperatingHours.isPending && !parentOperatingHours.isError : !staffOperatingHours.isPending && !staffOperatingHours.isError);
  useEffect(() => {
    if (!operationalCloseReminderSourcesReady || operationalCloseReminderEnabled == null || nativePermission?.status !== "granted") return;
    const operation = operationalCloseReminderEnabled
      ? reconcileOperationalCloseReminderSchedules(operationalCloseReminderSources, nativePermission, ({ branchName, closesAt }) => ({ title: t("notifications.operationalCloseReminderTitle"), body: t("notifications.operationalCloseReminderBody", { branch: branchName, time: closesAt }) }))
      : cancelOperationalCloseReminderSchedules();
    void operation.catch((error: unknown) => console.warn(`[notifications] operational close reminder sync failed: ${error instanceof Error ? error.message : String(error)}`));
  }, [nativePermission?.status, operationalCloseReminderEnabled, operationalCloseReminderSources, operationalCloseReminderSourcesReady, t]);
  useLocalNotificationScope(inboxNotificationScope);
  const markRead = useMutation({ mutationFn: (item: NotificationWithTenant) => api.markNotificationRead(item.id, item.organizationId), onSuccess: (_, item) => void client.invalidateQueries({ queryKey: ["notifications", item.organizationId] }) });
  const markAllRead = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(inbox.tenants.map((tenant) => api.markAllNotificationsRead(tenant.organizationId)));
      if (results.some((result) => result.status === "rejected")) throw new Error(t("notifications.markAllReadFailed"));
    },
    onSettled: () => inbox.tenants.forEach((tenant) => { void client.invalidateQueries({ queryKey: ["notifications", tenant.organizationId] }); }),
  });
  const updatePreference = useMutation({ mutationFn: async (muteDuration: PushNotificationMuteDuration | null) => api.updateDeviceNotificationPreference({ installationId: await getDeviceInstallationId(), muteDuration }), onSuccess: () => { void client.invalidateQueries({ queryKey: notificationPreferenceQueryKey(organizationId) }); } });

  // The action path is re-validated against the notification's own tenant on every open
  // (§13.14), including a fresh capability read for that tenant; a failed read fails closed.
  const tenantHasDaycareOperations = async (tenantId: string) => {
    try {
      const context = await client.fetchQuery({ queryKey: ["ui-access-context", tenantId], queryFn: () => api.uiAccessContext(tenantId) });
      return hasOfferingCapability(context, "DAYCARE_OPERATIONS");
    } catch {
      return false;
    }
  };
  const openAction = async (item: NotificationWithTenant) => {
    const actionPath = item.actionPath;
    if (!actionPath) return;
    const targetOrganizationId = isSelfServiceNotificationRoute(actionPath) ? null : item.organizationId;
    const hasDaycareOperations = targetOrganizationId && notificationRouteRequiresDaycareCapability(actionPath) ? await tenantHasDaycareOperations(targetOrganizationId) : false;
    if (!canOpenNotificationRoute(profile, targetOrganizationId, actionPath, hasDaycareOperations, organizationId)) return;
    router.push(notificationRouteWithOrganizationId(actionPath, item.organizationId) as never);
  };
  const open = async (item: NotificationWithTenant) => {
    try { await markRead.mutateAsync(item); }
    finally { await openAction(item); }
  };
  const updateMutePreference = async (muteDuration: PushNotificationMuteDuration | null) => {
    if (!isNative) {
      if (muteDuration) {
        const mutedUntil = muteBrowserNotifications(muteDuration);
        if (!mutedUntil) throw new Error(t("notifications.saveFailed"));
        setBrowserMutedUntil(mutedUntil);
      }
      else { unmuteBrowserNotifications(); setBrowserMutedUntil(undefined); void requestBrowserNotificationPermission(); }
      return;
    }
    await updatePreference.mutateAsync(muteDuration);
  };

  const mutedUntil = isNative ? notificationPreference.data?.pushMutedUntil : browserMutedUntil;

  const openSettings = () => {
    setSelectedMuteDuration(undefined);
    setSelectedOperationalCloseReminder(operationalCloseReminderEnabled ?? true);
    setSettingsVisible(true);
  };
  const closeSettings = () => {
    setSelectedMuteDuration(undefined);
    setSelectedOperationalCloseReminder(undefined);
    setSettingsVisible(false);
  };
  const operationalCloseReminderChanged = selectedOperationalCloseReminder !== undefined && operationalCloseReminderEnabled != null && selectedOperationalCloseReminder !== operationalCloseReminderEnabled;
  const settingsChanged = selectedMuteDuration !== undefined || operationalCloseReminderChanged;
  const applyNotificationSettings = () => {
    if (!settingsChanged) return;
    void (async () => {
      setSavingSettings(true);
      try {
        if (operationalCloseReminderChanged && selectedOperationalCloseReminder !== undefined) {
          await saveOperationalCloseReminderEnabled(selectedOperationalCloseReminder);
          setOperationalCloseReminderEnabled(selectedOperationalCloseReminder);
        }
        if (selectedMuteDuration !== undefined) await updateMutePreference(selectedMuteDuration);
        closeSettings();
      }
      catch (error) {
        notify(t("notifications.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger");
      }
      finally { setSavingSettings(false); }
    })();
  };

  const markAll = () => {
    void markAllRead.mutateAsync().catch((error: unknown) => {
      notify(t("notifications.markAllReadFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger");
    });
  };

  const failedTenantNames = inbox.failedTenants.map((tenant) => tenant.organizationName).join(", ");
  const showInitialLoading = inbox.isFetching && inbox.data.length === 0;

  return <AppScreen showBottomNavigation={false} title={t("notifications.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} headerAction={<Pressable accessibilityRole="button" accessibilityLabel={t("notifications.settings")} hitSlop={spacing.sm} onPress={openSettings} style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}><Ionicons name="settings-outline" size={24} color={colors.primary} /></Pressable>}>
    <SearchField accessibilityLabel={t("notifications.search")} placeholder={t("notifications.search")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
    {mutedUntil && <Banner tone="info" title={t("notifications.mutedUntil", { date: formatDateTime(mutedUntil) })} action={<Button variant="secondary" onPress={openSettings}>{t("notifications.settings")}</Button>} />}
    {!showInitialLoading && (inbox.totalCount > 0 || inbox.unreadCount > 0) && <View style={styles.summaryRow}>
      <AppText variant="label" tone={inbox.unreadCount > 0 ? "default" : "muted"}>{inbox.unreadCount > 0 ? t("notifications.unreadSummary", { count: inbox.unreadCount }) : t("notifications.allRead")}</AppText>
      {inbox.unreadCount > 0 && <Button variant="ghost" loading={markAllRead.isPending} disabled={markAllRead.isPending} onPress={markAll}>{t("notifications.markAllRead")}</Button>}
    </View>}
    {inbox.allFailed && !inbox.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={inbox.retryFailed} />}
    {!inbox.allFailed && inbox.failedTenants.length > 0 && !inbox.isFetching && <Banner tone="warning" title={t("notifications.tenantLoadFailed", { tenants: failedTenantNames })} action={<Button variant="secondary" onPress={inbox.retryFailed}>{t("common.retry")}</Button>} />}
    {showInitialLoading ? <ShimmerList /> : inbox.data.map((item) => <View key={item.id} style={[styles.card, !item.readAt && styles.unread]}>
      <View style={styles.cardHeader}>
        <View style={[styles.icon, !item.readAt && styles.iconUnread]}><Ionicons name={item.readAt ? "notifications-outline" : "notifications"} size={18} color={item.readAt ? colors.muted : colors.onPrimary} /></View>
        <View style={styles.grow}>
          <AppText variant="h6">{item.title}</AppText>
          <AppText variant="caption" tone="muted">{inbox.showsTenantLabel ? `${formatDateTime(item.createdAt)} · ${item.organizationName}` : formatDateTime(item.createdAt)}</AppText>
        </View>
        {!item.readAt && <View accessibilityLabel={t("notifications.unread")} style={styles.dot} />}
      </View>
      <AppText>{item.body}</AppText>
      {!item.readAt && <Button variant={item.actionPath ? "primary" : "secondary"} {...pendingActionState(markRead, (pending) => pending.id === item.id)} onPress={() => void open(item)}>{t(item.actionPath ? "notifications.open" : "notifications.markRead")}</Button>}
      {item.readAt && item.actionPath && <Button variant="ghost" onPress={() => void openAction(item)}>{t("notifications.open")}</Button>}
    </View>)}
    {!inbox.isFetching && inbox.failedTenants.length === 0 && inbox.data.length === 0 && <EmptyState icon="notifications-off-outline" title={debouncedSearch ? t("common.noResults") : t("notifications.empty")} />}
    {!inbox.isFetching && !inbox.allFailed && (page > 0 || inbox.hasNext) && <View style={styles.pagination}>
      <Button variant="secondary" disabled={page === 0} onPress={() => setPage((current) => Math.max(0, current - 1))}>{t("notifications.previousPage")}</Button>
      <AppText variant="label" tone="muted">{t("notifications.page", { page: page + 1 })}</AppText>
      <Button variant="secondary" disabled={!inbox.hasNext} onPress={() => setPage((current) => current + 1)}>{t("notifications.nextPage")}</Button>
    </View>}
    <BottomSheet visible={settingsVisible} onClose={closeSettings} closeAccessibilityLabel={t("common.close")} title={t("notifications.settings")} negativeAction={{ label: t("common.close"), onPress: closeSettings }} positiveAction={{ label: t("notifications.apply"), loading: savingSettings, disabled: !settingsChanged, onPress: applyNotificationSettings }}>
      <AppText tone="muted">{t("notifications.muteDescription")}</AppText>
      {mutedUntil && <Banner tone="info" title={t("notifications.mutedUntil", { date: formatDateTime(mutedUntil) })} />}
      <ChipGroup>{notificationMuteDurations.map((duration) => <Chip key={duration} label={t(notificationMuteDurationKeys[duration])} selected={selectedMuteDuration === duration} onPress={() => setSelectedMuteDuration(duration)} />)}{mutedUntil && <Chip label={t("notifications.turnOn")} selected={selectedMuteDuration === null} onPress={() => setSelectedMuteDuration(null)} />}</ChipGroup>
      {operationalCloseReminderSupported && operationalCloseReminderEnabled != null && <View style={styles.settingsSection}>
        <ToggleSwitch
          label={t("notifications.operationalCloseReminderLabel")}
          description={t("notifications.operationalCloseReminderDescription")}
          accessibilityLabel={t("notifications.operationalCloseReminderLabel")}
          value={selectedOperationalCloseReminder ?? operationalCloseReminderEnabled}
          onValueChange={setSelectedOperationalCloseReminder}
          disabled={savingSettings}
        />
        {nativePermission != null && nativePermission.status !== "granted" && <AppText variant="caption" tone="muted">{t("notifications.operationalCloseReminderPermission")}</AppText>}
      </View>}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  settingsSection: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unread: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  grow: { flex: 1 },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.disabled },
  iconUnread: { backgroundColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.danger },
  settingsButton: { padding: spacing.xs, borderRadius: radius.pill },
  settingsButtonPressed: { opacity: 0.76, backgroundColor: colors.surfaceTint },
});
