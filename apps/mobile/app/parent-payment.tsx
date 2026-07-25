import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function ParentPaymentScreen() {
  const router = useRouter(); const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>(); const { api } = useAuth(); const { t, formatCurrency, formatDate } = useI18n();
  const invoice = useQuery({ queryKey: ["invoice", invoiceId], queryFn: () => api.invoice(invoiceId!), enabled: Boolean(invoiceId) });
  const instructions = useQuery({ queryKey: ["payment-instructions"], queryFn: () => api.paymentInstructions(), enabled: Boolean(invoiceId) });
  return <AppScreen showBottomNavigation={false} title={t("parentEnrollment.pay")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText variant="title">{t("parentEnrollment.pay")}</AppText>
    {invoice.isLoading && <AppText tone="muted">{t("common.loading")}</AppText>}
    {invoice.data && <View style={styles.card}><AppText variant="heading">{invoice.data.invoiceNumber}</AppText><AppText>{invoice.data.childName} · {formatCurrency(invoice.data.totalAmount)}</AppText><AppText tone="muted">{t("tenant.dueDate", { date: formatDate(invoice.data.dueDate) })}</AppText></View>}
    <AppText variant="heading">{t("paymentInstruction.title")}</AppText>
    {instructions.isLoading && <AppText tone="muted">{t("common.loading")}</AppText>}
    {!instructions.isLoading && instructions.data?.length === 0 && <AppText tone="danger">{t("paymentInstruction.unavailable")}</AppText>}
    {instructions.data?.map((instruction) => <View key={instruction.id} style={styles.card}><AppText variant="heading">{instruction.name}</AppText><AppText>{instruction.accountHolder}</AppText><AppText selectable>{instruction.accountNumber}</AppText>{instruction.note && <AppText tone="muted">{instruction.note}</AppText>}</View>)}
    <Button disabled={!invoice.data || invoice.data.status !== "PENDING" || !instructions.data?.length} onPress={() => router.replace({ pathname: "/payment-proof", params: { invoiceId } })}>{t("parentEnrollment.uploadAfterPayment")}</Button>
  </View></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } });
