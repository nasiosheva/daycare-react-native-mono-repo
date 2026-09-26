import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { staffReminderTargets, type StaffReminderTarget } from "@daycare/core";
import { AppText, Badge, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, ToggleSwitch, colors, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import type { StaffReminder } from "@daycare/api-client";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { staffReminderQueryKey, useStaffReminders } from "@/reminders/useStaffReminders";
import { DatePicker } from "@/date-picker/DatePicker";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;
const weekdayKeys = ["reminders.monday", "reminders.tuesday", "reminders.wednesday", "reminders.thursday", "reminders.friday", "reminders.saturday", "reminders.sunday"] as const;

export default function StaffRemindersScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const canManage = membership?.role === "STAFF" && membership.active;
  const reminders = useStaffReminders(membership?.role === "STAFF");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: staffReminderQueryKey(organizationId) });
  const setActive = useMutation({ mutationFn: ({ reminderId, active }: { reminderId: string; active: boolean }) => api.setStaffReminderActive(reminderId, active), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.deleteStaffReminder.bind(api), onSuccess: refresh });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<StaffReminder | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("17:00");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [target, setTarget] = useState<StaffReminderTarget>("HOME");
  const targets = useMemo(() => staffReminderTargets.filter((item) => item !== "BOOKING_APPROVALS" || hasOfferingCapability(access.data, "DAYCARE_OPERATIONS")), [access.data]);

  useEffect(() => {
    if (!editingReminder) return;
    setTitle(editingReminder.title); setDescription(editingReminder.description); setTime(`${String(editingReminder.hour).padStart(2, "0")}:${String(editingReminder.minute).padStart(2, "0")}`); setSelectedWeekdays(editingReminder.weekdays); setTarget(editingReminder.target);
  }, [editingReminder]);

  const saveReminder = useMutation({
    mutationFn: () => {
      const [hour, minute] = time.split(":").map(Number);
      const input = { title: title.trim(), description: description.trim(), hour, minute, weekdays: selectedWeekdays, target };
      return editingReminder ? api.updateStaffReminder(editingReminder.id, input) : api.createStaffReminder(input);
    },
    onSuccess: () => { refresh(); closeEditor(); },
  });

  if (!profile) return null;
  if (membership?.role !== "STAFF") return <Redirect href="/home" />;

  const resetForm = () => { setTitle(""); setDescription(""); setTime("17:00"); setSelectedWeekdays([1, 2, 3, 4, 5]); setTarget("HOME"); };
  const openCreate = () => { setEditingReminder(null); resetForm(); setEditorOpen(true); };
  const openEdit = (reminder: StaffReminder) => { setEditingReminder(reminder); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setEditingReminder(null); resetForm(); };
  const toggleWeekday = (day: number) => setSelectedWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  const save = () => {
    const [hour, minute] = time.split(":").map(Number);
    if (!title.trim() || !description.trim() || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || selectedWeekdays.length === 0) return notify(t("reminders.required"), undefined, "warning");
    void saveReminder.mutateAsync().catch((error: unknown) => notify(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };
  const toggle = (reminder: StaffReminder) => void setActive.mutateAsync({ reminderId: reminder.id, active: !reminder.active }).catch((error: unknown) => notify(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  const deleteReminder = (reminder: StaffReminder) => Alert.alert(t("reminders.deleteTitle"), t("reminders.deleteDescription"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("reminders.delete"), style: "destructive", onPress: () => void remove.mutateAsync(reminder.id).catch((error: unknown) => notify(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger")) }]);

  return <AppScreen showBottomNavigation={false} title={t("reminders.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("reminders.add")} onPress={openCreate}>{t("reminders.add")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("reminders.subtitle")}</AppText>
    {Platform.OS === "web" && <Banner tone="warning" title={t("reminders.webWarning")} />}
    {reminders.isFetching && <ShimmerList />}
    {reminders.isError && !reminders.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void reminders.refetch()} />}
    {!reminders.isFetching && reminders.data?.map((reminder) => <Card key={reminder.id} icon="alarm-outline" title={reminder.title} subtitle={`${formatTime(reminder)} · ${reminder.weekdays.map((day) => t(weekdayKeys[day - 1])).join(", ")}`} trailing={<Badge tone={reminder.active ? "success" : "neutral"} label={t(reminder.active ? "reminders.active" : "reminders.inactive")} />} style={!reminder.active && styles.inactive}>
      <AppText>{reminder.description}</AppText>
      <View style={styles.target}><Ionicons name="navigate-outline" size={14} color={colors.muted} /><AppText variant="caption" tone="muted">{t(reminderTargetKey(reminder.target))}</AppText></View>
      {canManage && <ToggleSwitch label={t(reminder.active ? "reminders.active" : "reminders.inactive")} accessibilityLabel={t(reminder.active ? "reminders.pause" : "reminders.activate")} value={reminder.active} disabled={setActive.isPending} onValueChange={() => toggle(reminder)} />}
      {canManage && <View style={styles.actions}><Button style={styles.grow} variant="secondary" leadingIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />} onPress={() => openEdit(reminder)}>{t("common.edit")}</Button><Button style={styles.grow} variant="ghost" loading={remove.isPending} onPress={() => deleteReminder(reminder)}><AppText variant="label" tone="danger">{t("reminders.delete")}</AppText></Button></View>}
    </Card>)}
    {!reminders.isFetching && !reminders.isError && reminders.data?.length === 0 && <EmptyState icon="alarm-outline" title={t("reminders.empty")} action={canManage ? { label: t("reminders.add"), onPress: openCreate } : undefined} />}

    <BottomSheet
      visible={editorOpen}
      onClose={closeEditor}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingReminder ? "reminders.edit" : "reminders.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeEditor }}
      positiveAction={{ label: t("common.save"), loading: saveReminder.isPending, onPress: save }}
    >
      {Platform.OS === "web" && <Banner tone="warning" title={t("reminders.webWarning")} />}
      <TextField label={t("reminders.name")} required value={title} onChangeText={setTitle} />
      <TextField label={t("reminders.description")} required multiline value={description} onChangeText={setDescription} />
      <View style={styles.field}><AppText variant="label">{t("reminders.time")}</AppText><DatePicker mode="time" value={time} onChange={setTime} placeholder={t("reminders.time")} /></View>
      <View style={styles.field}><AppText variant="label">{t("reminders.repeat")}</AppText><ChipGroup accessibilityLabel={t("reminders.repeat")}>{weekdays.map((day) => <Chip key={day} label={t(weekdayKeys[day - 1])} selected={selectedWeekdays.includes(day)} onPress={() => toggleWeekday(day)} />)}</ChipGroup></View>
      <View style={styles.field}><AppText variant="label">{t("reminders.destination")}</AppText><ChipGroup accessibilityLabel={t("reminders.destination")}>{targets.map((item) => <Chip key={item} label={t(reminderTargetKey(item))} selected={target === item} onPress={() => setTarget(item)} />)}</ChipGroup></View>
    </BottomSheet>
  </AppScreen>;
}

function formatTime(reminder: StaffReminder): string { return `${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`; }
function reminderTargetKey(target: StaffReminder["target"]): TranslationKey { return `reminders.target.${target}` as TranslationKey; }

const styles = StyleSheet.create({
  inactive: { opacity: 0.75 },
  target: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  grow: { flex: 1 },
  field: { gap: spacing.xs },
});
