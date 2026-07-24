import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { staffReminderTargets, type StaffReminderTarget } from "@daycare/core";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { DatePicker } from "@/date-picker/DatePicker";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { hasInstitutionCapability } from "@daycare/core";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { staffReminderQueryKey, useStaffReminders } from "@/reminders/useStaffReminders";

const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;
const weekdayKeys = ["reminders.monday", "reminders.tuesday", "reminders.wednesday", "reminders.thursday", "reminders.friday", "reminders.saturday", "reminders.sunday"] as const;

export default function StaffReminderEditorScreen() {
  const router = useRouter();
  const { reminderId } = useLocalSearchParams<{ reminderId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF" && membership.active;
  const reminders = useStaffReminders(membership?.role === "STAFF");
  const existing = typeof reminderId === "string" ? reminders.data?.find((item) => item.id === reminderId) : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("17:00");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [target, setTarget] = useState<StaffReminderTarget>("HOME");
  const targets = useMemo(() => staffReminderTargets.filter((item) => item !== "BOOKING_APPROVALS" || hasInstitutionCapability(membership?.capabilities, "DAYCARE_OPERATIONS")), [membership?.capabilities]);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title); setDescription(existing.description); setTime(`${String(existing.hour).padStart(2, "0")}:${String(existing.minute).padStart(2, "0")}`); setSelectedWeekdays(existing.weekdays); setTarget(existing.target);
  }, [existing]);

  const saveReminder = useMutation({
    mutationFn: () => {
      const [hour, minute] = time.split(":").map(Number);
      const input = { title: title.trim(), description: description.trim(), hour, minute, weekdays: selectedWeekdays, target };
      return existing ? api.updateStaffReminder(existing.id, input) : api.createStaffReminder(input);
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: staffReminderQueryKey(organizationId) }); router.back(); },
  });
  const save = () => {
    const [hour, minute] = time.split(":").map(Number);
    if (!title.trim() || !description.trim() || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || selectedWeekdays.length === 0) return Alert.alert(t("reminders.required"));
    void saveReminder.mutateAsync().catch((error: unknown) => Alert.alert(t("reminders.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")));
  };
  const toggleWeekday = (day: number) => setSelectedWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());

  if (!profile) return null;
  if (!canManage) return <Redirect href="/home" />;
  if (typeof reminderId === "string" && reminders.isSuccess && !existing) return <Redirect href="/staff-reminders" />;

  return <AppScreen showBottomNavigation={false} title={t(existing ? "reminders.edit" : "reminders.add")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {Platform.OS === "web" && <View style={styles.warning}><AppText variant="caption" tone="danger">{t("reminders.webWarning")}</AppText></View>}
    <View style={styles.field}><AppText variant="label">{t("reminders.name")}</AppText><TextInput style={styles.input} placeholder={t("reminders.name")} value={title} onChangeText={setTitle} /></View>
    <View style={styles.field}><AppText variant="label">{t("reminders.description")}</AppText><TextInput style={[styles.input, styles.multiline]} multiline placeholder={t("reminders.description")} value={description} onChangeText={setDescription} /></View>
    <View style={styles.field}><AppText variant="label">{t("reminders.time")}</AppText><DatePicker mode="time" value={time} onChange={setTime} placeholder={t("reminders.time")} /></View>
    <View style={styles.field}><AppText variant="label">{t("reminders.repeat")}</AppText><View style={styles.options}>{weekdays.map((day) => <Pressable key={day} accessibilityRole="button" accessibilityState={{ selected: selectedWeekdays.includes(day) }} onPress={() => toggleWeekday(day)} style={({ pressed }) => [styles.day, selectedWeekdays.includes(day) && styles.daySelected, pressed && styles.pressed]}><AppText variant="caption" style={selectedWeekdays.includes(day) ? styles.dayLabelSelected : styles.dayLabel}>{t(weekdayKeys[day - 1])}</AppText></Pressable>)}</View></View>
    <View style={styles.field}><AppText variant="label">{t("reminders.destination")}</AppText><View style={styles.options}>{targets.map((item) => <Button key={item} variant={target === item ? "primary" : "secondary"} onPress={() => setTarget(item)}>{t(reminderTargetKey(item))}</Button>)}</View></View>
    <Button loading={saveReminder.isPending} onPress={save}>{t("common.save")}</Button>
  </AppScreen>;
}

const styles = StyleSheet.create({ field: { gap: spacing.xs }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }, multiline: { minHeight: 112, paddingTop: spacing.sm, textAlignVertical: "top" }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, day: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, daySelected: { borderColor: colors.primary, backgroundColor: colors.primary }, dayLabel: { color: colors.text }, dayLabelSelected: { color: colors.onPrimary }, pressed: { opacity: 0.78 }, warning: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surfaceTint } });

function reminderTargetKey(target: StaffReminderTarget): TranslationKey { return `reminders.target.${target}` as TranslationKey; }
