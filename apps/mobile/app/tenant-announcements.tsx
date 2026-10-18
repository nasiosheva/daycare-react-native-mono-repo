// Mories Deo Hutapea,S.E.,S.Kom
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TenantAnnouncement, TenantAnnouncementAudience, TenantAnnouncementStatus } from "@daycare/api-client";
import { AppText, BackButton, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, SearchField, ShimmerList, TextField, ToggleSwitch, radius, spacing, type Tone } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { isValidHttpsImageUrl, isValidHttpsUrl } from "@/media/imageUrl";
import { FallbackImage } from "@/media/FallbackImage";
import { parentActionPages, type ParentActionType, type ParentActionPage } from "@daycare/core";
import type { TranslationKey } from "@/i18n/translations";
import { shouldOpenCreateForm } from "@/content-management/openCreateFromRouteParam";
import { filterTenantAnnouncements } from "@/content-management/tenantAnnouncementFilters";
import { tenantAnnouncementBranchName } from "@/content-management/tenantAnnouncementBranch";

type FormState = { id?: string; audience: TenantAnnouncementAudience; branchId: string | null; title: string; imageUrl: string; actionType: ParentActionType; actionTarget: string; requiresAcknowledgement: boolean };
const announcementStatuses: readonly TenantAnnouncementStatus[] = ["DRAFT", "SCHEDULED", "PUBLISHED", "CLOSED"];
const announcementAudiences: readonly TenantAnnouncementAudience[] = ["TENANT", "BRANCH"];
const newForm = (): FormState => ({ audience: "TENANT", branchId: null, title: "", imageUrl: "", actionType: "NONE", actionTarget: "", requiresAcknowledgement: false });
const formFromAnnouncement = (announcement: TenantAnnouncement): FormState => ({ id: announcement.id, audience: announcement.audience, branchId: announcement.branchId ?? null, title: announcement.title, imageUrl: announcement.imageUrl ?? "", actionType: announcement.actionType ?? "NONE", actionTarget: announcement.actionTarget ?? "", requiresAcknowledgement: announcement.requiresAcknowledgement });
const hasValidAction = (form: FormState | null): boolean => !form || form.actionType === "NONE" || (form.actionType === "OPEN_BROWSER" ? isValidHttpsUrl(form.actionTarget) : parentActionPages.includes(form.actionTarget as ParentActionPage));
export default function TenantAnnouncementsScreen() {
  const router = useRouter();
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  const params = useLocalSearchParams<{ organizationId?: string | string[]; create?: string | string[] }>();
  const requestedOrganizationId = Array.isArray(params.organizationId) ? params.organizationId[0] : params.organizationId;
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const requestedMembership = profile?.memberships.find((item) => item.organizationId === requestedOrganizationId);
  const organizationId = requestedOrganizationId && requestedMembership?.role === "PARENT" && requestedMembership.active
    ? requestedOrganizationId
    : activeOrganizationId;
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active === true && membership.role === "STAFF_ADMIN";
  const items = useQuery({ queryKey: [canManage ? "managed-announcements" : "announcements", organizationId], queryFn: () => canManage ? api.managedAnnouncements() : api.announcements(organizationId ?? undefined), enabled: Boolean(organizationId && membership?.active) });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: canManage });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["managed-announcements", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["announcements", organizationId] }); };
  const [form, setForm] = useState<FormState | null>(null);
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantAnnouncementStatus | undefined>();
  const [audienceFilter, setAudienceFilter] = useState<TenantAnnouncementAudience | undefined>();
  const [scheduleTarget, setScheduleTarget] = useState<TenantAnnouncement | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  useEffect(() => {
    if (!shouldOpenCreateForm(params.create, canManage)) return;
    setForm(newForm());
    router.setParams({ create: undefined });
  }, [canManage, params.create, router]);
  const saveAnnouncement = useMutation({ mutationFn: (input: FormState) => {
    const payload = { audience: input.audience, branchId: input.audience === "BRANCH" ? input.branchId ?? undefined : undefined, title: input.title.trim(), body: "", imageUrl: input.imageUrl.trim(), actionType: input.actionType, actionTarget: input.actionType === "NONE" ? undefined : input.actionTarget.trim(), requiresAcknowledgement: input.requiresAcknowledgement };
    return input.id ? api.updateAnnouncement(input.id, payload) : api.createAnnouncement(payload);
  }, onSuccess: () => { refresh(); setForm(null); notify(t("operations.announcementSaved"), undefined, "success"); } });
  const publish = useMutation({ mutationFn: (id: string) => api.publishAnnouncement(id), onSuccess: refresh });
  const schedule = useMutation({ mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) => api.publishAnnouncement(id, scheduledAt), onSuccess: () => { refresh(); setScheduleTarget(null); setScheduledDate(""); setScheduledTime(""); } });
  const close = useMutation({ mutationFn: (id: string) => api.closeAnnouncement(id), onSuccess: refresh });
  const acknowledge = useMutation({ mutationFn: (id: string) => api.acknowledgeAnnouncement(id, organizationId ?? undefined), onSuccess: refresh });

  if (!profile) return null;
  if (requestedOrganizationId && (requestedMembership?.role !== "PARENT" || !requestedMembership.active)) return <Redirect href="/home" />;
  if (!membership?.active) return <Redirect href="/home" />;
  const audienceLabel = (audience: TenantAnnouncementAudience) => t(audience === "TENANT" ? "operations.tenant" : "operations.branch");
  const statusLabel = (status: TenantAnnouncementStatus) => t(status === "DRAFT" ? "operations.draft" : status === "SCHEDULED" ? "operations.scheduled" : status === "PUBLISHED" ? "operations.published" : "operations.closed");
  const announcementScopeLabel = (item: TenantAnnouncement) => {
    const branchName = canManage && item.audience === "BRANCH" ? tenantAnnouncementBranchName(item.branchId, branches.data ?? []) : null;
    const branchLabel = branchName ?? (canManage && item.audience === "BRANCH" && !branches.isLoading ? t("operations.announcementBranchUnavailable") : null);
    return [audienceLabel(item.audience), branchLabel, String(item.recipientCount)].filter(Boolean).join(" · ");
  };
  const visibleAnnouncements = filterTenantAnnouncements(items.data ?? [], { search: announcementSearch, status: canManage ? statusFilter : undefined, audience: canManage ? audienceFilter : undefined, audienceLabel });
  const filtersApplied = Boolean(announcementSearch.trim() || statusFilter || audienceFilter);
  const clearFilters = () => { setAnnouncementSearch(""); setStatusFilter(undefined); setAudienceFilter(undefined); };
  const statusTone = (status: TenantAnnouncementStatus): Tone => status === "PUBLISHED" ? "success" : status === "DRAFT" ? "neutral" : status === "SCHEDULED" ? "info" : "warning";
  const save = () => {
    if (!form || !form.title.trim() || !isValidHttpsImageUrl(form.imageUrl) || !hasValidAction(form) || (form.audience === "BRANCH" && !form.branchId)) return;
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
    {!items.isLoading && !items.isError && Boolean(items.data?.length) && <View style={styles.filters}>
      <SearchField accessibilityLabel={t("operations.searchAnnouncements")} placeholder={t("operations.searchAnnouncements")} clearAccessibilityLabel={t("common.clearSearch")} value={announcementSearch} onChangeText={setAnnouncementSearch} />
      {canManage && <>
        <View style={styles.filterGroup}>
          <AppText variant="label">{t("operations.filterAnnouncementStatus")}</AppText>
          <ChipGroup accessibilityLabel={t("operations.filterAnnouncementStatus")}>
            <Chip label={t("operations.allAnnouncementStatuses")} selected={!statusFilter} onPress={() => setStatusFilter(undefined)} />
            {announcementStatuses.map((status) => <Chip key={status} label={statusLabel(status)} selected={statusFilter === status} onPress={() => setStatusFilter((current) => current === status ? undefined : status)} />)}
          </ChipGroup>
        </View>
        <View style={styles.filterGroup}>
          <AppText variant="label">{t("operations.filterAnnouncementAudience")}</AppText>
          <ChipGroup accessibilityLabel={t("operations.filterAnnouncementAudience")}>
            <Chip label={t("operations.allAnnouncementAudiences")} selected={!audienceFilter} onPress={() => setAudienceFilter(undefined)} />
            {announcementAudiences.map((audience) => <Chip key={audience} label={audienceLabel(audience)} selected={audienceFilter === audience} onPress={() => setAudienceFilter((current) => current === audience ? undefined : audience)} />)}
          </ChipGroup>
        </View>
      </>}
      {filtersApplied && <Button variant="secondary" onPress={clearFilters}>{t("operations.clearAnnouncementFilters")}</Button>}
    </View>}
    {!items.isLoading && !items.isError && visibleAnnouncements.map((item) => <Card key={item.id} icon="megaphone-outline" title={item.title} subtitle={item.publishedAt ? formatDateTime(item.publishedAt) : item.scheduledAt ? formatDateTime(item.scheduledAt) : formatDateTime(item.createdAt)} trailing={<Badge tone={statusTone(item.status)} label={statusLabel(item.status)} />}>{item.imageUrl && <FallbackImage key={`${item.id}:${item.imageUrl}`} accessibilityLabel={item.title} fallbackLabel={t("operations.imageUnavailable")} uri={item.imageUrl} style={styles.announcementImage} />}<AppText>{item.body}</AppText><AppText variant="caption" tone="muted">{announcementScopeLabel(item)}</AppText>{item.requiresAcknowledgement && item.status === "PUBLISHED" && (item.acknowledgedByMe ? <Badge tone="success" label={t("operations.acknowledged")} /> : <Button loading={acknowledge.isPending} onPress={() => void acknowledge.mutateAsync(item.id).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.acknowledge")}</Button>)}{canManage && <View style={styles.actions}>{item.status === "DRAFT" && <><Button style={styles.action} variant="secondary" onPress={() => setForm(formFromAnnouncement(item))}>{t("common.edit")}</Button><Button style={styles.action} variant="secondary" onPress={() => openSchedule(item)}>{t("operations.schedule")}</Button><Button style={styles.action} loading={publish.isPending} onPress={() => void publish.mutateAsync(item.id).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.publish")}</Button></>}{(item.status === "PUBLISHED" || item.status === "SCHEDULED") && <Button style={styles.action} variant="secondary" loading={close.isPending} onPress={() => void close.mutateAsync(item.id).catch((error: unknown) => notify(t("operations.announcementSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.close")}</Button>}</View>}</Card>)}
    {!items.isLoading && !items.isError && Boolean(items.data?.length) && visibleAnnouncements.length === 0 && <EmptyState icon="search-outline" title={t("operations.noAnnouncementMatches")} action={{ label: t("operations.clearAnnouncementFilters"), onPress: clearFilters }} />}
    {!items.isLoading && !items.isError && items.data?.length === 0 && <EmptyState icon="megaphone-outline" title={t("operations.announcementEmpty")} action={canManage ? { label: t("operations.addAnnouncement"), onPress: () => setForm(newForm()) } : undefined} />}
    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t(form?.id ? "operations.editAnnouncement" : "operations.addAnnouncement")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("common.save"), disabled: !form?.title.trim() || !isValidHttpsImageUrl(form.imageUrl) || !hasValidAction(form) || (form.audience === "BRANCH" && !form.branchId), loading: saveAnnouncement.isPending, onPress: save }}>
      <View style={styles.field}><AppText variant="label">{t("operations.audience")}</AppText><ChipGroup accessibilityLabel={t("operations.audience")}><Chip label={t("operations.tenant")} selected={form?.audience === "TENANT"} onPress={() => setForm((current) => current ? { ...current, audience: "TENANT", branchId: null } : current)} /><Chip label={t("operations.branch")} selected={form?.audience === "BRANCH"} onPress={() => setForm((current) => current ? { ...current, audience: "BRANCH", branchId: branches.data?.find((branch) => branch.active)?.id ?? null } : current)} /></ChipGroup></View>
      {form?.audience === "BRANCH" && <View style={styles.field}><AppText variant="label">{t("operations.branch")}</AppText><ChipGroup accessibilityLabel={t("operations.branch")}>{branches.data?.filter((branch) => branch.active).map((branch) => <Chip key={branch.id} label={branch.name} selected={form.branchId === branch.id} onPress={() => setForm((current) => current ? { ...current, branchId: branch.id } : current)} />)}</ChipGroup></View>}
      <TextField label={t("operations.announcementTitle")} required value={form?.title ?? ""} onChangeText={(title) => setForm((current) => current ? { ...current, title } : current)} maxLength={160} />
      <TextField label={t("operations.announcementImageUrl")} required value={form?.imageUrl ?? ""} onChangeText={(imageUrl) => setForm((current) => current ? { ...current, imageUrl } : current)} maxLength={2_048} autoCapitalize="none" keyboardType="url" />
      {form?.imageUrl && isValidHttpsImageUrl(form.imageUrl) && <FallbackImage key={form.imageUrl.trim()} accessibilityLabel={form.title || t("operations.announcementImageUrl")} fallbackLabel={t("operations.imageUnavailable")} uri={form.imageUrl.trim()} style={styles.announcementImagePreview} />}
      <ToggleSwitch label={t("operations.actionEnabled")} accessibilityLabel={t("operations.actionEnabled")} value={form?.actionType !== undefined && form.actionType !== "NONE"} onValueChange={(enabled) => setForm((current) => current ? { ...current, actionType: enabled ? "OPEN_BROWSER" : "NONE", actionTarget: "" } : current)} />
      {form && form.actionType !== "NONE" && <View style={styles.field}>
        <AppText variant="label">{t("operations.actionType")}</AppText>
        <ChipGroup accessibilityLabel={t("operations.actionType")}>
          <Chip label={t("operations.openBrowser")} selected={form.actionType === "OPEN_BROWSER"} onPress={() => setForm((current) => current ? { ...current, actionType: "OPEN_BROWSER", actionTarget: "" } : current)} />
          <Chip label={t("operations.openAppPage")} selected={form.actionType === "OPEN_APP_PAGE"} onPress={() => setForm((current) => current ? { ...current, actionType: "OPEN_APP_PAGE", actionTarget: "" } : current)} />
        </ChipGroup>
        {form.actionType === "OPEN_BROWSER" ? <TextField label={t("operations.actionUrl")} required value={form.actionTarget} onChangeText={(actionTarget) => setForm((current) => current ? { ...current, actionTarget } : current)} maxLength={2_048} autoCapitalize="none" keyboardType="url" /> : <><AppText variant="label">{t("operations.actionPage")}</AppText><ChipGroup accessibilityLabel={t("operations.actionPage")}>{parentActionPages.map((page) => <Chip key={page} label={t(`operations.actionPage.${page}` as TranslationKey)} selected={form.actionTarget === page} onPress={() => setForm((current) => current ? { ...current, actionTarget: page } : current)} />)}</ChipGroup></>}
      </View>}
      <ToggleSwitch label={t("operations.requireAcknowledgement")} accessibilityLabel={t("operations.requireAcknowledgement")} value={form?.requiresAcknowledgement ?? false} onValueChange={(requiresAcknowledgement) => setForm((current) => current ? { ...current, requiresAcknowledgement } : current)} />
    </BottomSheet>
    <BottomSheet visible={scheduleTarget !== null} onClose={() => setScheduleTarget(null)} closeAccessibilityLabel={t("common.close")} title={t("operations.schedule")} negativeAction={{ label: t("common.cancel"), onPress: () => setScheduleTarget(null) }} positiveAction={{ label: t("operations.schedule"), disabled: !scheduledDate || !scheduledTime, loading: schedule.isPending, onPress: submitSchedule }}>
      <AppText tone="muted">{t("operations.scheduleHint")}</AppText>
      <View style={styles.scheduleRow}><View style={styles.scheduleField}><DatePicker mode="date" placeholder={t("operations.scheduleDate")} value={scheduledDate} minimumDate={formatIsoDate(new Date())} onChange={setScheduledDate} /></View><View style={styles.scheduleField}><DatePicker mode="time" placeholder={t("operations.scheduleTime")} value={scheduledTime} onChange={setScheduledTime} /></View></View>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ field: { gap: spacing.xs }, filters: { gap: spacing.md }, filterGroup: { gap: spacing.xs }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 }, scheduleRow: { flexDirection: "row", gap: spacing.sm }, scheduleField: { flex: 1 }, announcementImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md }, announcementImagePreview: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md } });
