import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PushNotificationMuteDuration } from "@daycare/api-client";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText, BackButton, Banner, BottomSheet, Button, Chip, ChipGroup, EmptyState, ErrorState, SearchField, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { getDeviceInstallationId } from "@/device/installationId";
import { notificationMuteDurationKeys, notificationMuteDurations, notificationPreferenceQueryKey } from "@/notifications/mutePreferences";
import { browserNotificationMutedUntil, muteBrowserNotifications, requestBrowserNotificationPermission, unmuteBrowserNotifications } from "../src/notifications/browserNotifications";
import { canOpenNotificationRoute, notificationRouteWithOrganizationId } from "@/navigation/notificationRouteAccess";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function NotificationsScreen() {
  const router = useRouter();
  const { api, organizationId, profile } = useAuth();
  const access = useUiAccessContext(Boolean(profile && organizationId));
  const { t, formatDateTime } = useI18n();
  const client = useQueryClient();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const [selectedMuteDuration, setSelectedMuteDuration] = useState<PushNotificationMuteDuration | null | undefined>(undefined);
  const [browserMutedUntil, setBrowserMutedUntil] = useState<string | undefined>(() => browserNotificationMutedUntil());
  const isNative = Platform.OS !== "web";
  const notifications = useQuery({ queryKey: ["notifications", organizationId, debouncedSearch], queryFn: () => api.notifications(debouncedSearch || undefined), enabled: Boolean(organizationId) });
  const notificationPreference = useQuery({ queryKey: notificationPreferenceQueryKey(organizationId), queryFn: async () => api.deviceNotificationPreference(await getDeviceInstallationId()), enabled: isNative && Boolean(organizationId) });
  const markRead = useMutation({ mutationFn: api.markNotificationRead.bind(api), onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications", organizationId] }) });
  const updatePreference = useMutation({ mutationFn: async (muteDuration: PushNotificationMuteDuration | null) => api.updateDeviceNotificationPreference({ installationId: await getDeviceInstallationId(), muteDuration }), onSuccess: () => { void client.invalidateQueries({ queryKey: notificationPreferenceQueryKey(organizationId) }); setSettingsVisible(false); } });

  const openAction = (actionPath?: string | null) => {
    if (!actionPath || !canOpenNotificationRoute(profile, organizationId, actionPath, hasOfferingCapability(access.data, "DAYCARE_OPERATIONS"))) return;
    router.push(notificationRouteWithOrganizationId(actionPath, organizationId) as never);
  };
  const open = async (id: string, actionPath?: string | null) => {
    try { await markRead.mutateAsync(id); }
    finally { openAction(actionPath); }
  };
  const updateMutePreference = async (muteDuration: PushNotificationMuteDuration | null) => {
    if (!isNative) {
      if (muteDuration) {
        const mutedUntil = muteBrowserNotifications(muteDuration);
        if (!mutedUntil) {
          notify(t("notifications.saveFailed"), undefined, "danger");
          return;
        }
        setBrowserMutedUntil(mutedUntil);
      }
      else { unmuteBrowserNotifications(); setBrowserMutedUntil(undefined); void requestBrowserNotificationPermission(); }
      setSettingsVisible(false);
      return;
    }
    try { await updatePreference.mutateAsync(muteDuration); }
    catch (error) { notify(t("notifications.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
  };

  const mutedUntil = isNative ? notificationPreference.data?.pushMutedUntil : browserMutedUntil;

  const openSettings = () => {
    setSelectedMuteDuration(undefined);
    setSettingsVisible(true);
  };
  const closeSettings = () => {
    setSelectedMuteDuration(undefined);
    setSettingsVisible(false);
  };
  const applyMutePreference = () => {
    if (selectedMuteDuration === undefined) return;
    void updateMutePreference(selectedMuteDuration);
  };

  const unreadCount = notifications.data?.filter((item) => !item.readAt).length ?? 0;

  return <AppScreen showBottomNavigation={false} title={t("notifications.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} headerAction={<Pressable accessibilityRole="button" accessibilityLabel={t("notifications.settings")} hitSlop={spacing.sm} onPress={openSettings} style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}><Ionicons name="settings-outline" size={24} color={colors.primary} /></Pressable>}>
    <SearchField accessibilityLabel={t("notifications.search")} placeholder={t("notifications.search")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
    {mutedUntil && <Banner tone="info" title={t("notifications.mutedUntil", { date: formatDateTime(mutedUntil) })} action={<Button variant="secondary" onPress={openSettings}>{t("notifications.settings")}</Button>} />}
    {!notifications.isFetching && Boolean(notifications.data?.length) && <AppText variant="label" tone={unreadCount > 0 ? "default" : "muted"}>{unreadCount > 0 ? t("notifications.unreadSummary", { count: unreadCount }) : t("notifications.allRead")}</AppText>}
    {notifications.isError && !notifications.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void notifications.refetch()} />}
    {notifications.isFetching ? <ShimmerList /> : notifications.data?.map((item) => <View key={item.id} style={[styles.card, !item.readAt && styles.unread]}>
      <View style={styles.cardHeader}>
        <View style={[styles.icon, !item.readAt && styles.iconUnread]}><Ionicons name={item.readAt ? "notifications-outline" : "notifications"} size={18} color={item.readAt ? colors.muted : colors.onPrimary} /></View>
        <View style={styles.grow}>
          <AppText variant="h6">{item.title}</AppText>
          <AppText variant="caption" tone="muted">{formatDateTime(item.createdAt)}</AppText>
        </View>
        {!item.readAt && <View accessibilityLabel={t("notifications.unread")} style={styles.dot} />}
      </View>
      <AppText>{item.body}</AppText>
      {!item.readAt && <Button variant={item.actionPath ? "primary" : "secondary"} loading={markRead.isPending} onPress={() => void open(item.id, item.actionPath)}>{t(item.actionPath ? "notifications.open" : "notifications.markRead")}</Button>}
      {item.readAt && item.actionPath && <Button variant="ghost" onPress={() => openAction(item.actionPath)}>{t("notifications.open")}</Button>}
    </View>)}
    {!notifications.isFetching && !notifications.isError && notifications.data?.length === 0 && <EmptyState icon="notifications-off-outline" title={debouncedSearch ? t("common.noResults") : t("notifications.empty")} />}
    <BottomSheet visible={settingsVisible} onClose={closeSettings} closeAccessibilityLabel={t("common.close")} title={t("notifications.settings")} negativeAction={{ label: t("common.close"), onPress: closeSettings }} positiveAction={{ label: t("notifications.apply"), loading: updatePreference.isPending, disabled: selectedMuteDuration === undefined, onPress: applyMutePreference }}>
      <AppText tone="muted">{t("notifications.muteDescription")}</AppText>
      {mutedUntil && <Banner tone="info" title={t("notifications.mutedUntil", { date: formatDateTime(mutedUntil) })} />}
      <ChipGroup>{notificationMuteDurations.map((duration) => <Chip key={duration} label={t(notificationMuteDurationKeys[duration])} selected={selectedMuteDuration === duration} onPress={() => setSelectedMuteDuration(duration)} />)}{mutedUntil && <Chip label={t("notifications.turnOn")} selected={selectedMuteDuration === null} onPress={() => setSelectedMuteDuration(null)} />}</ChipGroup>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unread: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.disabled },
  iconUnread: { backgroundColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.danger },
  settingsButton: { padding: spacing.xs, borderRadius: radius.pill },
  settingsButtonPressed: { opacity: 0.76, backgroundColor: colors.surfaceTint },
});
