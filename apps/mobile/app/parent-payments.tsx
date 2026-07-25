import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useMarkInvoicePaid } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { invoiceSourceKey } from "@/i18n/translations";

export default function ParentPaymentsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active === true;
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: Boolean(organizationId) });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const invoices = useQuery({ queryKey: ["invoices", organizationId, { branchId: filterBranchId }, debouncedSearch], queryFn: () => api.invoices({ branchId: filterBranchId }, debouncedSearch || undefined), enabled: Boolean(organizationId) });
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
  const openReview = (invoiceId: string) => setReviewInvoiceId(invoiceId);
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <BranchTab label={t("branchFilter.allBranches")} selected={!filterBranchId} onPress={() => setFilterBranchId(undefined)} />
      {branches.data?.map((branch) => <BranchTab key={branch.id} label={branch.name} selected={filterBranchId === branch.id} onPress={() => setFilterBranchId(branch.id)} />)}
    </ScrollView>
    <TextInput style={styles.searchInput} placeholder={t("staffAdmin.paymentsSearch")} value={search} onChangeText={setSearch} />
    <AppText variant="bodySmall" tone="muted">{t("staffAdmin.paymentsSubtitle")}</AppText>
    <AppText tone={pendingInvoices.length > 0 ? "danger" : "muted"}>{pendingInvoices.length > 0 ? t("staffAdmin.paymentsSummary", { count: pendingInvoices.length, amount: formatCurrency(pendingTotal) }) : t("staffAdmin.noPayments")}</AppText>
    {pendingInvoices.map((invoice) => <View key={invoice.id} style={styles.card}>
      <AppText variant="h5">{invoice.childName}</AppText>
      <AppText tone="muted">{invoice.description ?? t(invoiceSourceKey(invoice.source))}</AppText>
      <AppText tone="muted">{t("staffAdmin.parent")}: {invoice.parentName ?? invoice.parentEmail ?? t("common.noData")}</AppText>
      <AppText>{invoice.invoiceNumber} · {formatCurrency(invoice.totalAmount)}</AppText>
      <AppText variant="caption" tone="muted">{t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>
      {invoice.status === "PAYMENT_SUBMITTED" ? <><AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>{canManage && <Button loading={review.isPending} onPress={() => openReview(invoice.id)}>{t("paymentProof.review")}</Button>}</> : canManage && <Button loading={markPaid.isPending} onPress={() => void pay(invoice.id)}>{t("billing.markPaid")}</Button>}
    </View>)}
    {!invoices.isLoading && pendingInvoices.length === 0 && <AppText tone="muted">{t("staffAdmin.noPayments")}</AppText>}
    <BottomSheet visible={Boolean(reviewInvoiceId)} onClose={() => setReviewInvoiceId(null)} closeAccessibilityLabel={t("common.close")} title={t("paymentProof.review")} negativeAction={{ label: t("common.cancel"), onPress: () => setReviewInvoiceId(null) }} positiveAction={{ label: t("paymentProof.verify"), loading: review.isPending, onPress: () => void approveProof() }}>
      {proof.isLoading ? <AppText>{t("common.loading")}</AppText> : proof.data && <Image source={{ uri: `data:${proof.data.contentType};base64,${proof.data.dataBase64}` }} style={styles.preview} resizeMode="contain" />}
      {proof.data?.note && <AppText tone="muted">{proof.data.note}</AppText>}
      <TextInput style={styles.input} multiline placeholder={t("paymentProof.rejectReason")} value={rejectionReason} onChangeText={setRejectionReason} />
      <Button variant="danger" loading={review.isPending} disabled={!rejectionReason.trim()} onPress={() => void rejectProof()}>{t("paymentProof.reject")}</Button>
    </BottomSheet>
  </AppScreen>;
}

function BranchTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
  searchInput: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  preview: { width: "100%", height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  input: { minHeight: 96, padding: spacing.sm, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});
