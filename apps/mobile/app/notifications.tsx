import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PushNotificationMuteDuration } from "@daycare/api-client";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { getDeviceInstallationId } from "@/device/installationId";
import { notificationMuteDurationKeys, notificationMuteDurations, notificationPreferenceQueryKey } from "@/notifications/mutePreferences";
import { browserNotificationMutedUntil, muteBrowserNotifications, requestBrowserNotificationPermission, unmuteBrowserNotifications } from "../src/notifications/browserNotifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const { api, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const client = useQueryClient();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [selectedMuteDuration, setSelectedMuteDuration] = useState<PushNotificationMuteDuration | null | undefined>(undefined);
  const [browserMutedUntil, setBrowserMutedUntil] = useState<string | undefined>(() => browserNotificationMutedUntil());
  const isNative = Platform.OS !== "web";
  const notifications = useQuery({ queryKey: ["notifications", organizationId], queryFn: () => api.notifications(), enabled: Boolean(organizationId) });
  const notificationPreference = useQuery({ queryKey: notificationPreferenceQueryKey(organizationId), queryFn: async () => api.deviceNotificationPreference(await getDeviceInstallationId()), enabled: isNative && Boolean(organizationId) });
  const markRead = useMutation({ mutationFn: api.markNotificationRead.bind(api), onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications", organizationId] }) });
  const updatePreference = useMutation({ mutationFn: async (muteDuration: PushNotificationMuteDuration | null) => api.updateDeviceNotificationPreference({ installationId: await getDeviceInstallationId(), muteDuration }), onSuccess: () => { void client.invalidateQueries({ queryKey: notificationPreferenceQueryKey(organizationId) }); setSettingsVisible(false); } });

  const open = async (id: string, actionPath?: string | null) => {
    try { await markRead.mutateAsync(id); }
    finally { if (actionPath?.startsWith("/")) router.push(actionPath as never); }
  };
  const updateMutePreference = async (muteDuration: PushNotificationMuteDuration | null) => {
    if (!isNative) {
      if (muteDuration) {
        const mutedUntil = muteBrowserNotifications(muteDuration);
        if (!mutedUntil) {
          Alert.alert(t("notifications.saveFailed"));
          return;
        }
        setBrowserMutedUntil(mutedUntil);
      }
      else { unmuteBrowserNotifications(); setBrowserMutedUntil(undefined); void requestBrowserNotificationPermission(); }
      setSettingsVisible(false);
      return;
    }
    try { await updatePreference.mutateAsync(muteDuration); }
    catch (error) { Alert.alert(t("notifications.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
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
    <NavigationCard accessibilityLabel={t("notifications.title")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("notifications.title")}</AppText>
      <AppText tone={unreadCount > 0 ? "default" : "muted"}>{notifications.isLoading ? t("notifications.loading") : notifications.data?.length ? (unreadCount > 0 ? t("notifications.unreadSummary", { count: unreadCount }) : t("notifications.allRead")) : t("notifications.empty")}</AppText>
    </NavigationCard>
    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("notifications.title")}>
      {notifications.isLoading && <AppText>{t("notifications.loading")}</AppText>}
      {notifications.isError && <Button variant="secondary" onPress={() => notifications.refetch()}>{t("common.retry")}</Button>}
      {notifications.data?.map((item) => <View key={item.id} style={[styles.card, !item.readAt && styles.unread]}>
        <AppText variant="h5">{item.title}</AppText>
        <AppText>{item.body}</AppText>
        <AppText variant="caption" tone="muted">{formatDateTime(item.createdAt)}</AppText>
        {!item.readAt && <Button variant="secondary" loading={markRead.isPending} onPress={() => void open(item.id, item.actionPath)}>{t(item.actionPath ? "notifications.open" : "notifications.markRead")}</Button>}
        {item.readAt && item.actionPath && <Button variant="secondary" onPress={() => router.push(item.actionPath as never)}>{t("notifications.open")}</Button>}
      </View>)}
      {!notifications.isLoading && notifications.data?.length === 0 && <AppText tone="muted">{t("notifications.empty")}</AppText>}
    </BottomSheet>
    <BottomSheet visible={settingsVisible} onClose={closeSettings} closeAccessibilityLabel={t("common.close")} title={t("notifications.settings")} negativeAction={{ label: t("common.close"), onPress: closeSettings }} positiveAction={{ label: t("notifications.apply"), loading: updatePreference.isPending, disabled: selectedMuteDuration === undefined, onPress: applyMutePreference }}>
      <AppText tone="muted">{t("notifications.muteDescription")}</AppText>
      {mutedUntil && <AppText tone="muted">{t("notifications.mutedUntil", { date: formatDateTime(mutedUntil) })}</AppText>}
      <View style={styles.options}>{notificationMuteDurations.map((duration) => <Button key={duration} variant={selectedMuteDuration === duration ? "primary" : "secondary"} onPress={() => setSelectedMuteDuration(duration)}>{t(notificationMuteDurationKeys[duration])}</Button>)}</View>
      {mutedUntil && <Button variant={selectedMuteDuration === null ? "primary" : "secondary"} onPress={() => setSelectedMuteDuration(null)}>{t("notifications.turnOn")}</Button>}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unread: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  settingsButton: { padding: spacing.xs, borderRadius: radius.pill },
  settingsButtonPressed: { opacity: 0.76, backgroundColor: colors.surfaceTint },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
