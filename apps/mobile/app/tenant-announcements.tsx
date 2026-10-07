import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TenantAnnouncement, TenantAnnouncementAudience, TenantAnnouncementStatus } from "@daycare/api-client";
import { AppText, BackButton, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, ToggleSwitch, colors, spacing, type Tone } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";

type FormState = { id?: string; audience: TenantAnnouncementAudience; branchId: string | null; title: string; body: string; requiresAcknowledgement: boolean };
const newForm = (): FormState => ({ audience: "TENANT", branchId: null, title: "", body: "", requiresAcknowledgement: false });
const formFromAnnouncement = (announcement: TenantAnnouncement): FormState => ({ id: announcement.id, audience: announcement.audience, branchId: announcement.branchId ?? null, title: announcement.title, body: announcement.body, requiresAcknowledgement: announcement.requiresAcknowledgement });
const statuses: TenantAnnouncementStatus[] = ["DRAFT", "SCHEDULED", "PUBLISHED", "CLOSED"];

export default function TenantAnnouncementsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active === true && membership.role === "STAFF_ADMIN";
  const items = useQuery({ queryKey: [canManage ? "managed-announcements" : "announcements", organizationId], queryFn: () => canManage ? api.managedAnnouncements() : api.announcements(organizationId ?? undefined), enabled: Boolean(organizationId && membership?.active) });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: canManage });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["managed-announcements", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["announcements", organizationId] }); };
  const [form, setForm] = useState<FormState | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<TenantAnnouncement | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const saveAnnouncement = useMutation({ mutationFn: (input: FormState) => {
    const payload = { audience: input.audience, branchId: input.audience === "BRANCH" ? input.branchId ?? undefined : undefined, title: input.title.trim(), body: input.body.trim(), requiresAcknowledgement: input.requiresAcknowledgement };
    return input.id ? api.updateAnnouncement(input.id, payload) : api.createAnnouncement(payload);
  }, onSuccess: () => { refresh(); setForm(null); notify(t("operations.announcementSaved"), undefined, "success"); } });
  const publish = useMutation({ mutationFn: (id: string) => api.publishAnnouncement(id), onSuccess: refresh });
  const schedule = useMutation({ mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) => api.publishAnnouncement(id, scheduledAt), onSuccess: () => { refresh(); setScheduleTarget(null); setScheduledDate(""); setScheduledTime(""); } });
  const close = useMutation({ mutationFn: (id: string) => api.closeAnnouncement(id), onSuccess: refresh });
  const acknowledge = useMutation({ mutationFn: (id: string) => api.acknowledgeAnnouncement(id, organizationId ?? undefined), onSuccess: refresh });

  if (!profile) return null;
  if (!membership?.active) return <Redirect href="/home" />;
  const audienceLabel = (audience: TenantAnnouncementAudience) => t(audience === "TENANT" ? "operations.tenant" : "operations.branch");
  const statusLabel = (status: TenantAnnouncementStatus) => t(status === "DRAFT" ? "operations.draft" : status === "SCHEDULED" ? "operations.scheduled" : status === "PUBLISHED" ? "operations.published" : "operations.closed");
  const statusTone = (status: TenantAnnouncementStatus): Tone => status === "PUBLISHED" ? "success" : status === "DRAFT" ? "neutral" : status === "SCHEDULED" ? "info" : "warning";
  const save = () => {
    if (!form || !form.title.trim() || !form.body.trim() || (form.audience === "BRANCH" && !form.branchId)) return;
    void saveAnnouncement.mutateAsync(form).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };
  const openSchedule = (item: TenantAnnouncement) => { setScheduleTarget(item); setScheduledDate(formatIsoDate(new Date())); setScheduledTime(""); };
  const submitSchedule = () => {
    if (!scheduleTarget || !scheduledDate || !scheduledTime) return notify(t("operations.scheduleInFuture"), undefined, "warning");
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) return notify(t("operations.scheduleInFuture"), undefined, "warning");
    void schedule.mutateAsync({ id: scheduleTarget.id, scheduledAt: scheduledAt.toISOString() }).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };

  return <AppScreen showBottomNavigation={false} title={t(canManage ? "operations.manageAnnouncements" : "operations.announcements")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("operations.addAnnouncement")} onPress={() => setForm(newForm())}>{t("operations.addAnnouncement")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("operations.announcementsDescription")}</AppText>
    {items.isLoading && <ShimmerList />}
    {items.isError && !items.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void items.refetch()} />}
    {!items.isLoading && !items.isError && items.data?.map((item) => <Card key={item.id} icon="megaphone-outline" title={item.title} subtitle={item.publishedAt ? formatDateTime(item.publishedAt) : item.scheduledAt ? formatDateTime(item.scheduledAt) : formatDateTime(item.createdAt)} trailing={<Badge tone={statusTone(item.status)} label={statusLabel(item.status)} />}><AppText>{item.body}</AppText><AppText variant="caption" tone="muted">{audienceLabel(item.audience)} · {item.recipientCount}</AppText>{item.requiresAcknowledgement && item.status === "PUBLISHED" && (item.acknowledgedByMe ? <Badge tone="success" label={t("operations.acknowledged")} /> : <Button loading={acknowledge.isPending} onPress={() => void acknowledge.mutateAsync(item.id).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.acknowledge")}</Button>)}{canManage && <View style={styles.actions}>{item.status === "DRAFT" && <><Button style={styles.action} variant="secondary" onPress={() => setForm(formFromAnnouncement(item))}>{t("common.edit")}</Button><Button style={styles.action} variant="secondary" onPress={() => openSchedule(item)}>{t("operations.schedule")}</Button><Button style={styles.action} loading={publish.isPending} onPress={() => void publish.mutateAsync(item.id).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.publish")}</Button></>}{(item.status === "PUBLISHED" || item.status === "SCHEDULED") && <Button style={styles.action} variant="secondary" loading={close.isPending} onPress={() => void close.mutateAsync(item.id).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.close")}</Button>}</View>}</Card>)}
    {!items.isLoading && !items.isError && items.data?.length === 0 && <EmptyState icon="megaphone-outline" title={t("operations.announcementEmpty")} action={canManage ? { label: t("operations.addAnnouncement"), onPress: () => setForm(newForm()) } : undefined} />}
    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t(form?.id ? "operations.editAnnouncement" : "operations.addAnnouncement")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("common.save"), disabled: !form?.title.trim() || !form.body.trim() || (form.audience === "BRANCH" && !form.branchId), loading: saveAnnouncement.isPending, onPress: save }}>
      <View style={styles.field}><AppText variant="label">{t("operations.audience")}</AppText><ChipGroup accessibilityLabel={t("operations.audience")}><Chip label={t("operations.tenant")} selected={form?.audience === "TENANT"} onPress={() => setForm((current) => current ? { ...current, audience: "TENANT", branchId: null } : current)} /><Chip label={t("operations.branch")} selected={form?.audience === "BRANCH"} onPress={() => setForm((current) => current ? { ...current, audience: "BRANCH", branchId: branches.data?.find((branch) => branch.active)?.id ?? null } : current)} /></ChipGroup></View>
      {form?.audience === "BRANCH" && <View style={styles.field}><AppText variant="label">{t("operations.branch")}</AppText><ChipGroup accessibilityLabel={t("operations.branch")}>{branches.data?.filter((branch) => branch.active).map((branch) => <Chip key={branch.id} label={branch.name} selected={form.branchId === branch.id} onPress={() => setForm((current) => current ? { ...current, branchId: branch.id } : current)} />)}</ChipGroup></View>}
      <TextField label={t("operations.announcementTitle")} required value={form?.title ?? ""} onChangeText={(title) => setForm((current) => current ? { ...current, title } : current)} maxLength={160} />
      <TextField label={t("operations.message")} required value={form?.body ?? ""} onChangeText={(body) => setForm((current) => current ? { ...current, body } : current)} multiline maxLength={4_000} />
      <ToggleSwitch label={t("operations.requireAcknowledgement")} accessibilityLabel={t("operations.requireAcknowledgement")} value={form?.requiresAcknowledgement ?? false} onValueChange={(requiresAcknowledgement) => setForm((current) => current ? { ...current, requiresAcknowledgement } : current)} />
    </BottomSheet>
    <BottomSheet visible={scheduleTarget !== null} onClose={() => setScheduleTarget(null)} closeAccessibilityLabel={t("common.close")} title={t("operations.schedule")} negativeAction={{ label: t("common.cancel"), onPress: () => setScheduleTarget(null) }} positiveAction={{ label: t("operations.schedule"), disabled: !scheduledDate || !scheduledTime, loading: schedule.isPending, onPress: submitSchedule }}>
      <AppText tone="muted">{t("operations.scheduleHint")}</AppText>
      <View style={styles.scheduleRow}><View style={styles.scheduleField}><DatePicker mode="date" placeholder={t("operations.scheduleDate")} value={scheduledDate} minimumDate={formatIsoDate(new Date())} onChange={setScheduledDate} /></View><View style={styles.scheduleField}><DatePicker mode="time" placeholder={t("operations.scheduleTime")} value={scheduledTime} onChange={setScheduledTime} /></View></View>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ field: { gap: spacing.xs }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 }, scheduleRow: { flexDirection: "row", gap: spacing.sm }, scheduleField: { flex: 1 } });
