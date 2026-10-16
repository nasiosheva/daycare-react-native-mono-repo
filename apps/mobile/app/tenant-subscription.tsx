// Mories Deo Hutapea,S.E.,S.Kom
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, ShimmerList, TextField, spacing } from "@daycare/ui";
import type { TenantPaymentCorrectionCategory } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantPaymentStatusKey, tenantSubscriptionPlanKey, tenantSubscriptionStatusKey, type TranslationKey } from "@/i18n/translations";
import { statusTone } from "@/ui/statusTone";
import { notify } from "@/notify/notify";
import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";
import { getOrCreateIdempotencyKey, removeIdempotencyKey } from "@/idempotency/persistedIdempotencyKey";

export default function TenantSubscriptionScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [uploadingPaymentId, setUploadingPaymentId] = useState<string | null>(null);
  const [correctionPaymentId, setCorrectionPaymentId] = useState<string | null>(null);
  const [correctionCategory, setCorrectionCategory] = useState<TenantPaymentCorrectionCategory>("AMOUNT_MISMATCH");
  const [correctionDescription, setCorrectionDescription] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionReference, setCorrectionReference] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [renewalPreviewVisible, setRenewalPreviewVisible] = useState(false);
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const allowed = membership?.role === "STAFF_ADMIN" && membership.active;
  const renewalKey = useRef<string | null>(null);
  const subscription = useQuery({ queryKey: ["staff-tenant-subscription", organizationId], queryFn: () => api.staffTenantSubscription(), enabled: Boolean(allowed && organizationId) });
  const proofQueries = useQueries({ queries: (subscription.data?.payments ?? []).map((payment) => ({ queryKey: ["staff-tenant-payment-proofs", organizationId, payment.id], queryFn: () => api.ownTenantPaymentProofs(payment.id), enabled: Boolean(allowed && subscription.data?.paymentProofEnabled) })) });
  const correctionQueries = useQueries({ queries: (subscription.data?.payments ?? []).map((payment) => ({ queryKey: ["staff-tenant-payment-corrections", organizationId, payment.id], queryFn: () => api.ownTenantPaymentCorrections(payment.id), enabled: Boolean(allowed && subscription.data?.correctionEnabled) })) });
  const renew = useMutation({
    mutationFn: async () => {
      if (!renewalKey.current && organizationId) {
        const storageKey = `tenant-subscription-renewal:${organizationId}`;
        renewalKey.current = await getOrCreateIdempotencyKey(storageKey);
      }
      if (!renewalKey.current) throw new Error(t("auth.tryAgain"));
      return api.renewOwnTenantSubscription(renewalKey.current);
    },
    onSuccess: async () => {
      if (organizationId) await removeIdempotencyKey(`tenant-subscription-renewal:${organizationId}`);
      renewalKey.current = null;
      await queryClient.invalidateQueries({ queryKey: ["staff-tenant-subscription", organizationId] });
      notify(t("tenantSelf.renewSuccess"));
    },
    onError: (error) => notify(t("tenantSelf.renewFailed"), error instanceof Error ? error.message : t("auth.tryAgain")),
  });
  if (!profile) return null;
  if (!allowed) return <Redirect href="/home" />;

  const data = subscription.data;
  const hasPendingPayment = data?.payments.some((payment) => payment.status === "PENDING");
  const canRenew = Boolean(data?.monthlyFee && !hasPendingPayment && ["TRIAL", "ACTIVE", "GRACE", "EXPIRED"].includes(data.status));
  const confirmRenewal = () => setRenewalPreviewVisible(true);
  const submitRenewal = () => { setRenewalPreviewVisible(false); renew.mutate(); };
  const renewalPreview = data?.renewalPreview;
  const uploadProof = async (paymentId: string) => {
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
      if (selection.canceled) return;
      const file = selection.assets[0];
      if (!file || file.size == null || file.size <= 0 || file.size > 2 * 1024 * 1024) return notify(t("tenantSelf.proofSize"));
      const contentType = supportedProofType(file.mimeType, file.name);
      if (!contentType) return notify(t("tenantSelf.proofSize"));
      setUploadingPaymentId(paymentId);
      const storageKey = `tenant-subscription-proof:${organizationId}:${paymentId}`;
      const idempotencyKey = await getOrCreateIdempotencyKey(storageKey);
      await api.submitOwnTenantPaymentProof(paymentId, { fileName: file.name, contentType, fileBase64: await encodeLocalFileBase64(file.uri) }, idempotencyKey);
      await removeIdempotencyKey(storageKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-tenant-subscription", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["staff-tenant-payment-proofs", organizationId, paymentId] }),
      ]);
      notify(t("tenantSelf.proofSubmitted"));
    } catch (error) {
      notify(t("tenantSelf.proofFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    } finally {
      setUploadingPaymentId(null);
    }
  };
  const openCorrection = (paymentId: string) => {
    setCorrectionPaymentId(paymentId);
    setCorrectionCategory("AMOUNT_MISMATCH");
    setCorrectionDescription("");
    setCorrectionAmount("");
    setCorrectionReference("");
  };
  const closeCorrection = () => setCorrectionPaymentId(null);
  const submitCorrection = async () => {
    if (!organizationId || !correctionPaymentId || !correctionDescription.trim()) return notify(t("tenantSelf.correctionCategoryRequired"));
    const amountRequired = correctionCategory === "AMOUNT_MISMATCH" || correctionCategory === "DUPLICATE_OR_OVERPAYMENT";
    const amount = correctionAmount.trim() ? Number(correctionAmount) : undefined;
    if ((amountRequired && (!Number.isInteger(amount) || (amount ?? 0) <= 0)) || (correctionCategory === "WRONG_REFERENCE" && !correctionReference.trim())) return notify(t("tenantSelf.correctionCategoryRequired"));
    try {
      setSubmittingCorrection(true);
      const storageKey = `tenant-subscription-correction:${organizationId}:${correctionPaymentId}`;
      const idempotencyKey = await getOrCreateIdempotencyKey(storageKey);
      await api.createOwnTenantPaymentCorrection(correctionPaymentId, { category: correctionCategory, description: correctionDescription.trim(), ...(amountRequired ? { proposedAmount: amount } : {}), ...(correctionCategory === "WRONG_REFERENCE" ? { proposedReference: correctionReference.trim() } : {}) }, idempotencyKey);
      await removeIdempotencyKey(storageKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-tenant-subscription", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["staff-tenant-payment-corrections", organizationId, correctionPaymentId] }),
      ]);
      closeCorrection();
      notify(t("tenantSelf.correctionSubmitted"));
    } catch (error) {
      notify(t("tenantSelf.correctionFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    } finally {
      setSubmittingCorrection(false);
    }
  };

  return <AppScreen><View style={styles.content}>
    <BackButton onPress={() => router.back()} />
    <AppText variant="title">{t("tenantSelf.title")}</AppText>
    <AppText tone="muted">{t("tenantSelf.subtitle")}</AppText>
    {subscription.isLoading ? <ShimmerList variant="tile" count={2} /> : subscription.isError ? <ErrorState title={t("tenant.load")} onRetry={() => void subscription.refetch()} /> : data && <>
      <Card icon="business-outline" title={data.organizationName} subtitle={`${t("tenantSelf.plan")}: ${t(tenantSubscriptionPlanKey(data.plan))}`} trailing={<Badge tone={statusTone(data.status)} label={t(tenantSubscriptionStatusKey(data.status))} />}>
        <AppText>{t("tenantSelf.period")}: {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</AppText>
        <AppText>{t("tenantSelf.grace")}: {data.gracePeriodDays} {t("tenantSelf.days")}</AppText>
        {data.monthlyFee == null && <AppText tone="danger">{t("tenantSelf.noFee")}</AppText>}
        {hasPendingPayment && <AppText tone="muted">{t("tenantSelf.pendingExists")}</AppText>}
        <Button loading={renew.isPending} disabled={!canRenew || renew.isPending} onPress={confirmRenewal}>{t("tenantSelf.renew")}</Button>
      </Card>
      {data.paymentInstructions && <Card icon="information-circle-outline" title={t("tenantSelf.paymentInstructions")}><AppText>{data.paymentInstructions}</AppText></Card>}
      {!data.paymentProofEnabled && <AppText tone="muted">{t("tenantSelf.proofNotEnabled")}</AppText>}
      {!data.correctionEnabled && <AppText tone="muted">{t("tenantSelf.correctionNotEnabled")}</AppText>}
      <AppText variant="heading">{t("tenantSelf.payments")}</AppText>
      {data.payments.length ? data.payments.map((payment, index) => {
        const proof = proofQueries[index]?.data?.[0];
        const correction = correctionQueries[index]?.data?.[0];
        return <Card key={payment.id} icon="receipt-outline" title={payment.invoiceNumber} subtitle={formatCurrency(payment.amount)} trailing={<Badge tone={statusTone(payment.status)} label={t(tenantPaymentStatusKey(payment.status))} />}>
          <AppText tone="muted">{t("tenant.dueDate", { date: formatDate(payment.dueDate) })}</AppText>
          {payment.periodStart && payment.periodEnd && <AppText tone="muted">{formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}</AppText>}
          {proof && <AppText tone={proof.status === "REJECTED" ? "danger" : "muted"}>{proof.status === "REJECTED" ? t("tenantSelf.proofRejected", { reason: proof.rejectionReason ?? "" }) : proof.status === "VERIFIED" ? t(tenantPaymentStatusKey("PAID")) : t("tenantSelf.proofSubmitted")}</AppText>}
          {correction && <AppText tone={correction.status === "REJECTED" ? "danger" : "muted"}>{t(`tenantSelf.correctionStatus.${correction.status}` as TranslationKey)}{correction.reviewReason ? ` · ${correction.reviewReason}` : ""}</AppText>}
          {data.paymentProofEnabled && payment.status === "PENDING" && proof?.status !== "SUBMITTED" && proof?.status !== "VERIFIED" && <Button variant="secondary" loading={uploadingPaymentId === payment.id} disabled={uploadingPaymentId != null} onPress={() => void uploadProof(payment.id)}>{t("tenantSelf.proofUpload")}</Button>}
          {data.correctionEnabled && correction?.status !== "PENDING" && <Button variant="secondary" onPress={() => openCorrection(payment.id)}>{t("tenantSelf.correctionTitle")}</Button>}
        </Card>;
      }) : <EmptyState title={t("tenantSelf.empty")} />}
    </>}
  </View>
  <BottomSheet visible={Boolean(correctionPaymentId)} onClose={closeCorrection} closeAccessibilityLabel={t("common.close")} title={t("tenantSelf.correctionTitle")} negativeAction={{ label: t("tenantSelf.cancel"), onPress: closeCorrection }} positiveAction={{ label: t("tenantSelf.correctionSubmit"), loading: submittingCorrection, disabled: !correctionDescription.trim(), onPress: () => void submitCorrection() }}>
    <View style={styles.form}>
      <AppText tone="muted">{t("tenantSelf.correctionCategory")}</AppText>
      <ChipGroup>
        {CORRECTION_CATEGORIES.map((category) => <Chip key={category} label={t(`tenantSelf.correction.${category}`)} selected={correctionCategory === category} onPress={() => setCorrectionCategory(category)} />)}
      </ChipGroup>
      {(correctionCategory === "AMOUNT_MISMATCH" || correctionCategory === "DUPLICATE_OR_OVERPAYMENT") && <>
        <TextField label={t(correctionCategory === "DUPLICATE_OR_OVERPAYMENT" ? "tenantSelf.correctionTotalPaid" : "tenantSelf.correctionAmount")} keyboardType="numeric" value={correctionAmount} onChangeText={setCorrectionAmount} />
        {correctionCategory === "DUPLICATE_OR_OVERPAYMENT" && <AppText tone="muted">{t("tenantSelf.correctionTotalPaidHint")}</AppText>}
      </>}
      {correctionCategory === "WRONG_REFERENCE" && <TextField label={t("tenantSelf.correctionReference")} value={correctionReference} onChangeText={setCorrectionReference} />}
      <TextField label={t("tenantSelf.correctionDescription")} required multiline value={correctionDescription} onChangeText={setCorrectionDescription} />
    </View>
  </BottomSheet>
  <BottomSheet visible={renewalPreviewVisible} onClose={() => setRenewalPreviewVisible(false)} closeAccessibilityLabel={t("common.close")} title={t("tenantSelf.renew")} negativeAction={{ label: t("tenantSelf.cancel"), onPress: () => setRenewalPreviewVisible(false) }} positiveAction={{ label: t("tenantSelf.confirm"), loading: renew.isPending, onPress: submitRenewal }}>
    <View style={styles.form}>
      <AppText tone="muted">{t("tenantSelf.renewConfirm")}</AppText>
      {data?.monthlyFee != null && renewalPreview && <>
        <AppText>{t("tenantSelf.renewPreviewAmount", { amount: formatCurrency(data.monthlyFee) })}</AppText>
        <AppText>{t("tenantSelf.renewPreviewPeriod", { start: formatDate(renewalPreview.periodStart), end: formatDate(renewalPreview.periodEnd) })}</AppText>
        <AppText>{t("tenantSelf.renewPreviewDueDate", { date: formatDate(renewalPreview.dueDate) })}</AppText>
      </>}
    </View>
  </BottomSheet>
  </AppScreen>;
}

const CORRECTION_CATEGORIES: TenantPaymentCorrectionCategory[] = ["AMOUNT_MISMATCH", "WRONG_REFERENCE", "WRONG_PROOF_OR_INVOICE", "DUPLICATE_OR_OVERPAYMENT"];

function supportedProofType(mimeType: string | null | undefined, fileName: string): "application/pdf" | "image/jpeg" | "image/png" | null {
  const type = mimeType?.toLowerCase();
  if (type === "application/pdf" || type === "image/jpeg" || type === "image/png") return type;
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "pdf" ? "application/pdf" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : null;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, form: { gap: spacing.md } });
