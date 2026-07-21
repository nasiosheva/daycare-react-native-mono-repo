import { Alert, StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useInvoices, useMarkInvoicePaid } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";

export default function ParentPaymentsScreen() {
  const { profile, organizationId } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const invoices = useInvoices();
  const markPaid = useMarkInvoicePaid();
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;
  const pendingInvoices = invoices.data?.filter((invoice) => invoice.status === "PENDING") ?? [];
  const pay = async (invoiceId: string) => {
    try { await markPaid.mutateAsync(invoiceId); }
    catch (error) { Alert.alert(t("billing.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("staffAdmin.paymentsTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("staffAdmin.paymentsSubtitle")}</AppText>
    {pendingInvoices.map((invoice) => <View key={invoice.id} style={styles.card}>
      <AppText variant="h5">{invoice.childName}</AppText>
      <AppText tone="muted">{t("staffAdmin.parent")}: {invoice.parentName ?? invoice.parentEmail ?? t("common.noData")}</AppText>
      <AppText>{invoice.invoiceNumber} · {formatCurrency(invoice.totalAmount)}</AppText>
      <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>
      <Button loading={markPaid.isPending} onPress={() => void pay(invoice.id)}>{t("billing.markPaid")}</Button>
    </View>)}
    {!invoices.isLoading && pendingInvoices.length === 0 && <AppText tone="muted">{t("staffAdmin.noPayments")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } });
