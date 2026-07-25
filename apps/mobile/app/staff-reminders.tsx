import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hasInstitutionCapability, staffReminderTargets, type StaffReminderTarget } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import type { StaffReminder } from "@daycare/api-client";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { staffReminderQueryKey, useStaffReminders } from "@/reminders/useStaffReminders";
import { DatePicker } from "@/date-picker/DatePicker";

const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;
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

  const [listOpen, setListOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<StaffReminder | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("17:00");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [target, setTarget] = useState<StaffReminderTarget>("HOME");
  const targets = useMemo(() => staffReminderTargets.filter((item) => item !== "BOOKING_APPROVALS" || hasInstitutionCapability(membership?.capabilities, "DAYCARE_OPERATIONS")), [membership?.capabilities]);

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
  const openCreate = () => { setListOpen(false); setEditingReminder(null); resetForm(); setEditorOpen(true); };
  const openEdit = (reminder: StaffReminder) => { setListOpen(false); setEditingReminder(reminder); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setEditingReminder(null); resetForm(); };
  const toggleWeekday = (day: number) => setSelectedWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  const save = () => {
    const [hour, minute] = time.split(":").map(Number);
    if (!title.trim() || !description.trim() || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || selectedWeekdays.length === 0) return Alert.alert(t("reminders.required"));
    void saveReminder.mutateAsync().catch((error: unknown) => Alert.alert(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  };
  const toggle = (reminder: StaffReminder) => void setActive.mutateAsync({ reminderId: reminder.id, active: !reminder.active }).catch((error: unknown) => Alert.alert(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  const deleteReminder = (reminder: StaffReminder) => Alert.alert(t("reminders.deleteTitle"), t("reminders.deleteDescription"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("reminders.delete"), style: "destructive", onPress: () => void remove.mutateAsync(reminder.id).catch((error: unknown) => Alert.alert(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"))) }]);

  return <AppScreen showBottomNavigation={false} title={t("reminders.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("reminders.subtitle")}</AppText>
    {Platform.OS === "web" && <View style={styles.warning}><AppText variant="caption" tone="danger">{t("reminders.webWarning")}</AppText></View>}
    <NavigationCard accessibilityLabel={t("reminders.title")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("reminders.title")}</AppText>
      <AppText tone={reminders.data?.length ? "default" : "muted"}>{reminders.isFetching ? t("common.loading") : reminders.data?.length ? t("reminders.remindersSummary", { count: reminders.data.length }) : t("reminders.empty")}</AppText>
    </NavigationCard>

    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("reminders.title")}>
      {canManage && <Button onPress={openCreate}>{t("reminders.add")}</Button>}
      {reminders.isFetching && <ShimmerList />}
      {reminders.isError && <Button variant="secondary" onPress={() => reminders.refetch()}>{t("common.retry")}</Button>}
      {!reminders.isFetching && reminders.data?.map((reminder) => <View key={reminder.id} style={[styles.card, !reminder.active && styles.inactive]}>
        <AppText variant="heading">{reminder.title}</AppText>
        <AppText>{reminder.description}</AppText>
        <AppText tone="muted">{formatTime(reminder)} · {reminder.weekdays.map((day) => t(weekdayKeys[day - 1])).join(", ")}</AppText>
        <AppText variant="caption" tone="muted">{t(reminderTargetKey(reminder.target))}</AppText>
        <AppText variant="caption" tone={reminder.active ? "default" : "muted"}>{t(reminder.active ? "reminders.active" : "reminders.inactive")}</AppText>
        {canManage && <View style={styles.actions}><Button variant="secondary" onPress={() => openEdit(reminder)}>{t("common.edit")}</Button><Button variant="secondary" loading={setActive.isPending} onPress={() => toggle(reminder)}>{t(reminder.active ? "reminders.pause" : "reminders.activate")}</Button><Button variant="danger" loading={remove.isPending} onPress={() => deleteReminder(reminder)}>{t("reminders.delete")}</Button></View>}
      </View>)}
      {!reminders.isFetching && reminders.data?.length === 0 && <AppText tone="muted">{t("reminders.empty")}</AppText>}
    </BottomSheet>

    <BottomSheet
      visible={editorOpen}
      onClose={closeEditor}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingReminder ? "reminders.edit" : "reminders.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeEditor }}
      positiveAction={{ label: t("common.save"), loading: saveReminder.isPending, onPress: save }}
    >
      {Platform.OS === "web" && <View style={styles.warning}><AppText variant="caption" tone="danger">{t("reminders.webWarning")}</AppText></View>}
      <View style={styles.field}><AppText variant="label">{t("reminders.name")}</AppText><TextInput style={styles.input} placeholder={t("reminders.name")} value={title} onChangeText={setTitle} /></View>
      <View style={styles.field}><AppText variant="label">{t("reminders.description")}</AppText><TextInput style={[styles.input, styles.multiline]} multiline placeholder={t("reminders.description")} value={description} onChangeText={setDescription} /></View>
      <View style={styles.field}><AppText variant="label">{t("reminders.time")}</AppText><DatePicker mode="time" value={time} onChange={setTime} placeholder={t("reminders.time")} /></View>
      <View style={styles.field}><AppText variant="label">{t("reminders.repeat")}</AppText><View style={styles.options}>{weekdays.map((day) => <Pressable key={day} accessibilityRole="button" accessibilityState={{ selected: selectedWeekdays.includes(day) }} onPress={() => toggleWeekday(day)} style={({ pressed }) => [styles.day, selectedWeekdays.includes(day) && styles.daySelected, pressed && styles.pressed]}><AppText variant="caption" style={selectedWeekdays.includes(day) ? styles.dayLabelSelected : styles.dayLabel}>{t(weekdayKeys[day - 1])}</AppText></Pressable>)}</View></View>
      <View style={styles.field}><AppText variant="label">{t("reminders.destination")}</AppText><View style={styles.options}>{targets.map((item) => <Button key={item} variant={target === item ? "primary" : "secondary"} onPress={() => setTarget(item)}>{t(reminderTargetKey(item))}</Button>)}</View></View>
    </BottomSheet>
  </AppScreen>;
}

function formatTime(reminder: StaffReminder): string { return `${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`; }
function reminderTargetKey(target: StaffReminder["target"]): TranslationKey { return `reminders.target.${target}` as TranslationKey; }

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  inactive: { opacity: 0.65 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  warning: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surfaceTint },
  field: { gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  multiline: { minHeight: 112, paddingTop: spacing.sm, textAlignVertical: "top" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  day: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  daySelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  dayLabel: { color: colors.text },
  dayLabelSelected: { color: colors.onPrimary },
  pressed: { opacity: 0.78 },
});
