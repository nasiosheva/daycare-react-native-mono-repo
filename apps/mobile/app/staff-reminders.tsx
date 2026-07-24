import { Alert, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import type { StaffReminder } from "@daycare/api-client";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { staffReminderQueryKey, useStaffReminders } from "@/reminders/useStaffReminders";

const weekdayKeys = ["reminders.monday", "reminders.tuesday", "reminders.wednesday", "reminders.thursday", "reminders.friday", "reminders.saturday", "reminders.sunday"] as const;

export default function StaffRemindersScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF" && membership.active;
  const reminders = useStaffReminders(membership?.role === "STAFF");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: staffReminderQueryKey(organizationId) });
  const setActive = useMutation({ mutationFn: ({ reminderId, active }: { reminderId: string; active: boolean }) => api.setStaffReminderActive(reminderId, active), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.deleteStaffReminder.bind(api), onSuccess: refresh });
  if (!profile) return null;
  if (membership?.role !== "STAFF") return <Redirect href="/home" />;

  const toggle = (reminder: StaffReminder) => void setActive.mutateAsync({ reminderId: reminder.id, active: !reminder.active }).catch((error: unknown) => Alert.alert(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  const deleteReminder = (reminder: StaffReminder) => Alert.alert(t("reminders.deleteTitle"), t("reminders.deleteDescription"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("reminders.delete"), style: "destructive", onPress: () => void remove.mutateAsync(reminder.id).catch((error: unknown) => Alert.alert(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))) }]);

  return <AppScreen showBottomNavigation={false} title={t("reminders.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("reminders.subtitle")}</AppText>
    {Platform.OS === "web" && <View style={styles.warning}><AppText variant="caption" tone="danger">{t("reminders.webWarning")}</AppText></View>}
    {canManage && <Button onPress={() => router.push("/staff-reminder-editor")}>{t("reminders.add")}</Button>}
    {reminders.isLoading && <AppText tone="muted">{t("common.loading")}</AppText>}
    {reminders.isError && <Button variant="secondary" onPress={() => reminders.refetch()}>{t("common.retry")}</Button>}
    {reminders.data?.map((reminder) => <View key={reminder.id} style={[styles.card, !reminder.active && styles.inactive]}>
      <AppText variant="heading">{reminder.title}</AppText>
      <AppText>{reminder.description}</AppText>
      <AppText tone="muted">{formatTime(reminder)} · {reminder.weekdays.map((day) => t(weekdayKeys[day - 1])).join(", ")}</AppText>
      <AppText variant="caption" tone="muted">{t(reminderTargetKey(reminder.target))}</AppText>
      <AppText variant="caption" tone={reminder.active ? "default" : "muted"}>{t(reminder.active ? "reminders.active" : "reminders.inactive")}</AppText>
      {canManage && <View style={styles.actions}><Button variant="secondary" onPress={() => router.push({ pathname: "/staff-reminder-editor", params: { reminderId: reminder.id } })}>{t("common.edit")}</Button><Button variant="secondary" loading={setActive.isPending} onPress={() => toggle(reminder)}>{t(reminder.active ? "reminders.pause" : "reminders.activate")}</Button><Button variant="danger" loading={remove.isPending} onPress={() => deleteReminder(reminder)}>{t("reminders.delete")}</Button></View>}
    </View>)}
    {!reminders.isLoading && reminders.data?.length === 0 && <AppText tone="muted">{t("reminders.empty")}</AppText>}
  </AppScreen>;
}

function formatTime(reminder: StaffReminder): string { return `${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`; }
function reminderTargetKey(target: StaffReminder["target"]): TranslationKey { return `reminders.target.${target}` as TranslationKey; }

const styles = StyleSheet.create({ card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, inactive: { opacity: 0.65 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, warning: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surfaceTint } });
