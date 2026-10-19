// Mories Deo Hutapea,S.E.,S.Kom
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlatformBanner, PlatformBannerStatus } from "@daycare/api-client";
import { AppText, BackButton, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, SearchField, ShimmerList, TextField, ToggleSwitch, colors, radius, spacing, type Tone } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { isValidHttpsImageUrl, isValidHttpsUrl } from "@/media/imageUrl";
import { platformBannerParentActionPages, staffAdminBannerActionPages, type ParentActionType, type PlatformBannerParentActionPage, type PlatformBannerAudience } from "@daycare/core";
import type { TranslationKey } from "@/i18n/translations";
import { FallbackImage } from "@/media/FallbackImage";
import { ParentPromotionSlider } from "@/home/ParentPromotionSlider";
import { shouldOpenCreateForm } from "@/content-management/openCreateFromRouteParam";
import { filterPlatformBanners } from "@/content-management/platformBannerFilters";
import { isNarrowPhoneLayout } from "@/ui/responsiveLayout";

type FormState = { id?: string; title: string; imageUrl: string; actionType: ParentActionType; actionTarget: string; expiresDate: string; expiresTime: string; audience: PlatformBannerAudience; targetOrganizationId: string };
const bannerStatuses: readonly PlatformBannerStatus[] = ["DRAFT", "SCHEDULED", "PUBLISHED", "CLOSED"];
const bannerAudiences: readonly PlatformBannerAudience[] = ["PARENT_GLOBAL", "STAFF_ADMIN_GLOBAL", "TENANT_STAFF_ADMIN"];
const JAKARTA_OFFSET = "+07:00";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1_000;
const expiryInstant = (date: string, time: string): Date | null | undefined => {
  if (!date && !time) return null;
  if (!date || !time) return undefined;
  const result = new Date(`${date}T${time}:00${JAKARTA_OFFSET}`);
  return Number.isNaN(result.getTime()) ? undefined : result;
};
const emptyForm = (): FormState => ({ title: "", imageUrl: "", actionType: "NONE", actionTarget: "", expiresDate: "", expiresTime: "", audience: "PARENT_GLOBAL", targetOrganizationId: "" });
const formFromBanner = (banner: PlatformBanner): FormState => {
  const localWib = banner.expiresAt ? new Date(new Date(banner.expiresAt).getTime() + JAKARTA_OFFSET_MS).toISOString() : "";
  return { id: banner.id, title: banner.title, imageUrl: banner.imageUrl, actionType: banner.actionType ?? "NONE", actionTarget: banner.actionTarget ?? "", expiresDate: localWib.slice(0, 10), expiresTime: localWib.slice(11, 16), audience: banner.audience ?? "PARENT_GLOBAL", targetOrganizationId: banner.targetOrganizationId ?? "" };
};
const hasValidAction = (form: FormState | null): boolean => !form || form.actionType === "NONE" || (form.actionType === "OPEN_BROWSER" ? isValidHttpsUrl(form.actionTarget) : form.audience === "PARENT_GLOBAL" ? platformBannerParentActionPages.includes(form.actionTarget as PlatformBannerParentActionPage) : staffAdminBannerActionPages.includes(form.actionTarget as (typeof staffAdminBannerActionPages)[number]));
const hasValidExpiry = (form: FormState | null): boolean => {
  if (!form) return true;
  const expiry = expiryInstant(form.expiresDate, form.expiresTime);
  return expiry === null || Boolean(expiry && expiry.getTime() > Date.now());
};

export default function PlatformBannersScreen() {
  const { width } = useWindowDimensions();
  const stackActions = isNarrowPhoneLayout(width);
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string | string[] }>();
  const { api, profile } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const canManage = Boolean(profile?.isPlatformAdmin);
  const canRead = profile?.registrationRole === "PARENT";
  const [form, setForm] = useState<FormState | null>(null);
  const [bannerSearch, setBannerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlatformBannerStatus | undefined>();
  const [audienceFilter, setAudienceFilter] = useState<PlatformBannerAudience | undefined>();
  const [tenantSearch, setTenantSearch] = useState("");
  const tenantOptions = useQuery({ queryKey: ["platform-banner-tenant-options", tenantSearch], queryFn: () => api.tenants(tenantSearch || undefined), enabled: canManage && form?.audience === "TENANT_STAFF_ADMIN" });
  const banners = useQuery({
    queryKey: [canManage ? "platform-banners" : "parent-platform-banners"],
    queryFn: () => canManage ? api.platformBanners() : api.parentPlatformBanners(),
    enabled: canManage || canRead,
  });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<PlatformBanner | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  useEffect(() => {
    if (!shouldOpenCreateForm(params.create, canManage)) return;
    setForm(emptyForm());
    router.setParams({ create: undefined });
  }, [canManage, params.create, router]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform-banners"] });
    void queryClient.invalidateQueries({ queryKey: ["parent-platform-banners"] });
  };
  const save = useMutation({ mutationFn: (input: FormState) => {
    const payload = { title: input.title.trim(), imageUrl: input.imageUrl.trim(), actionType: input.actionType, actionTarget: input.actionType === "NONE" ? undefined : input.actionTarget.trim(), expiresAt: expiryInstant(input.expiresDate, input.expiresTime)?.toISOString() ?? null, audience: input.audience, targetOrganizationId: input.audience === "TENANT_STAFF_ADMIN" ? input.targetOrganizationId : null };
    return input.id ? api.updatePlatformBanner(input.id, payload) : api.createPlatformBanner(payload);
  },
    onSuccess: () => { refresh(); setForm(null); notify(t("platformBanners.saved"), undefined, "success"); },
  });
  const publish = useMutation({ mutationFn: (bannerId: string) => api.publishPlatformBanner(bannerId), onSuccess: refresh });
  const schedule = useMutation({ mutationFn: ({ bannerId, scheduledAt }: { bannerId: string; scheduledAt: string }) => api.publishPlatformBanner(bannerId, scheduledAt), onSuccess: () => { refresh(); setScheduleTarget(null); setScheduledDate(""); setScheduledTime(""); } });
  const close = useMutation({ mutationFn: (bannerId: string) => api.closePlatformBanner(bannerId), onSuccess: refresh });

  if (!profile) return null;
  if (!canManage && !canRead) return <Redirect href="/home" />;
  const statusLabel = (status: PlatformBannerStatus) => t(status === "DRAFT" ? "operations.draft" : status === "SCHEDULED" ? "operations.scheduled" : status === "PUBLISHED" ? "operations.published" : "operations.closed");
  const audienceLabel = (audience: PlatformBannerAudience) => t(audience === "PARENT_GLOBAL" ? "platformBanners.audienceParent" as TranslationKey : audience === "STAFF_ADMIN_GLOBAL" ? "platformBanners.audienceAllStaffAdmins" as TranslationKey : "platformBanners.audienceTenantStaffAdmin" as TranslationKey);
  const visibleBanners = filterPlatformBanners(banners.data ?? [], { search: bannerSearch, status: statusFilter, audience: canManage ? audienceFilter : undefined, audienceLabel });
  const filtersApplied = Boolean(bannerSearch.trim() || statusFilter || audienceFilter);
  const clearBannerFilters = () => { setBannerSearch(""); setStatusFilter(undefined); setAudienceFilter(undefined); };
  const statusTone = (status: PlatformBannerStatus): Tone => status === "PUBLISHED" ? "success" : status === "DRAFT" ? "neutral" : status === "SCHEDULED" ? "info" : "warning";
  const submitForm = () => {
    if (!form?.title.trim() || !isValidHttpsImageUrl(form.imageUrl) || !hasValidAction(form) || !hasValidExpiry(form) || (form.audience === "TENANT_STAFF_ADMIN" && !form.targetOrganizationId)) return;
    void save.mutateAsync(form).catch((error: unknown) => notify(t("platformBanners.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };
  const submitSchedule = () => {
    if (!scheduleTarget || !scheduledDate || !scheduledTime) return;
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00+07:00`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) return notify(t("operations.scheduleInFuture"), undefined, "warning");
    void schedule.mutateAsync({ bannerId: scheduleTarget.id, scheduledAt: scheduledAt.toISOString() }).catch((error: unknown) => notify(t("platformBanners.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };
  const previewBanner: PlatformBanner | null = form && isValidHttpsImageUrl(form.imageUrl) ? {
    id: "platform-banner-preview",
    title: form.title.trim() || t("platformBanners.previewTitle"),
    body: "",
    imageUrl: form.imageUrl.trim(),
    actionType: form.actionType,
    actionTarget: form.actionTarget || null,
    audience: form.audience,
    targetOrganizationId: form.targetOrganizationId || null,
    status: "PUBLISHED",
    publishedAt: new Date().toISOString(),
    expiresAt: expiryInstant(form.expiresDate, form.expiresTime)?.toISOString() ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : null;

  return <AppScreen showBottomNavigation={false} title={t(canManage ? "platformBanners.adminTitle" as TranslationKey : "platformBanners.parentTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("platformBanners.create")} onPress={() => { setTenantSearch(""); setForm(emptyForm()); }}>{t("platformBanners.create")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t(canManage ? "platformBanners.description" : "platformBanners.parentDescription")}</AppText>
    {banners.isLoading && <ShimmerList />}
    {banners.isError && !banners.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void banners.refetch()} />}
    {!banners.isLoading && !banners.isError && Boolean(banners.data?.length) && <View style={styles.filters}>
      <SearchField accessibilityLabel={t("platformBanners.searchBanners" as TranslationKey)} placeholder={t("platformBanners.searchBanners" as TranslationKey)} clearAccessibilityLabel={t("common.clearSearch")} value={bannerSearch} onChangeText={setBannerSearch} />
      {canManage && <>
        <View style={styles.filterGroup}>
          <AppText variant="label">{t("platformBanners.filterStatus" as TranslationKey)}</AppText>
          <ChipGroup accessibilityLabel={t("platformBanners.filterStatus" as TranslationKey)}>
            <Chip label={t("platformBanners.allStatuses" as TranslationKey)} selected={!statusFilter} onPress={() => setStatusFilter(undefined)} />
            {bannerStatuses.map((status) => <Chip key={status} label={statusLabel(status)} selected={statusFilter === status} onPress={() => setStatusFilter((current) => current === status ? undefined : status)} />)}
          </ChipGroup>
        </View>
        <View style={styles.filterGroup}>
          <AppText variant="label">{t("platformBanners.filterAudience" as TranslationKey)}</AppText>
          <ChipGroup accessibilityLabel={t("platformBanners.filterAudience" as TranslationKey)}>
            <Chip label={t("platformBanners.allAudiences" as TranslationKey)} selected={!audienceFilter} onPress={() => setAudienceFilter(undefined)} />
            {bannerAudiences.map((audience) => <Chip key={audience} label={audienceLabel(audience)} selected={audienceFilter === audience} onPress={() => setAudienceFilter((current) => current === audience ? undefined : audience)} />)}
          </ChipGroup>
        </View>
      </>}
      {filtersApplied && <Button variant="secondary" onPress={clearBannerFilters}>{t("platformBanners.clearFilters" as TranslationKey)}</Button>}
    </View>}
    {!banners.isLoading && !banners.isError && visibleBanners.map((banner) => <Card key={banner.id} icon="images-outline" title={banner.title} subtitle={formatDateTime(banner.publishedAt ?? banner.scheduledAt ?? banner.createdAt)} trailing={canManage ? <Badge tone={statusTone(banner.status)} label={statusLabel(banner.status)} /> : undefined}>
      {canManage && <AppText variant="caption" tone="muted">{t(banner.audience === "PARENT_GLOBAL" ? "platformBanners.audienceParent" as TranslationKey : banner.audience === "STAFF_ADMIN_GLOBAL" ? "platformBanners.audienceAllStaffAdmins" as TranslationKey : "platformBanners.audienceTenantStaffAdmin" as TranslationKey)}{banner.targetOrganizationName ? ` · ${banner.targetOrganizationName}` : ""}</AppText>}
      <FallbackImage key={`${banner.id}:${banner.imageUrl}`} accessibilityLabel={banner.title} fallbackLabel={t("operations.imageUnavailable")} uri={banner.imageUrl} style={styles.bannerImage} />
      {canManage && banner.expiresAt && <AppText variant="caption" tone="muted">{t("platformBanners.expiresAt", { date: formatDateTime(banner.expiresAt) })}</AppText>}
      {canManage && <View testID="platform-banner-actions" style={[styles.actions, stackActions && styles.actionsNarrow]}>
        {banner.status === "DRAFT" && <><Button style={[styles.action, stackActions && styles.actionNarrow]} variant="secondary" onPress={() => setForm(formFromBanner(banner))}>{t("common.edit")}</Button><Button style={[styles.action, stackActions && styles.actionNarrow]} variant="secondary" onPress={() => { setScheduleTarget(banner); setScheduledDate(formatIsoDate(new Date())); setScheduledTime(""); }}>{t("operations.schedule")}</Button><Button style={[styles.action, stackActions && styles.actionNarrow]} loading={publish.isPending} onPress={() => void publish.mutateAsync(banner.id).catch((error: unknown) => notify(t("platformBanners.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.publish")}</Button></>}
        {(banner.status === "PUBLISHED" || banner.status === "SCHEDULED") && <Button variant="secondary" loading={close.isPending} onPress={() => void close.mutateAsync(banner.id).catch((error: unknown) => notify(t("platformBanners.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.close")}</Button>}
      </View>}
    </Card>)}
    {!banners.isLoading && !banners.isError && banners.data?.length === 0 && <EmptyState icon="megaphone-outline" title={t("platformBanners.empty")} action={canManage ? { label: t("platformBanners.create"), onPress: () => setForm(emptyForm()) } : undefined} />}
    {!banners.isLoading && !banners.isError && Boolean(banners.data?.length) && visibleBanners.length === 0 && <EmptyState compact title={t("platformBanners.noMatches" as TranslationKey)} action={filtersApplied ? { label: t("platformBanners.clearFilters" as TranslationKey), onPress: clearBannerFilters } : undefined} />}
    <BottomSheet visible={form !== null} onClose={() => { setForm(null); setPreviewVisible(false); }} closeAccessibilityLabel={t("common.close")} title={t(form?.id ? "platformBanners.edit" : "platformBanners.create")} negativeAction={{ label: t("common.cancel"), onPress: () => { setForm(null); setPreviewVisible(false); } }} positiveAction={{ label: t("common.save"), disabled: !form?.title.trim() || !isValidHttpsImageUrl(form.imageUrl) || !hasValidAction(form) || !hasValidExpiry(form) || (form.audience === "TENANT_STAFF_ADMIN" && !form.targetOrganizationId), loading: save.isPending, onPress: submitForm }}>
      <View style={styles.field}>
        <AppText variant="label">{t("platformBanners.audience" as TranslationKey)}</AppText>
        <ChipGroup accessibilityLabel={t("platformBanners.audience" as TranslationKey)}>
          <Chip label={t("platformBanners.audienceParent" as TranslationKey)} selected={form?.audience === "PARENT_GLOBAL"} onPress={() => setForm((current) => current ? { ...current, audience: "PARENT_GLOBAL", targetOrganizationId: "", actionType: "NONE", actionTarget: "" } : current)} />
          <Chip label={t("platformBanners.audienceAllStaffAdmins" as TranslationKey)} selected={form?.audience === "STAFF_ADMIN_GLOBAL"} onPress={() => setForm((current) => current ? { ...current, audience: "STAFF_ADMIN_GLOBAL", targetOrganizationId: "", actionType: "NONE", actionTarget: "" } : current)} />
          <Chip label={t("platformBanners.audienceTenantStaffAdmin" as TranslationKey)} selected={form?.audience === "TENANT_STAFF_ADMIN"} onPress={() => setForm((current) => current ? { ...current, audience: "TENANT_STAFF_ADMIN", targetOrganizationId: "", actionType: "NONE", actionTarget: "" } : current)} />
        </ChipGroup>
        {form?.audience === "PARENT_GLOBAL" && <AppText variant="caption" tone="muted">{t("platformBanners.audienceParentHint" as TranslationKey)}</AppText>}
        {form?.audience === "STAFF_ADMIN_GLOBAL" && <AppText variant="caption" tone="muted">{t("platformBanners.audienceStaffAdminHint" as TranslationKey)}</AppText>}
        {form?.audience === "TENANT_STAFF_ADMIN" && <>
          <AppText variant="caption" tone="muted">{t("platformBanners.audienceTenantHint" as TranslationKey)}</AppText>
          <SearchField accessibilityLabel={t("platformBanners.searchTenant" as TranslationKey)} clearAccessibilityLabel={t("common.clearSearch")} placeholder={t("platformBanners.searchTenant" as TranslationKey)} value={tenantSearch} onChangeText={setTenantSearch} />
          {tenantOptions.isFetching && <ShimmerList variant="tile" />}
          {tenantOptions.isError && !tenantOptions.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void tenantOptions.refetch()} />}
          {tenantOptions.data?.map((tenant) => <Pressable key={tenant.id} accessibilityRole="button" accessibilityState={{ selected: form.targetOrganizationId === tenant.id }} onPress={() => setForm((current) => current ? { ...current, targetOrganizationId: tenant.id } : current)} style={({ pressed }) => [styles.tenantOption, form.targetOrganizationId === tenant.id && styles.tenantOptionSelected, pressed && styles.tenantOptionPressed]}><AppText variant="label">{tenant.name}</AppText><AppText variant="caption" tone="muted">{tenant.branchName ?? tenant.id}</AppText></Pressable>)}
          {tenantOptions.data?.length === 0 && <AppText tone="muted">{t("platformBanners.noTenantMatches" as TranslationKey)}</AppText>}
        </>}
      </View>
      <Button variant="secondary" disabled={!previewBanner} onPress={() => setPreviewVisible(true)}>{t("platformBanners.preview")}</Button>
      <TextField label={t("operations.announcementTitle")} required value={form?.title ?? ""} onChangeText={(title) => setForm((current) => current ? { ...current, title } : current)} clearable clearAccessibilityLabel={t("common.clearText")} maxLength={160} />
      <TextField label={t("platformBanners.imageUrl")} required value={form?.imageUrl ?? ""} onChangeText={(imageUrl) => setForm((current) => current ? { ...current, imageUrl } : current)} clearable clearAccessibilityLabel={t("common.clearText")} maxLength={2_048} autoCapitalize="none" keyboardType="url" />
      {form?.imageUrl && isValidHttpsImageUrl(form.imageUrl) && <FallbackImage key={form.imageUrl.trim()} accessibilityLabel={form.title || t("platformBanners.imageUrl")} fallbackLabel={t("operations.imageUnavailable")} uri={form.imageUrl.trim()} style={styles.formImagePreview} />}
      <ToggleSwitch label={t("platformBanners.clickable")} accessibilityLabel={t("platformBanners.clickable")} value={form?.actionType !== undefined && form.actionType !== "NONE"} onValueChange={(enabled) => setForm((current) => current ? { ...current, actionType: enabled ? "OPEN_BROWSER" : "NONE", actionTarget: "" } : current)} />
      {form && form.actionType !== "NONE" && <View style={styles.field}>
        <AppText variant="label">{t("operations.actionType")}</AppText>
        <ChipGroup accessibilityLabel={t("operations.actionType")}>
          <Chip label={t("operations.openBrowser")} selected={form.actionType === "OPEN_BROWSER"} onPress={() => setForm((current) => current ? { ...current, actionType: "OPEN_BROWSER", actionTarget: "" } : current)} />
          <Chip label={t("operations.openAppPage")} selected={form.actionType === "OPEN_APP_PAGE"} onPress={() => setForm((current) => current ? { ...current, actionType: "OPEN_APP_PAGE", actionTarget: "" } : current)} />
        </ChipGroup>
        {form.actionType === "OPEN_BROWSER" ? <TextField label={t("operations.actionUrl")} required value={form.actionTarget} onChangeText={(actionTarget) => setForm((current) => current ? { ...current, actionTarget } : current)} clearable clearAccessibilityLabel={t("common.clearText")} maxLength={2_048} autoCapitalize="none" keyboardType="url" /> : <><AppText variant="label">{form.audience === "PARENT_GLOBAL" ? t("operations.actionPage") : t("platformBanners.staffAdminActionPage" as TranslationKey)}</AppText><ChipGroup accessibilityLabel={form.audience === "PARENT_GLOBAL" ? t("operations.actionPage") : t("platformBanners.staffAdminActionPage" as TranslationKey)}>{(form.audience === "PARENT_GLOBAL" ? platformBannerParentActionPages : staffAdminBannerActionPages).map((page) => <Chip key={page} label={page === "PROFILE" ? t("profile.title") : t(form.audience === "PARENT_GLOBAL" ? `operations.actionPage.${page}` as TranslationKey : `platformBanners.actionPage.${page}` as TranslationKey)} selected={form.actionTarget === page} onPress={() => setForm((current) => current ? { ...current, actionTarget: page } : current)} />)}</ChipGroup></>}
      </View>}
      <View style={styles.field}>
        <AppText variant="label">{t("platformBanners.expiry")}</AppText>
        <AppText variant="caption" tone="muted">{t("platformBanners.expiryHint")}</AppText>
        <View style={styles.scheduleRow}>
          <View style={styles.scheduleField}><DatePicker mode="date" placeholder={t("platformBanners.expiryDate")} value={form?.expiresDate ?? ""} minimumDate={formatIsoDate(new Date())} onChange={(expiresDate) => setForm((current) => current ? { ...current, expiresDate } : current)} /></View>
          <View style={styles.scheduleField}><DatePicker mode="time" placeholder={t("platformBanners.expiryTime")} value={form?.expiresTime ?? ""} onChange={(expiresTime) => setForm((current) => current ? { ...current, expiresTime } : current)} /></View>
        </View>
        {Boolean(form?.expiresDate || form?.expiresTime) && <Button variant="secondary" onPress={() => setForm((current) => current ? { ...current, expiresDate: "", expiresTime: "" } : current)}>{t("platformBanners.clearExpiry")}</Button>}
        {form && !hasValidExpiry(form) && <AppText tone="danger">{t("platformBanners.expiryInvalid")}</AppText>}
      </View>
    </BottomSheet>
    <BottomSheet visible={scheduleTarget !== null} onClose={() => setScheduleTarget(null)} closeAccessibilityLabel={t("common.close")} title={t("operations.schedule")} negativeAction={{ label: t("common.cancel"), onPress: () => setScheduleTarget(null) }} positiveAction={{ label: t("operations.schedule"), disabled: !scheduledDate || !scheduledTime, loading: schedule.isPending, onPress: submitSchedule }}>
      <AppText tone="muted">{t("operations.scheduleHint")}</AppText>
      <View style={styles.scheduleRow}><View style={styles.scheduleField}><DatePicker mode="date" placeholder={t("operations.scheduleDate")} value={scheduledDate} minimumDate={formatIsoDate(new Date())} onChange={setScheduledDate} /></View><View style={styles.scheduleField}><DatePicker mode="time" placeholder={t("operations.scheduleTime")} value={scheduledTime} onChange={setScheduledTime} /></View></View>
    </BottomSheet>
    <Modal visible={previewVisible && previewBanner !== null} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)} statusBarTranslucent>
      <View style={styles.previewBackdrop}>
        <View style={styles.previewDialog} accessibilityViewIsModal>
          <View style={styles.previewHeader}><AppText variant="h5" style={styles.previewTitle}>{t("platformBanners.preview")}</AppText><Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={spacing.sm} onPress={() => setPreviewVisible(false)} style={styles.previewClose}><Ionicons name="close" size={22} color={colors.text} /></Pressable></View>
          <AppText tone="muted">{t("platformBanners.previewHint")}</AppText>
          {previewBanner && <ParentPromotionSlider banners={[previewBanner]} interactive={false} sectionTitle={t(form?.audience === "PARENT_GLOBAL" ? "platformBanners.parentTitle" : "platformBanners.staffAdminTitle" as TranslationKey)} />}
          <AppText variant="caption" tone="muted">{form?.actionType !== "NONE" && hasValidAction(form) ? t("platformBanners.previewActionEnabled") : t("platformBanners.previewActionDisabled")}</AppText>
          <Button onPress={() => setPreviewVisible(false)}>{t("common.close")}</Button>
        </View>
      </View>
    </Modal>
  </AppScreen>;
}

const styles = StyleSheet.create({ filters: { gap: spacing.md }, filterGroup: { gap: spacing.xs }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, actionsNarrow: { flexDirection: "column", flexWrap: "nowrap" }, action: { flexGrow: 1, flexBasis: "30%" }, actionNarrow: { width: "100%", flexBasis: "auto" }, field: { gap: spacing.sm }, tenantOption: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, tenantOptionSelected: { borderColor: colors.primary, backgroundColor: colors.infoSoft }, tenantOptionPressed: { opacity: 0.75 }, bannerImage: { width: "100%", height: 180, borderRadius: radius.md }, formImagePreview: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md }, scheduleRow: { flexDirection: "row", gap: spacing.sm }, scheduleField: { flex: 1 }, previewBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md, backgroundColor: colors.overlay }, previewDialog: { width: "100%", maxWidth: 720, gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, previewTitle: { flex: 1 }, previewClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTint } });
