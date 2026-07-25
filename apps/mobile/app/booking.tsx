import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import type { ServicePlan } from "@daycare/api-client";
import { useChildren } from "@/attendance/useAttendance";
import { useBookEntitlement, useBookings, useEntitlements, useInvoices, usePurchaseService, useServicePlans } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { bookingStatusKey, invoiceSourceKey, invoiceStatusKey, servicePlanTypeKey } from "@/i18n/translations";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";

type ListSheet = "plan" | "remaining" | "invoices" | "history" | null;

export default function BookingScreen() {
  const router = useRouter();
  const children = useChildren(); const plans = useServicePlans(); const entitlements = useEntitlements(); const bookings = useBookings(); const invoices = useInvoices(); const purchase = usePurchaseService(); const bookEntitlement = useBookEntitlement();
  const { t, formatCurrency, formatDate } = useI18n();
  const [childId, setChildId] = useState<string | null>(null); const [planId, setPlanId] = useState<string | null>(null); const [creditEntitlementId, setCreditEntitlementId] = useState<string | null>(null); const [dateInput, setDateInput] = useState(""); const [bookingDates, setBookingDates] = useState<string[]>([]);
  const [listSheet, setListSheet] = useState<ListSheet>(null);
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const plan = useMemo(() => plans.data?.find((item) => item.id === planId) ?? null, [plans.data, planId]);
  const creditEntitlement = useMemo(() => entitlements.data?.find((item) => item.id === creditEntitlementId) ?? null, [creditEntitlementId, entitlements.data]);
  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); }, [childId, children.data]);
  const activeEntitlement = useMemo(() => entitlements.data?.find((item) => item.childId === childId && item.status === "ACTIVE") ?? null, [entitlements.data, childId]);
  const pendingChildInvoices = useMemo(() => invoices.data?.filter((item) => item.childId === childId && item.status === "PENDING") ?? [], [invoices.data, childId]);
  const pendingChildInvoicesTotal = useMemo(() => pendingChildInvoices.reduce((sum, item) => sum + item.totalAmount, 0), [pendingChildInvoices]);
  const childBookings = useMemo(() => bookings.data?.filter((item) => item.childId === childId) ?? [], [bookings.data, childId]);
  const closeListSheet = () => setListSheet(null);
  const addDate = () => { if (!isIsoDate(dateInput)) return Alert.alert(t("booking.dateFormat"), t("booking.dateFormatDescription")); if (bookingDates.includes(dateInput)) return; setBookingDates((dates) => [...dates, dateInput].sort()); setDateInput(""); };
  const selectPlan = (item: ServicePlan) => { setPlanId(item.id); setCreditEntitlementId(null); setBookingDates([]); setDateInput(""); setListSheet(null); setBookFormOpen(true); };
  const useRemaining = (entitlementId: string, entitlementChildId: string) => { setCreditEntitlementId(entitlementId); setChildId(entitlementChildId); setBookingDates([]); setDateInput(""); setListSheet(null); setBookFormOpen(true); };
  const closeBookForm = () => { setBookFormOpen(false); setPlanId(null); setCreditEntitlementId(null); setBookingDates([]); setDateInput(""); };
  const submit = async () => {
    if (creditEntitlement) {
      if (bookingDates.length === 0) return Alert.alert(t("booking.selectDate"), t("booking.selectDateDescription"));
      try { await bookEntitlement.mutateAsync({ entitlementId: creditEntitlement.id, bookingDates }); closeBookForm(); Alert.alert(t("booking.created"), t("booking.usingCredit")); }
      catch (error) { Alert.alert(t("booking.createFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
      return;
    }
    if (!childId || !plan) return;
    const dates = plan.type === "MONTHLY" ? [] : bookingDates;
    if (plan.type !== "MONTHLY" && dates.length === 0) return Alert.alert(t("booking.selectDate"), t("booking.selectDateDescription"));
    try { await purchase.mutateAsync({ childId, planId: plan.id, bookingDates: dates }); closeBookForm(); Alert.alert(t("booking.orderCreated"), t("booking.orderDescription")); }
    catch (error) { Alert.alert(t("booking.orderFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen title={t("booking.title")}>
    <AppText tone="muted">{t("booking.subtitle")}</AppText>
    <AppText variant="heading">{t("booking.child")}</AppText><View style={styles.row}>{children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>
    <View style={styles.grid}>
      <NavigationCard accessibilityLabel={t("booking.plan")} onPress={() => setListSheet("plan")} style={styles.tile}>
        <AppText variant="label">{t("booking.plan")}</AppText>
        <AppText tone={activeEntitlement ? "default" : "muted"}>{activeEntitlement ? t("booking.activePlanSummary", { name: activeEntitlement.planName }) : t("booking.noActivePlan")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("booking.remaining")} onPress={() => setListSheet("remaining")} style={styles.tile}>
        <AppText variant="label">{t("booking.remaining")}</AppText>
        <AppText tone={activeEntitlement ? "default" : "muted"}>{activeEntitlement ? (activeEntitlement.remainingCredits == null ? t("booking.monthlyActive") : t("booking.remainingDays", { count: activeEntitlement.remainingCredits })) : t("booking.noActivePlan")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("booking.invoices")} onPress={() => setListSheet("invoices")} style={styles.tile}>
        <AppText variant="label">{t("booking.invoices")}</AppText>
        <AppText tone={pendingChildInvoices.length > 0 ? "danger" : "muted"}>{pendingChildInvoices.length > 0 ? t("booking.pendingInvoicesSummary", { count: pendingChildInvoices.length, amount: formatCurrency(pendingChildInvoicesTotal) }) : t("booking.noPendingInvoices")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("booking.history")} onPress={() => setListSheet("history")} style={styles.tile}>
        <AppText variant="label">{t("booking.history")}</AppText>
        <AppText tone="muted">{childBookings.length > 0 ? t("booking.historySummary", { count: childBookings.length }) : t("booking.noBookingsYet")}</AppText>
      </NavigationCard>
    </View>

    <BottomSheet visible={listSheet === "plan"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.plan")}>
      <AppText tone="muted">{t("booking.planDescription")}</AppText>
      {plans.isFetching && <ShimmerList />}
      {!plans.isFetching && plans.data?.map((item) => <PlanCard key={item.id} plan={item} selected={item.id === planId && !creditEntitlementId} onPress={() => selectPlan(item)} formatCurrency={formatCurrency} t={t} />)}
      {!plans.isFetching && plans.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={listSheet === "remaining"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.remaining")}>
      <AppText tone="muted">{t("booking.remainingDescription")}</AppText>
      {entitlements.isFetching && <ShimmerList />}
      {!entitlements.isFetching && entitlements.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.planName}</AppText><AppText>{item.remainingCredits == null ? t("booking.monthlyActive") : t("booking.remainingDays", { count: item.remainingCredits })}</AppText><AppText variant="caption" tone="muted">{t("booking.validUntil", { date: formatDate(item.validUntil) })}</AppText>{item.status === "ACTIVE" && (item.remainingCredits ?? 0) > 0 && <Button variant="secondary" onPress={() => useRemaining(item.id, item.childId)}>{t("booking.useRemaining")}</Button>}</View>)}
      {!entitlements.isFetching && entitlements.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={listSheet === "invoices"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.invoices")}>
      <AppText tone="muted">{t("booking.invoicesDescription")}</AppText>
      {invoices.isFetching && <ShimmerList />}
      {!invoices.isFetching && invoices.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.invoiceNumber} · {formatCurrency(item.totalAmount)}</AppText><AppText tone="muted">{item.description ?? t(invoiceSourceKey(item.source))}</AppText><AppText>{t("booking.dueDate", { status: t(invoiceStatusKey(item.status)), date: formatDate(item.dueDate) })}</AppText>{item.status === "PENDING" && <Button variant="secondary" onPress={() => router.push({ pathname: "/parent-payment", params: { invoiceId: item.id } })}>{t("parentEnrollment.pay")}</Button>}{item.status === "PAYMENT_SUBMITTED" && <AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>}</View>)}
      {!invoices.isFetching && invoices.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet visible={listSheet === "history"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.history")}>
      <AppText tone="muted">{t("booking.historyDescription")}</AppText>
      {bookings.isFetching && <ShimmerList />}
      {!bookings.isFetching && bookings.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.childName} · {formatDate(item.bookingDate)}</AppText><AppText>{item.planName} · {t(bookingStatusKey(item.status))}</AppText></View>)}
      {!bookings.isFetching && bookings.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    </BottomSheet>

    <BottomSheet
      visible={bookFormOpen}
      onClose={closeBookForm}
      closeAccessibilityLabel={t("common.close")}
      title={creditEntitlement?.planName ?? plan?.name ?? t("booking.plan")}
      negativeAction={{ label: t("common.cancel"), onPress: closeBookForm }}
      positiveAction={{ label: creditEntitlement ? t("booking.useCredit") : t("booking.createOrder"), loading: purchase.isPending || bookEntitlement.isPending, onPress: () => void submit() }}
    >
      {(creditEntitlement || plan?.type !== "MONTHLY") && <View style={styles.form}><AppText variant="label">{t("booking.bookingDate", { description: creditEntitlement ? t("booking.creditLimit", { count: creditEntitlement.remainingCredits ?? 0 }) : plan?.type === "DAILY" ? t("booking.oneDate") : t("booking.maximumDays", { count: plan?.creditCount ?? 0 }) })}</AppText><View style={styles.row}><View style={styles.datePicker}><DatePicker placeholder={t("booking.selectDate")} value={dateInput} onChange={setDateInput} minimumDate={formatIsoDate(new Date())} /></View><Button variant="secondary" onPress={addDate}>{t("booking.add")}</Button></View><AppText tone="muted">{bookingDates.join(", ") || t("booking.noDate")}</AppText></View>}
      {!creditEntitlement && plan?.type === "MONTHLY" && <AppText tone="muted">{t("booking.monthlyDescription")}</AppText>}
    </BottomSheet>
  </AppScreen>;
}
function PlanCard({ plan, selected, onPress, formatCurrency, t }: { plan: ServicePlan; selected: boolean; onPress: () => void; formatCurrency: (value: number) => string; t: ReturnType<typeof useI18n>["t"] }) { return <View style={styles.card}><AppText variant="heading">{plan.name}</AppText><AppText>{formatCurrency(plan.price)} · {t(servicePlanTypeKey(plan.type))}</AppText>{plan.type === "WEEKLY" && <AppText tone="muted">{t("booking.weeklyDays", { count: plan.creditCount ?? 0, policy: plan.unusedCreditPolicy === "CARRY_FORWARD" ? t("booking.carryForward") : t("booking.expire") })}</AppText>}<Button variant={selected ? "primary" : "secondary"} onPress={onPress}>{selected ? t("booking.selected") : t("booking.select")}</Button></View>; }
const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, tile: { flexGrow: 1, flexBasis: "47%" }, form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, datePicker: { flex: 1, minWidth: 180 }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint } });
