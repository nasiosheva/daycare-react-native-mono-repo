import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BackButton, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import type { InvoiceWithTenant } from "@/booking/useBooking";
import { useParentInvoicesAcrossTenants } from "@/booking/useBooking";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { invoiceSourceKey, invoiceStatusKey } from "@/i18n/translations";

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
    {invoices.isError && <Button variant="secondary" onPress={() => invoices.refetch()}>{t("common.retry")}</Button>}
    {!invoices.isFetching && !invoices.isError && sorted.map((invoice) => <View key={invoice.id} style={styles.card}>
      <View style={styles.row}><AppText variant="heading">{invoice.invoiceNumber}</AppText><AppText variant="caption" tone="muted">{t(invoiceStatusKey(invoice.status))}</AppText></View>
      <AppText tone="muted">{invoice.childName}{showsTenantLabel ? ` · ${invoice.organizationName}` : ""}</AppText>
      <AppText>{invoice.description ?? t(invoiceSourceKey(invoice.source))} · {formatCurrency(invoice.totalAmount)}</AppText>
      <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>
      {invoice.status === "PENDING" && <Button onPress={() => openPayment(invoice)}>{t("parentEnrollment.pay")}</Button>}
      {invoice.status === "PAYMENT_SUBMITTED" && <AppText variant="caption" tone="muted">{t("paymentProof.awaitingReview")}</AppText>}
    </View>)}
    {!invoices.isFetching && !invoices.isError && sorted.length === 0 && <AppText tone="muted">{t("paymentHistory.empty")}</AppText>}
  </View></AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
});
