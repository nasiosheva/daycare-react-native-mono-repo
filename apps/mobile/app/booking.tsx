import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, MenuItem, NavigationCard, SectionHeader, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { AppScreen } from "@/navigation/AppScreen";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";
import type { ServicePlan } from "@daycare/api-client";
import { useChildren } from "@/attendance/useAttendance";
import { useBookEntitlement, useBookings, useEntitlements, useInvoices, usePurchaseService, useServicePlans } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { bookingStatusKey, invoiceSourceKey, invoiceStatusKey, servicePlanTypeKey } from "@/i18n/translations";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";
import { useAuth } from "@/auth/AuthProvider";

type ListSheet = "plan" | "remaining" | "invoices" | "history" | null;

export default function BookingScreen() {
  return <LegacyDaycareRouteGuard policy={legacyDaycareRoutePolicies.parentBooking}><BookingScreenContent /></LegacyDaycareRouteGuard>;
}

function BookingScreenContent() {
  const router = useRouter();
  const { organizationId } = useAuth();
  const children = useChildren(); const plans = useServicePlans(); const entitlements = useEntitlements(); const bookings = useBookings(); const invoices = useInvoices(); const purchase = usePurchaseService(); const bookEntitlement = useBookEntitlement();
  const { t, formatCurrency, formatDate } = useI18n();
  const [childId, setChildId] = useState<string | null>(null); const [planId, setPlanId] = useState<string | null>(null); const [creditEntitlementId, setCreditEntitlementId] = useState<string | null>(null); const [bookingDates, setBookingDates] = useState<string[]>([]);
  const [listSheet, setListSheet] = useState<ListSheet>(null);
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const plan = useMemo(() => plans.data?.find((item) => item.id === planId) ?? null, [plans.data, planId]);
  const creditEntitlement = useMemo(() => entitlements.data?.find((item) => item.id === creditEntitlementId) ?? null, [creditEntitlementId, entitlements.data]);
  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); }, [childId, children.data]);
  const activeEntitlement = useMemo(() => entitlements.data?.find((item) => item.childId === childId && item.status === "ACTIVE") ?? null, [entitlements.data, childId]);
  const pendingChildInvoices = useMemo(() => invoices.data?.filter((item) => item.childId === childId && item.status === "PENDING") ?? [], [invoices.data, childId]);
  const pendingChildInvoicesTotal = useMemo(() => pendingChildInvoices.reduce((sum, item) => sum + item.totalAmount, 0), [pendingChildInvoices]);
  const childBookings = useMemo(() => bookings.data?.filter((item) => item.childId === childId) ?? [], [bookings.data, childId]);
  // §13.6: invoices and booking drafts are always scoped to the selected child.
  const childInvoices = useMemo(() => invoices.data?.filter((item) => item.childId === childId) ?? [], [invoices.data, childId]);
  const selectChild = (nextChildId: string) => {
    if (nextChildId === childId) return;
    setChildId(nextChildId);
    setBookingDates([]);
    setPlanId(null);
    setCreditEntitlementId(null);
  };
  const closeListSheet = () => setListSheet(null);
  const pickDate = (value: string) => { if (!isIsoDate(value) || bookingDates.includes(value)) return; setBookingDates((dates) => [...dates, value].sort()); };
  const selectPlan = (item: ServicePlan) => { setPlanId(item.id); setCreditEntitlementId(null); setBookingDates([]); setListSheet(null); setBookFormOpen(true); };
  const useRemaining = (entitlementId: string, entitlementChildId: string) => { setCreditEntitlementId(entitlementId); setChildId(entitlementChildId); setBookingDates([]); setListSheet(null); setBookFormOpen(true); };
  const closeBookForm = () => { setBookFormOpen(false); setPlanId(null); setCreditEntitlementId(null); setBookingDates([]); };
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
    <SectionHeader title={t("booking.child")} />
    {children.isFetching && <ShimmerList variant="tile" />}
    {!children.isFetching && <ChipGroup accessibilityLabel={t("booking.child")}>{children.data?.map((child) => <Chip key={child.id} label={child.fullName} selected={child.id === childId} onPress={() => selectChild(child.id)} />)}</ChipGroup>}
    {!children.isFetching && children.data?.length === 0 && <EmptyState compact icon="happy-outline" title={t("children.empty")} />}
    <Button leadingIcon={<Ionicons name="add-circle-outline" size={18} color={colors.onPrimary} />} disabled={!childId} onPress={() => setListSheet("plan")}>{t("booking.bookNow")}</Button>
    <View style={styles.grid}>
      <NavigationCard accessibilityLabel={t("booking.plan")} onPress={() => setListSheet("plan")} style={styles.tile} leading={<TileIcon name="pricetags-outline" />}>
        <AppText variant="label">{t("booking.plan")}</AppText>
        <AppText tone={activeEntitlement ? "default" : "muted"}>{activeEntitlement ? t("booking.activePlanSummary", { name: activeEntitlement.planName }) : t("booking.noActivePlan")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("booking.remaining")} onPress={() => setListSheet("remaining")} style={styles.tile} leading={<TileIcon name="ticket-outline" />}>
        <AppText variant="label">{t("booking.remaining")}</AppText>
        <AppText tone={activeEntitlement ? "default" : "muted"}>{activeEntitlement ? (activeEntitlement.remainingCredits == null ? t("booking.monthlyActive") : t("booking.remainingDays", { count: activeEntitlement.remainingCredits })) : t("booking.noActivePlan")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("booking.invoices")} onPress={() => setListSheet("invoices")} style={[styles.tile, pendingChildInvoices.length > 0 && styles.tileAttention]} leading={<TileIcon name="receipt-outline" attention={pendingChildInvoices.length > 0} />}>
        <AppText variant="label">{t("booking.invoices")}</AppText>
        <AppText tone={pendingChildInvoices.length > 0 ? "danger" : "muted"}>{pendingChildInvoices.length > 0 ? t("booking.pendingInvoicesSummary", { count: pendingChildInvoices.length, amount: formatCurrency(pendingChildInvoicesTotal) }) : t("booking.noPendingInvoices")}</AppText>
      </NavigationCard>
      <NavigationCard accessibilityLabel={t("booking.history")} onPress={() => { setListSheet("history"); void bookings.refetch(); }} style={styles.tile} leading={<TileIcon name="time-outline" />}>
        <AppText variant="label">{t("booking.history")}</AppText>
        <AppText tone="muted">{childBookings.length > 0 ? t("booking.historySummary", { count: childBookings.length }) : t("booking.noBookingsYet")}</AppText>
      </NavigationCard>
    </View>
    <MenuItem icon="school-outline" title={t("privateTutoring.menu")} description={t("privateTutoring.description")} onPress={() => router.push("/private-tutoring")} />

    <BottomSheet visible={listSheet === "plan"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.plan")}>
      <AppText tone="muted">{t("booking.planDescription")}</AppText>
      {plans.isFetching && <ShimmerList />}
      {!plans.isFetching && plans.data?.map((item) => <PlanCard key={item.id} plan={item} selected={item.id === planId && !creditEntitlementId} onPress={() => selectPlan(item)} formatCurrency={formatCurrency} t={t} />)}
      {!plans.isFetching && plans.data?.length === 0 && <EmptyState compact icon="pricetags-outline" title={t("common.noData")} />}
    </BottomSheet>

    <BottomSheet visible={listSheet === "remaining"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.remaining")}>
      <AppText tone="muted">{t("booking.remainingDescription")}</AppText>
      {entitlements.isFetching && <ShimmerList />}
      {!entitlements.isFetching && entitlements.data?.map((item) => <Card key={item.id} variant="tinted" title={item.planName} subtitle={t("booking.validUntil", { date: formatDate(item.validUntil) })} trailing={<Badge tone={statusTone(item.status)} label={t(`status.${item.status}` as Parameters<typeof t>[0])} />}><AppText variant="h5">{item.remainingCredits == null ? t("booking.monthlyActive") : t("booking.remainingDays", { count: item.remainingCredits })}</AppText>{item.status === "ACTIVE" && (item.remainingCredits ?? 0) > 0 && <Button variant="secondary" onPress={() => useRemaining(item.id, item.childId)}>{t("booking.useRemaining")}</Button>}</Card>)}
      {!entitlements.isFetching && entitlements.data?.length === 0 && <EmptyState compact icon="ticket-outline" title={t("common.noData")} />}
    </BottomSheet>

    <BottomSheet visible={listSheet === "invoices"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.invoices")}>
      <AppText tone="muted">{t("booking.invoicesDescription")}</AppText>
      {invoices.isFetching && <ShimmerList />}
      {!invoices.isFetching && childInvoices.map((item) => <Card key={item.id} variant="tinted" title={`${item.invoiceNumber} · ${formatCurrency(item.totalAmount)}`} subtitle={item.description ?? t(invoiceSourceKey(item.source))} trailing={<Badge tone={statusTone(item.status)} label={t(invoiceStatusKey(item.status))} />}><AppText variant="bodySmall" tone="muted">{t("tenant.dueDate", { date: formatDate(item.dueDate) })}</AppText>{item.status === "PENDING" && <Button variant="secondary" onPress={() => router.push({ pathname: "/parent-payment", params: { invoiceId: item.id, ...(organizationId ? { organizationId } : {}) } })}>{t("parentEnrollment.pay")}</Button>}{item.status === "PAYMENT_SUBMITTED" && <AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>}</Card>)}
      {!invoices.isFetching && childInvoices.length === 0 && <EmptyState compact icon="receipt-outline" title={t("booking.noInvoicesForChild")} />}
    </BottomSheet>

    <BottomSheet visible={listSheet === "history"} onClose={closeListSheet} closeAccessibilityLabel={t("common.close")} title={t("booking.history")}>
      <AppText tone="muted">{t("booking.historyDescription")}</AppText>
      {bookings.isFetching && <ShimmerList />}
      {!bookings.isFetching && childBookings.map((item) => <Card key={item.id} variant="tinted" title={formatDate(item.bookingDate)} subtitle={`${item.childName} · ${item.planName}`} trailing={<Badge tone={statusTone(item.status)} label={t(bookingStatusKey(item.status))} />} />)}
      {!bookings.isFetching && childBookings.length === 0 && <EmptyState compact icon="calendar-outline" title={t("booking.noBookingsYet")} />}
    </BottomSheet>

    <BottomSheet
      visible={bookFormOpen}
      onClose={closeBookForm}
      closeAccessibilityLabel={t("common.close")}
      title={creditEntitlement?.planName ?? plan?.name ?? t("booking.plan")}
      negativeAction={{ label: t("common.cancel"), onPress: closeBookForm }}
      positiveAction={{ label: creditEntitlement ? t("booking.useCredit") : t("booking.createOrder"), loading: purchase.isPending || bookEntitlement.isPending, onPress: () => void submit() }}
    >
      {(creditEntitlement || plan?.type !== "MONTHLY") && <View style={styles.form}><AppText variant="label">{t("booking.bookingDate", { description: creditEntitlement ? t("booking.creditLimit", { count: creditEntitlement.remainingCredits ?? 0 }) : plan?.type === "DAILY" ? t("booking.oneDate") : t("booking.maximumDays", { count: plan?.creditCount ?? 0 }) })}</AppText><DatePicker placeholder={t("booking.selectDate")} value="" onChange={pickDate} minimumDate={formatIsoDate(new Date())} />{bookingDates.length === 0 ? <AppText tone="muted">{t("booking.noDate")}</AppText> : <ChipGroup>{bookingDates.map((date) => <Chip key={date} label={`${formatDate(date)}  ✕`} accessibilityLabel={t("booking.removeDate", { date: formatDate(date) })} selected={false} onPress={() => setBookingDates((dates) => dates.filter((item) => item !== date))} />)}</ChipGroup>}</View>}
      {!creditEntitlement && plan?.type === "MONTHLY" && <AppText tone="muted">{t("booking.monthlyDescription")}</AppText>}
    </BottomSheet>
  </AppScreen>;
}
function PlanCard({ plan, selected, onPress, formatCurrency, t }: { plan: ServicePlan; selected: boolean; onPress: () => void; formatCurrency: (value: number) => string; t: ReturnType<typeof useI18n>["t"] }) { return <Card variant={selected ? "selected" : "tinted"} title={plan.name} trailing={<Badge label={t(servicePlanTypeKey(plan.type))} />}><AppText variant="h5" style={styles.price}>{formatCurrency(plan.price)}</AppText>{plan.type === "WEEKLY" && <AppText tone="muted">{t("booking.weeklyDays", { count: plan.creditCount ?? 0, policy: plan.unusedCreditPolicy === "CARRY_FORWARD" ? t("booking.carryForward") : t("booking.expire") })}</AppText>}<Button variant={selected ? "primary" : "secondary"} onPress={onPress}>{selected ? t("booking.selected") : t("booking.select")}</Button></Card>; }
function TileIcon({ name, attention = false }: { name: keyof typeof Ionicons.glyphMap; attention?: boolean }) { return <View style={[styles.tileIcon, attention && styles.tileIconAttention]}><Ionicons name={name} size={20} color={attention ? colors.danger : colors.primary} /></View>; }
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: "47%" },
  tileAttention: { borderColor: colors.danger },
  tileIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  tileIconAttention: { backgroundColor: colors.dangerSoft },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  price: { color: colors.primary },
});
