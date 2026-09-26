import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, Badge, BackButton, Banner, Button, Card, InfoRow, SectionHeader, ShimmerList, colors, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { invoiceSourceKey, invoiceStatusKey } from "@/i18n/translations";
import { statusTone } from "@/ui/statusTone";
import { PaymentSteps, paymentStepForInvoice } from "@/payment-proof/PaymentSteps";

export default function ParentPaymentScreen() {
  const router = useRouter();
  const { invoiceId: rawInvoiceId, organizationId: rawOrganizationId } = useLocalSearchParams<{ invoiceId?: string; organizationId?: string }>();
  const invoiceId = typeof rawInvoiceId === "string" ? rawInvoiceId : "";
  const routeOrganizationId = typeof rawOrganizationId === "string" ? rawOrganizationId : null;
  const { api, user } = useAuth();
  const paymentOrganizationId = routeOrganizationId;
  const invoiceScope = paymentOrganizationId ?? user?.uid ?? "payer-self";
  const { t, formatCurrency, formatDate } = useI18n();
  const invoice = useQuery({ queryKey: ["invoice", invoiceScope, invoiceId], queryFn: () => api.invoice(invoiceId), enabled: Boolean(invoiceId) });
  const instructions = useQuery({ queryKey: ["payment-instructions", paymentOrganizationId, "payer"], queryFn: () => api.paymentInstructions(paymentOrganizationId!), enabled: Boolean(paymentOrganizationId && invoiceId) });
  return <AppScreen showBottomNavigation={false} title={t("parentEnrollment.pay")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <PaymentSteps current={paymentStepForInvoice(invoice.data?.status, "instructions")} labels={[t("parentEnrollment.payStepTransfer"), t("parentEnrollment.payStepUpload"), t("parentEnrollment.payStepVerify")]} />
    {invoice.isLoading && <ShimmerList variant="tile" count={1} />}
    {invoice.data && <Card icon="receipt-outline" title={invoice.data.invoiceNumber} subtitle={invoice.data.childName} trailing={<Badge tone={statusTone(invoice.data.status)} label={t(invoiceStatusKey(invoice.data.status))} />}>
      <AppText variant="h3" style={styles.amount}>{formatCurrency(invoice.data.totalAmount)}</AppText>
      <InfoRow icon="document-text-outline" label={t("parentEnrollment.paymentFor")} value={invoice.data.description ?? t(invoiceSourceKey(invoice.data.source))} />
      <InfoRow icon="calendar-outline" label={t("parentEnrollment.dueDateLabel")} value={formatDate(invoice.data.dueDate)} />
    </Card>}
    <SectionHeader title={t("paymentInstruction.title")} description={instructions.data?.length ? t("paymentInstruction.transferHint") : undefined} />
    {!paymentOrganizationId && <Banner tone="warning" title={t("paymentInstruction.unavailable")} />}
    {instructions.isFetching && <ShimmerList />}
    {!instructions.isFetching && instructions.data?.length === 0 && <Banner tone="warning" title={t("paymentInstruction.unavailable")} />}
    {!instructions.isFetching && instructions.data?.map((instruction) => <Card key={instruction.id} icon="card-outline" title={instruction.name}>
      <InfoRow label={t("paymentInstruction.accountHolderLabel")} value={instruction.accountHolder} />
      <InfoRow label={t("paymentInstruction.accountNumberLabel")} value={<AppText variant="h5" selectable>{instruction.accountNumber}</AppText>} />
      {instruction.note && <AppText variant="bodySmall" tone="muted">{instruction.note}</AppText>}
    </Card>)}
    {invoice.data && invoice.data.status !== "PENDING" && <Banner tone={statusTone(invoice.data.status)} title={t(invoiceStatusKey(invoice.data.status))} message={invoice.data.status === "PAYMENT_SUBMITTED" ? t("paymentProof.awaitingReview") : undefined} />}
    <Button leadingIcon={<Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />} disabled={!invoice.data || invoice.data.status !== "PENDING" || !instructions.data?.length} onPress={() => router.replace({ pathname: "/payment-proof", params: { invoiceId, ...(paymentOrganizationId ? { organizationId: paymentOrganizationId } : {}) } })}>{t("parentEnrollment.uploadAfterPayment")}</Button>
  </View></AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  amount: { color: colors.primary },
});
