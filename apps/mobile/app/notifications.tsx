import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function NotificationsScreen() {
  const router = useRouter();
  const { api, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const client = useQueryClient();
  const notifications = useQuery({ queryKey: ["notifications", organizationId], queryFn: () => api.notifications(), enabled: Boolean(organizationId) });
  const markRead = useMutation({ mutationFn: api.markNotificationRead.bind(api), onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications", organizationId] }) });

  const open = async (id: string, actionPath?: string | null) => {
    try { await markRead.mutateAsync(id); }
    finally { if (actionPath?.startsWith("/")) router.push(actionPath as never); }
  };

  return <AppScreen showBottomNavigation={false} title={t("notifications.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
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
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unread: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
});
