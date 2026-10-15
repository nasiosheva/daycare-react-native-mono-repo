// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, Card, EmptyState, ErrorState, ShimmerList, TabBar, TextField, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { tenantPaymentStatusKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import { openTenantPaymentProof } from "@/tenant-subscription/openPaymentProof";
import { createIdempotencyKey } from "@/idempotency/createIdempotencyKey";
import type { TenantPaymentCorrection, TenantPaymentProofContent } from "@daycare/api-client";

type ReviewDecision = { resourceId: string; kind: "proof" | "correction"; approved: boolean; idempotencyKey: string } | null;

export default function TenantSubscriptionReviewScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"proofs" | "corrections">("proofs");
  const [page, setPage] = useState(0);
  const [reminderPage, setReminderPage] = useState(0);
  const [decision, setDecision] = useState<ReviewDecision>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TenantPaymentProofContent | null>(null);
  const [openingProofId, setOpeningProofId] = useState<string | null>(null);
  const features = useQuery({ queryKey: ["platform-tenant-subscription-features"], queryFn: () => api.platformTenantSubscriptionFeatures(), enabled: Boolean(profile?.isPlatformAdmin) });
  const reminders = useQuery({ queryKey: ["platform-tenant-subscription-reminders", reminderPage], queryFn: () => api.platformTenantSubscriptionReminders(reminderPage), enabled: Boolean(profile?.isPlatformAdmin) });
  const proofs = useQuery({ queryKey: ["platform-tenant-subscription-proofs", page], queryFn: () => api.platformTenantPaymentProofQueue(page), enabled: Boolean(profile?.isPlatformAdmin && features.data?.paymentProofEnabled && tab === "proofs") });
  const corrections = useQuery({ queryKey: ["platform-tenant-subscription-corrections", page], queryFn: () => api.platformTenantPaymentCorrectionQueue(page), enabled: Boolean(profile?.isPlatformAdmin && features.data?.correctionEnabled && tab === "corrections") });
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const closeDecision = () => { setDecision(null); setReason(""); };
  const submitDecision = async () => {
    if (!decision || reason.trim().length < 3) return;
    try {
      setBusy(true);
      if (decision.kind === "proof") await api.reviewTenantPaymentProof(decision.resourceId, decision.approved, reason.trim(), decision.idempotencyKey);
      else await api.reviewTenantPaymentCorrection(decision.resourceId, decision.approved, reason.trim(), decision.idempotencyKey);
      closeDecision();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform-tenant-subscription-proofs"] }),
        queryClient.invalidateQueries({ queryKey: ["platform-tenant-subscription-corrections"] }),
        queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["platform-tenant"] }),
      ]);
      notify(t("tenantSubscriptionReview.saved"));
    } catch (error) {
      notify(t("tenantSubscriptionReview.failed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    } finally {
      setBusy(false);
    }
  };
  const viewProof = async (proofId: string) => {
    try {
      setOpeningProofId(proofId);
      setPreview(await api.tenantPaymentProofContent(proofId));
    } catch (error) {
      notify(t("tenantSubscriptionReview.openFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    } finally {
      setOpeningProofId(null);
    }
  };
  const openPdf = async () => {
    if (!preview) return;
    try { await openTenantPaymentProof(preview); }
    catch (error) { notify(t("tenantSubscriptionReview.openFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const list = tab === "proofs" ? proofs.data : corrections.data;
  const loading = tab === "proofs" ? proofs.isLoading : corrections.isLoading;
  const error = tab === "proofs" ? proofs.isError : corrections.isError;
  const hasNext = tab === "proofs" ? proofs.data?.hasNext : corrections.data?.hasNext;
  const isEnabled = tab === "proofs" ? features.data?.paymentProofEnabled : features.data?.correctionEnabled;

  return <AppScreen>
    <BackButton onPress={() => router.back()} />
    <AppText variant="title">{t("tenantSubscriptionReview.title")}</AppText>
    <Card icon="notifications-outline" title={t("tenantSubscriptionReminder.title")}>
      {reminders.isLoading ? <ShimmerList variant="tile" count={2} /> : reminders.isError ? <Button variant="secondary" onPress={() => void reminders.refetch()}>{t("tenantSubscriptionReminder.retry")}</Button> : reminders.data?.items.length ? <>
        {reminders.data.items.map((reminder) => <View key={reminder.id} style={styles.reminderItem}>
          <AppText variant="label">{reminder.organizationName} · {t(`tenantSubscriptionReminder.${reminder.eventType}` as TranslationKey)}</AppText>
          <AppText tone="muted">{t("tenantSubscriptionReminder.due", { date: formatDate(reminder.eventDate), days: reminder.leadDays })}</AppText>
        </View>)}
        {reminders.data.hasNext && <Button variant="secondary" onPress={() => setReminderPage((value) => value + 1)}>{t("tenantSubscriptionReminder.next")}</Button>}
      </> : <AppText tone="muted">{t("tenantSubscriptionReminder.empty")}</AppText>}
    </Card>
    {features.isLoading ? <ShimmerList variant="tile" count={1} /> : features.isError ? <ErrorState title={t("tenantSubscriptionReview.loadFailed")} onRetry={() => void features.refetch()} /> : <>
      <TabBar accessibilityLabel={t("tenantSubscriptionReview.title")} selected={tab} onSelect={(key) => { setTab(key as typeof tab); setPage(0); setPreview(null); }} items={[{ key: "proofs", label: t("tenantSubscriptionReview.proofs") }, { key: "corrections", label: t("tenantSubscriptionReview.corrections") }]} />
      {!isEnabled ? <Card icon="lock-closed-outline" title={t("tenantSubscriptionReview.disabled")}><AppText tone="muted">{t("tenantSubscriptionReview.disabledInfo")}</AppText></Card> : <>
        {loading && <ShimmerList variant="tile" count={3} />}
        {error && <Button variant="secondary" onPress={() => void (tab === "proofs" ? proofs.refetch() : corrections.refetch())}>{t("tenant.reload")}</Button>}
        {!loading && !error && !list?.items.length && <EmptyState title={t("tenantSubscriptionReview.empty")} />}
        {tab === "proofs" && proofs.data?.items.map((proof) => <Card key={proof.id} icon="receipt-outline" title={proof.organizationName} subtitle={`${proof.invoiceNumber} · ${formatCurrency(proof.paymentAmount)}`}>
          <AppText>{proof.fileName} · v{proof.version} · {t("tenantSubscriptionReview.uploaded", { date: formatDate(proof.uploadedAt.slice(0, 10)) })}</AppText>
          <AppText tone="muted">{t("tenant.dueDate", { date: formatDate(proof.dueDate) })}</AppText>
          <Button variant="secondary" loading={openingProofId === proof.id} disabled={openingProofId != null} onPress={() => void viewProof(proof.id)}>{t("tenantSubscriptionReview.viewProof")}</Button>
          <View style={styles.actions}>
            <Button onPress={() => { setDecision({ resourceId: proof.id, kind: "proof", approved: true, idempotencyKey: createIdempotencyKey() }); setReason(""); }}>{t("tenantSubscriptionReview.approve")}</Button>
            <Button variant="secondary" onPress={() => { setDecision({ resourceId: proof.id, kind: "proof", approved: false, idempotencyKey: createIdempotencyKey() }); setReason(""); }}>{t("tenantSubscriptionReview.reject")}</Button>
          </View>
        </Card>)}
        {tab === "corrections" && corrections.data?.items.map((correction) => <CorrectionCard key={correction.id} correction={correction} formatCurrency={formatCurrency} formatDate={formatDate} t={t} onReview={(approved) => { setDecision({ resourceId: correction.id, kind: "correction", approved, idempotencyKey: createIdempotencyKey() }); setReason(""); }} />)}
        {hasNext && <Button variant="secondary" onPress={() => setPage((value) => value + 1)}>{t("tenant.pageNext")}</Button>}
        {page > 0 && <Button variant="secondary" onPress={() => setPage((value) => Math.max(0, value - 1))}>{t("tenant.pagePrevious")}</Button>}
      </>}
    </>}
    <BottomSheet visible={Boolean(decision)} onClose={closeDecision} closeAccessibilityLabel={t("common.close")} title={decision?.approved ? t("tenantSubscriptionReview.approveTitle") : t("tenantSubscriptionReview.rejectTitle")} negativeAction={{ label: t("tenantSelf.cancel"), onPress: closeDecision }} positiveAction={{ label: decision?.approved ? t("tenantSubscriptionReview.approve") : t("tenantSubscriptionReview.reject"), loading: busy, disabled: reason.trim().length < 3, onPress: () => void submitDecision() }}>
      <View style={styles.form}><AppText tone="muted">{t("tenantSubscriptionReview.reasonRequired")}</AppText><TextField label={t("tenantSubscriptionReview.reason")} required multiline value={reason} onChangeText={setReason} /></View>
    </BottomSheet>
    <BottomSheet visible={Boolean(preview)} onClose={() => setPreview(null)} closeAccessibilityLabel={t("common.close")} title={preview?.fileName} negativeAction={{ label: t("tenantSelf.cancel"), onPress: () => setPreview(null) }} positiveAction={preview?.contentType === "application/pdf" ? { label: t("tenantSubscriptionReview.openPdf"), onPress: () => void openPdf() } : undefined}>
      {preview?.contentType.startsWith("image/") && <Image accessibilityLabel={preview.fileName} source={{ uri: `data:${preview.contentType};base64,${preview.fileBase64}` }} resizeMode="contain" style={styles.previewImage} />}
      {preview?.contentType === "application/pdf" && <AppText tone="muted">{t("tenantSubscriptionReview.pdfInfo")}</AppText>}
    </BottomSheet>
  </AppScreen>;
}

function CorrectionCard({ correction, formatCurrency, formatDate, t, onReview }: { correction: TenantPaymentCorrection; formatCurrency: (amount: number) => string; formatDate: (date: string) => string; t: (key: TranslationKey, params?: Record<string, string | number>) => string; onReview: (approved: boolean) => void }) {
  return <Card icon="create-outline" title={correction.organizationName} subtitle={`${correction.invoiceNumber} · ${formatCurrency(correction.paymentAmount)} · ${t(`tenantSelf.correction.${correction.category}` as TranslationKey)}`}>
    <AppText>{correction.description}</AppText>
    <AppText tone="muted">{t("tenant.paymentHistory")}: {t(tenantPaymentStatusKey(correction.paymentStatus))}</AppText>
    {correction.proposedAmount != null && <AppText>{t("tenantSubscriptionReview.proposedAmount")}: {formatCurrency(correction.proposedAmount)}</AppText>}
    {correction.proposedReference && <AppText>{t("tenantSubscriptionReview.proposedReference")}: {correction.proposedReference}</AppText>}
    <AppText tone="muted">{t("tenantSubscriptionReview.submitted", { date: formatDate(correction.createdAt.slice(0, 10)) })}</AppText>
    <View style={styles.actions}>
      <Button onPress={() => onReview(true)}>{t("tenantSubscriptionReview.approve")}</Button>
      <Button variant="secondary" onPress={() => onReview(false)}>{t("tenantSubscriptionReview.reject")}</Button>
    </View>
  </Card>;
}

const styles = StyleSheet.create({ actions: { flexDirection: "row", gap: spacing.sm }, form: { gap: spacing.md }, previewImage: { width: "100%", height: 420 }, reminderItem: { gap: spacing.xs, paddingVertical: spacing.sm }});
