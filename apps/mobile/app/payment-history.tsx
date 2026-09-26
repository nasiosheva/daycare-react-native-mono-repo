import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Badge, BackButton, Button, Card, EmptyState, ErrorState, InfoRow, ShimmerList, spacing } from "@daycare/ui";
import type { InvoiceWithTenant } from "@/booking/useBooking";
import { useParentInvoicesAcrossTenants } from "@/booking/useBooking";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { invoiceSourceKey, invoiceStatusKey } from "@/i18n/translations";
import { statusTone } from "@/ui/statusTone";

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { profile, organizationId, selectOrganization } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const parentMemberships = (profile?.memberships ?? []).filter((item) => item.role === "PARENT" && item.active);
  const showsTenantLabel = parentMemberships.length > 1;
  const invoices = useParentInvoicesAcrossTenants(parentMemberships, true);
  const sorted = [...invoices.data].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (!profile) return null;
  if (membership?.role !== "PARENT") return <Redirect href="/home" />;

  const openPayment = (invoice: InvoiceWithTenant) => {
    selectOrganization(invoice.organizationId);
    router.push({ pathname: "/parent-payment", params: { invoiceId: invoice.id, organizationId: invoice.organizationId } });
  };

  return <AppScreen showBottomNavigation={false} title={t("paymentHistory.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    {invoices.isFetching && <ShimmerList />}
    {invoices.isError && !invoices.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void invoices.refetch()} />}
    {!invoices.isFetching && !invoices.isError && sorted.map((invoice) => <Card key={invoice.id} title={invoice.invoiceNumber} subtitle={`${invoice.childName}${showsTenantLabel ? ` · ${invoice.organizationName}` : ""}`} trailing={<Badge tone={statusTone(invoice.status)} label={t(invoiceStatusKey(invoice.status))} />}>
      <View style={styles.row}>
        <AppText tone="muted" style={styles.grow}>{invoice.description ?? t(invoiceSourceKey(invoice.source))}</AppText>
        <AppText variant="label">{formatCurrency(invoice.totalAmount)}</AppText>
      </View>
      <InfoRow icon="calendar-outline" label={t("parentEnrollment.dueDateLabel")} value={formatDate(invoice.dueDate)} />
      {invoice.status === "PENDING" && <Button onPress={() => openPayment(invoice)}>{t("parentEnrollment.pay")}</Button>}
      {invoice.status === "PAYMENT_SUBMITTED" && <AppText variant="caption" tone="muted">{t("paymentProof.awaitingReview")}</AppText>}
    </Card>)}
    {!invoices.isFetching && !invoices.isError && sorted.length === 0 && <EmptyState icon="receipt-outline" title={t("paymentHistory.empty")} />}
  </View></AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  grow: { flex: 1 },
});
