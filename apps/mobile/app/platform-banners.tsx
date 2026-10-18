// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlatformBanner, PlatformBannerStatus } from "@daycare/api-client";
import { AppText, BackButton, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, ToggleSwitch, colors, radius, spacing, type Tone } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { isValidHttpsImageUrl, isValidHttpsUrl } from "@/media/imageUrl";
import { parentActionPages, type ParentActionType, type ParentActionPage } from "@daycare/core";
import type { TranslationKey } from "@/i18n/translations";
import { FallbackImage } from "@/media/FallbackImage";
import { ParentPromotionSlider } from "@/home/ParentPromotionSlider";

type FormState = { id?: string; title: string; body: string; imageUrl: string; actionType: ParentActionType; actionTarget: string; expiresDate: string; expiresTime: string };
const JAKARTA_OFFSET = "+07:00";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1_000;
const expiryInstant = (date: string, time: string): Date | null | undefined => {
  if (!date && !time) return null;
  if (!date || !time) return undefined;
  const result = new Date(`${date}T${time}:00${JAKARTA_OFFSET}`);
  return Number.isNaN(result.getTime()) ? undefined : result;
};
const emptyForm = (): FormState => ({ title: "", body: "", imageUrl: "", actionType: "NONE", actionTarget: "", expiresDate: "", expiresTime: "" });
const formFromBanner = (banner: PlatformBanner): FormState => {
  const localWib = banner.expiresAt ? new Date(new Date(banner.expiresAt).getTime() + JAKARTA_OFFSET_MS).toISOString() : "";
  return { id: banner.id, title: banner.title, body: banner.body, imageUrl: banner.imageUrl, actionType: banner.actionType ?? "NONE", actionTarget: banner.actionTarget ?? "", expiresDate: localWib.slice(0, 10), expiresTime: localWib.slice(11, 16) };
};
const hasValidAction = (form: FormState | null): boolean => !form || form.actionType === "NONE" || (form.actionType === "OPEN_BROWSER" ? isValidHttpsUrl(form.actionTarget) : parentActionPages.includes(form.actionTarget as ParentActionPage));
const hasValidExpiry = (form: FormState | null): boolean => {
  if (!form) return true;
  const expiry = expiryInstant(form.expiresDate, form.expiresTime);
  return expiry === null || Boolean(expiry && expiry.getTime() > Date.now());
};

export default function PlatformBannersScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const canManage = Boolean(profile?.isPlatformAdmin);
  const canRead = profile?.registrationRole === "PARENT";
  const banners = useQuery({
    queryKey: [canManage ? "platform-banners" : "parent-platform-banners"],
    queryFn: () => canManage ? api.platformBanners() : api.parentPlatformBanners(),
    enabled: canManage || canRead,
  });
  const [form, setForm] = useState<FormState | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<PlatformBanner | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform-banners"] });
    void queryClient.invalidateQueries({ queryKey: ["parent-platform-banners"] });
  };
  const save = useMutation({ mutationFn: (input: FormState) => {
    const payload = { title: input.title.trim(), body: input.body.trim(), imageUrl: input.imageUrl.trim(), actionType: input.actionType, actionTarget: input.actionType === "NONE" ? undefined : input.actionTarget.trim(), expiresAt: expiryInstant(input.expiresDate, input.expiresTime)?.toISOString() ?? null };
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
  const statusTone = (status: PlatformBannerStatus): Tone => status === "PUBLISHED" ? "success" : status === "DRAFT" ? "neutral" : status === "SCHEDULED" ? "info" : "warning";
  const submitForm = () => {
    if (!form?.title.trim() || !form.body.trim() || !isValidHttpsImageUrl(form.imageUrl) || !hasValidAction(form) || !hasValidExpiry(form)) return;
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
    body: form.body.trim() || t("platformBanners.previewBody"),
    imageUrl: form.imageUrl.trim(),
    actionType: form.actionType,
    actionTarget: form.actionTarget || null,
    status: "PUBLISHED",
    publishedAt: new Date().toISOString(),
    expiresAt: expiryInstant(form.expiresDate, form.expiresTime)?.toISOString() ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : null;

  return <AppScreen showBottomNavigation={false} title={t(canManage ? "platformBanners.title" : "platformBanners.parentTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("platformBanners.create")} onPress={() => setForm(emptyForm())}>{t("platformBanners.create")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t(canManage ? "platformBanners.description" : "platformBanners.parentDescription")}</AppText>
    {banners.isLoading && <ShimmerList />}
    {banners.isError && !banners.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void banners.refetch()} />}
    {!banners.isLoading && !banners.isError && banners.data?.map((banner) => <Card key={banner.id} icon="images-outline" title={banner.title} subtitle={formatDateTime(banner.publishedAt ?? banner.scheduledAt ?? banner.createdAt)} trailing={canManage ? <Badge tone={statusTone(banner.status)} label={statusLabel(banner.status)} /> : undefined}>
      <FallbackImage key={`${banner.id}:${banner.imageUrl}`} accessibilityLabel={banner.title} fallbackLabel={t("operations.imageUnavailable")} uri={banner.imageUrl} style={styles.bannerImage} />
      <AppText>{banner.body}</AppText>
      {canManage && banner.expiresAt && <AppText variant="caption" tone="muted">{t("platformBanners.expiresAt", { date: formatDateTime(banner.expiresAt) })}</AppText>}
      {canManage && <View style={styles.actions}>
        {banner.status === "DRAFT" && <><Button style={styles.action} variant="secondary" onPress={() => setForm(formFromBanner(banner))}>{t("common.edit")}</Button><Button style={styles.action} variant="secondary" onPress={() => { setScheduleTarget(banner); setScheduledDate(formatIsoDate(new Date())); setScheduledTime(""); }}>{t("operations.schedule")}</Button><Button style={styles.action} loading={publish.isPending} onPress={() => void publish.mutateAsync(banner.id).catch((error: unknown) => notify(t("platformBanners.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.publish")}</Button></>}
        {(banner.status === "PUBLISHED" || banner.status === "SCHEDULED") && <Button variant="secondary" loading={close.isPending} onPress={() => void close.mutateAsync(banner.id).catch((error: unknown) => notify(t("platformBanners.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.close")}</Button>}
      </View>}
    </Card>)}
    {!banners.isLoading && !banners.isError && banners.data?.length === 0 && <EmptyState icon="megaphone-outline" title={t("platformBanners.empty")} action={canManage ? { label: t("platformBanners.create"), onPress: () => setForm(emptyForm()) } : undefined} />}
    <BottomSheet visible={form !== null} onClose={() => { setForm(null); setPreviewVisible(false); }} closeAccessibilityLabel={t("common.close")} title={t(form?.id ? "platformBanners.edit" : "platformBanners.create")} negativeAction={{ label: t("common.cancel"), onPress: () => { setForm(null); setPreviewVisible(false); } }} positiveAction={{ label: t("common.save"), disabled: !form?.title.trim() || !form.body.trim() || !isValidHttpsImageUrl(form.imageUrl) || !hasValidAction(form) || !hasValidExpiry(form), loading: save.isPending, onPress: submitForm }}>
      <Button variant="secondary" disabled={!previewBanner} onPress={() => setPreviewVisible(true)}>{t("platformBanners.preview")}</Button>
      <TextField label={t("operations.announcementTitle")} required value={form?.title ?? ""} onChangeText={(title) => setForm((current) => current ? { ...current, title } : current)} maxLength={160} />
      <TextField label={t("platformBanners.imageUrl")} required value={form?.imageUrl ?? ""} onChangeText={(imageUrl) => setForm((current) => current ? { ...current, imageUrl } : current)} maxLength={2_048} autoCapitalize="none" keyboardType="url" />
      {form?.imageUrl && isValidHttpsImageUrl(form.imageUrl) && <FallbackImage key={form.imageUrl.trim()} accessibilityLabel={form.title || t("platformBanners.imageUrl")} fallbackLabel={t("operations.imageUnavailable")} uri={form.imageUrl.trim()} style={styles.formImagePreview} />}
      <ToggleSwitch label={t("platformBanners.clickable")} accessibilityLabel={t("platformBanners.clickable")} value={form?.actionType !== undefined && form.actionType !== "NONE"} onValueChange={(enabled) => setForm((current) => current ? { ...current, actionType: enabled ? "OPEN_BROWSER" : "NONE", actionTarget: "" } : current)} />
      {form && form.actionType !== "NONE" && <View style={styles.field}>
        <AppText variant="label">{t("operations.actionType")}</AppText>
        <ChipGroup accessibilityLabel={t("operations.actionType")}>
          <Chip label={t("operations.openBrowser")} selected={form.actionType === "OPEN_BROWSER"} onPress={() => setForm((current) => current ? { ...current, actionType: "OPEN_BROWSER", actionTarget: "" } : current)} />
          <Chip label={t("operations.openAppPage")} selected={form.actionType === "OPEN_APP_PAGE"} onPress={() => setForm((current) => current ? { ...current, actionType: "OPEN_APP_PAGE", actionTarget: "" } : current)} />
        </ChipGroup>
        {form.actionType === "OPEN_BROWSER" ? <TextField label={t("operations.actionUrl")} required value={form.actionTarget} onChangeText={(actionTarget) => setForm((current) => current ? { ...current, actionTarget } : current)} maxLength={2_048} autoCapitalize="none" keyboardType="url" /> : <><AppText variant="label">{t("operations.actionPage")}</AppText><ChipGroup accessibilityLabel={t("operations.actionPage")}>{parentActionPages.map((page) => <Chip key={page} label={t(`operations.actionPage.${page}` as TranslationKey)} selected={form.actionTarget === page} onPress={() => setForm((current) => current ? { ...current, actionTarget: page } : current)} />)}</ChipGroup></>}
      </View>}
      <TextField label={t("operations.message")} required value={form?.body ?? ""} onChangeText={(body) => setForm((current) => current ? { ...current, body } : current)} multiline maxLength={4_000} />
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
          {previewBanner && <ParentPromotionSlider banners={[previewBanner]} interactive={false} />}
          <AppText variant="caption" tone="muted">{form?.actionType !== "NONE" && hasValidAction(form) ? t("platformBanners.previewActionEnabled") : t("platformBanners.previewActionDisabled")}</AppText>
          <Button onPress={() => setPreviewVisible(false)}>{t("common.close")}</Button>
        </View>
      </View>
    </Modal>
  </AppScreen>;
}

const styles = StyleSheet.create({ actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, action: { flexGrow: 1, flexBasis: "30%" }, field: { gap: spacing.sm }, bannerImage: { width: "100%", height: 180, borderRadius: radius.md }, formImagePreview: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md }, scheduleRow: { flexDirection: "row", gap: spacing.sm }, scheduleField: { flex: 1 }, previewBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md, backgroundColor: colors.overlay }, previewDialog: { width: "100%", maxWidth: 720, gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, previewTitle: { flex: 1 }, previewClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTint } });
