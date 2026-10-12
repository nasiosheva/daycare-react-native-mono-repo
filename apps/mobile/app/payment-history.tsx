import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { AppText, Badge, BackButton, Button, Card, EmptyState, ErrorState, InfoRow, ShimmerList, spacing } from "@daycare/ui";
import type { InvoiceWithTenant } from "@/booking/useBooking";
import { useParentInvoicesAcrossTenants } from "@/booking/useBooking";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { invoiceSourceKey, invoiceStatusKey } from "@/i18n/translations";
import { statusTone } from "@/ui/statusTone";
import { TenantLoadFailureBanner } from "@/tenants/TenantLoadFailureBanner";

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const parentMemberships = (profile?.memberships ?? []).filter((item) => item.role === "PARENT" && item.active);
  const showsTenantLabel = parentMemberships.length > 1;
  const invoices = useParentInvoicesAcrossTenants(parentMemberships, true);
  const sorted = [...invoices.data].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (!profile) return null;
  if (membership?.role !== "PARENT") return <Redirect href="/home" />;

  // parent-payment resolves the invoice's tenant from this route param (per-action tenant
  // resolution, docs/business-rules.md §1), so no active-tenant switch is needed.
  const openPayment = (invoice: InvoiceWithTenant) => router.push({ pathname: "/parent-payment", params: { invoiceId: invoice.id, organizationId: invoice.organizationId } });
  const listAvailable = !invoices.isFetching && !invoices.allFailed;
  const showTenantFailureBanner = listAvailable && invoices.failedTenants.length > 0;
  // An unbounded, ever-growing history (no pagination) is exactly the case FlashList's
  // virtualization is for; render it through Screen's renderBody so it owns its own scroll
  // viewport instead of nesting inside Screen's ScrollView, which would defeat virtualization.
  const showList = listAvailable && sorted.length > 0;

  const renderInvoice = (invoice: InvoiceWithTenant) => <Card title={invoice.invoiceNumber} subtitle={`${invoice.childName}${showsTenantLabel ? ` · ${invoice.organizationName}` : ""}`} trailing={<Badge tone={statusTone(invoice.status)} label={t(invoiceStatusKey(invoice.status))} />}>
    <View style={styles.row}>
      <AppText tone="muted" style={styles.grow}>{invoice.description ?? t(invoiceSourceKey(invoice.source))}</AppText>
      <AppText variant="label">{formatCurrency(invoice.totalAmount)}</AppText>
    </View>
    <InfoRow icon="calendar-outline" label={t("parentEnrollment.dueDateLabel")} value={formatDate(invoice.dueDate)} />
    {invoice.status === "PENDING" && <Button onPress={() => openPayment(invoice)}>{t("parentEnrollment.pay")}</Button>}
    {invoice.status === "PAYMENT_SUBMITTED" && <AppText variant="caption" tone="muted">{t("paymentProof.awaitingReview")}</AppText>}
  </Card>;

  return <AppScreen
    showBottomNavigation={false}
    title={t("paymentHistory.title")}
    header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}
    renderBody={showList ? (bodyProps) => <FlashList
      data={sorted}
      keyExtractor={(invoice) => invoice.id}
      estimatedItemSize={220}
      renderItem={({ item }) => renderInvoice(item)}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={showTenantFailureBanner ? <TenantLoadFailureBanner failedTenants={invoices.failedTenants} onRetry={invoices.retryFailed} /> : null}
      ListHeaderComponentStyle={showTenantFailureBanner ? styles.listHeader : undefined}
      {...bodyProps}
    /> : undefined}
  >
    {!showList && <View style={styles.content}>
      {invoices.isFetching && <ShimmerList />}
      {invoices.allFailed && !invoices.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={invoices.retryFailed} />}
      {showTenantFailureBanner && <TenantLoadFailureBanner failedTenants={invoices.failedTenants} onRetry={invoices.retryFailed} />}
      {listAvailable && !showTenantFailureBanner && sorted.length === 0 && <EmptyState icon="receipt-outline" title={t("paymentHistory.empty")} />}
    </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  grow: { flex: 1 },
  separator: { height: spacing.md },
  listHeader: { marginBottom: spacing.md },
});
