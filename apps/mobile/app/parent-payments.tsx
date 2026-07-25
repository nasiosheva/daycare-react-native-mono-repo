import { useMemo, useState } from "react";
import { Alert, Image, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useInvoices, useMarkInvoicePaid } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { BranchFilterControl } from "@/branches/BranchFilterSheet";

export default function ParentPaymentsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active === true;
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const [listOpen, setListOpen] = useState(false);
  const invoices = useInvoices({ branchId: filterBranchId });
  const markPaid = useMarkInvoicePaid();
  const client = useQueryClient();
  const [reviewInvoiceId, setReviewInvoiceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const proof = useQuery({ queryKey: ["payment-proof", reviewInvoiceId], queryFn: () => api.paymentProof(reviewInvoiceId!), enabled: Boolean(reviewInvoiceId) });
  const review = useMutation({ mutationFn: ({ invoiceId, approved, reason }: { invoiceId: string; approved: boolean; reason?: string }) => api.reviewPaymentProof(invoiceId, approved, reason), onSuccess: () => { void client.invalidateQueries({ queryKey: ["invoices", organizationId] }); setReviewInvoiceId(null); setRejectionReason(""); } });
  const pendingInvoices = useMemo(() => invoices.data?.filter((invoice) => invoice.status === "PENDING" || invoice.status === "PAYMENT_SUBMITTED") ?? [], [invoices.data]);
  const pendingTotal = useMemo(() => pendingInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0), [pendingInvoices]);
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;
  const pay = async (invoiceId: string) => {
    try { await markPaid.mutateAsync(invoiceId); }
    catch (error) { Alert.alert(t("billing.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const openReview = (invoiceId: string) => { setListOpen(false); setReviewInvoiceId(invoiceId); };
  const approveProof = async () => {
    if (!reviewInvoiceId) return;
    try { await review.mutateAsync({ invoiceId: reviewInvoiceId, approved: true }); }
    catch (error) { Alert.alert(t("billing.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const rejectProof = async () => {
    if (!reviewInvoiceId || !rejectionReason.trim()) return;
    try { await review.mutateAsync({ invoiceId: reviewInvoiceId, approved: false, reason: rejectionReason.trim() }); }
    catch (error) { Alert.alert(t("billing.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("staffAdmin.paymentsTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {!canManage && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <BranchFilterControl branchId={filterBranchId} onChange={setFilterBranchId} />
    <NavigationCard accessibilityLabel={t("staffAdmin.paymentsTitle")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("staffAdmin.paymentsTitle")}</AppText>
      <AppText variant="bodySmall" tone="muted">{t("staffAdmin.paymentsSubtitle")}</AppText>
      <AppText tone={pendingInvoices.length > 0 ? "danger" : "muted"}>{pendingInvoices.length > 0 ? t("staffAdmin.paymentsSummary", { count: pendingInvoices.length, amount: formatCurrency(pendingTotal) }) : t("staffAdmin.noPayments")}</AppText>
    </NavigationCard>
    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("staffAdmin.paymentsTitle")}>
      {pendingInvoices.map((invoice) => <View key={invoice.id} style={styles.card}>
        <AppText variant="h5">{invoice.childName}</AppText>
        <AppText tone="muted">{t("staffAdmin.parent")}: {invoice.parentName ?? invoice.parentEmail ?? t("common.noData")}</AppText>
        <AppText>{invoice.invoiceNumber} · {formatCurrency(invoice.totalAmount)}</AppText>
        <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>
        {invoice.status === "PAYMENT_SUBMITTED" ? <><AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>{canManage && <Button loading={review.isPending} onPress={() => openReview(invoice.id)}>{t("paymentProof.review")}</Button>}</> : canManage && <Button loading={markPaid.isPending} onPress={() => void pay(invoice.id)}>{t("billing.markPaid")}</Button>}
      </View>)}
      {!invoices.isLoading && pendingInvoices.length === 0 && <AppText tone="muted">{t("staffAdmin.noPayments")}</AppText>}
    </BottomSheet>
    <BottomSheet visible={Boolean(reviewInvoiceId)} onClose={() => setReviewInvoiceId(null)} closeAccessibilityLabel={t("common.close")} title={t("paymentProof.review")} negativeAction={{ label: t("common.cancel"), onPress: () => setReviewInvoiceId(null) }} positiveAction={{ label: t("paymentProof.verify"), loading: review.isPending, onPress: () => void approveProof() }}>
      {proof.isLoading ? <AppText>{t("common.loading")}</AppText> : proof.data && <Image source={{ uri: `data:${proof.data.contentType};base64,${proof.data.dataBase64}` }} style={styles.preview} resizeMode="contain" />}
      {proof.data?.note && <AppText tone="muted">{proof.data.note}</AppText>}
      <TextInput style={styles.input} multiline placeholder={t("paymentProof.rejectReason")} value={rejectionReason} onChangeText={setRejectionReason} />
      <Button variant="danger" loading={review.isPending} disabled={!rejectionReason.trim()} onPress={() => void rejectProof()}>{t("paymentProof.reject")}</Button>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, preview: { width: "100%", height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceTint }, input: { minHeight: 96, padding: spacing.sm, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface } });
