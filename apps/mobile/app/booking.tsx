import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import type { ServicePlan } from "@daycare/api-client";
import { useChildren } from "@/attendance/useAttendance";
import { useBookEntitlement, useBookings, useEntitlements, useInvoices, usePurchaseService, useServicePlans } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { bookingStatusKey, invoiceStatusKey, servicePlanTypeKey } from "@/i18n/translations";

export default function BookingScreen() {
  const children = useChildren(); const plans = useServicePlans(); const entitlements = useEntitlements(); const bookings = useBookings(); const invoices = useInvoices(); const purchase = usePurchaseService(); const bookEntitlement = useBookEntitlement();
  const { t, formatCurrency, formatDate } = useI18n();
  const [childId, setChildId] = useState<string | null>(null); const [planId, setPlanId] = useState<string | null>(null); const [creditEntitlementId, setCreditEntitlementId] = useState<string | null>(null); const [dateInput, setDateInput] = useState(""); const [bookingDates, setBookingDates] = useState<string[]>([]);
  const plan = useMemo(() => plans.data?.find((item) => item.id === planId) ?? null, [plans.data, planId]);
  const creditEntitlement = useMemo(() => entitlements.data?.find((item) => item.id === creditEntitlementId) ?? null, [creditEntitlementId, entitlements.data]);
  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); if (!planId && plans.data?.[0]) setPlanId(plans.data[0].id); }, [childId, children.data, planId, plans.data]);
  const addDate = () => { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return Alert.alert(t("booking.dateFormat"), t("booking.dateFormatDescription")); if (bookingDates.includes(dateInput)) return; setBookingDates((dates) => [...dates, dateInput].sort()); setDateInput(""); };
  const submit = async () => {
    if (creditEntitlement) {
      if (bookingDates.length === 0) return Alert.alert(t("booking.selectDate"), t("booking.selectDateDescription"));
      try { await bookEntitlement.mutateAsync({ entitlementId: creditEntitlement.id, bookingDates }); setBookingDates([]); setCreditEntitlementId(null); Alert.alert(t("booking.created"), t("booking.usingCredit")); }
      catch (error) { Alert.alert(t("booking.createFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
      return;
    }
    if (!childId || !plan) return;
    const dates = plan.type === "MONTHLY" ? [] : bookingDates;
    if (plan.type !== "MONTHLY" && dates.length === 0) return Alert.alert(t("booking.selectDate"), t("booking.selectDateDescription"));
    try { await purchase.mutateAsync({ childId, planId: plan.id, bookingDates: dates }); setBookingDates([]); Alert.alert(t("booking.orderCreated"), t("booking.orderDescription")); }
    catch (error) { Alert.alert(t("booking.orderFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen>
    <AppText variant="title">{t("booking.title")}</AppText><AppText tone="muted">{t("booking.subtitle")}</AppText>
    <AppText variant="heading">{t("booking.child")}</AppText><View style={styles.row}>{children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>
    <AppText variant="heading">{t("booking.plan")}</AppText>
    {plans.data?.map((item) => <PlanCard key={item.id} plan={item} selected={item.id === planId && !creditEntitlementId} onPress={() => { setPlanId(item.id); setCreditEntitlementId(null); setBookingDates([]); }} formatCurrency={formatCurrency} t={t} />)}
    {(creditEntitlement || plan?.type !== "MONTHLY") && <View style={styles.form}><AppText variant="label">{t("booking.bookingDate", { description: creditEntitlement ? t("booking.creditLimit", { count: creditEntitlement.remainingCredits ?? 0 }) : plan?.type === "DAILY" ? t("booking.oneDate") : t("booking.maximumDays", { count: plan?.creditCount ?? 0 }) })}</AppText><View style={styles.row}><TextInput style={styles.input} placeholder="YYYY-MM-DD" value={dateInput} onChangeText={setDateInput} /><Button variant="secondary" onPress={addDate}>{t("booking.add")}</Button></View><AppText tone="muted">{bookingDates.join(", ") || t("booking.noDate")}</AppText></View>}
    {!creditEntitlement && plan?.type === "MONTHLY" && <AppText tone="muted">{t("booking.monthlyDescription")}</AppText>}
    <Button loading={purchase.isPending || bookEntitlement.isPending} onPress={() => void submit()}>{creditEntitlement ? t("booking.useCredit") : t("booking.createOrder")}</Button>
    <AppText variant="heading">{t("booking.remaining")}</AppText>{entitlements.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.planName}</AppText><AppText>{item.remainingCredits == null ? t("booking.monthlyActive") : t("booking.remainingDays", { count: item.remainingCredits })}</AppText><AppText variant="caption" tone="muted">{t("booking.validUntil", { date: formatDate(item.validUntil) })}</AppText>{item.status === "ACTIVE" && (item.remainingCredits ?? 0) > 0 && <Button variant={item.id === creditEntitlementId ? "primary" : "secondary"} onPress={() => { setCreditEntitlementId(item.id); setChildId(item.childId); setBookingDates([]); }}>{t("booking.useRemaining")}</Button>}</View>)}
    <AppText variant="heading">{t("booking.invoices")}</AppText>{invoices.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.invoiceNumber} · {formatCurrency(item.totalAmount)}</AppText><AppText>{t("booking.dueDate", { status: t(invoiceStatusKey(item.status)), date: formatDate(item.dueDate) })}</AppText></View>)}
    <AppText variant="heading">{t("booking.history")}</AppText>{bookings.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.childName} · {formatDate(item.bookingDate)}</AppText><AppText>{item.planName} · {t(bookingStatusKey(item.status))}</AppText></View>)}
  </AppScreen>;
}
function PlanCard({ plan, selected, onPress, formatCurrency, t }: { plan: ServicePlan; selected: boolean; onPress: () => void; formatCurrency: (value: number) => string; t: ReturnType<typeof useI18n>["t"] }) { return <View style={styles.card}><AppText variant="heading">{plan.name}</AppText><AppText>{formatCurrency(plan.price)} · {t(servicePlanTypeKey(plan.type))}</AppText>{plan.type === "WEEKLY" && <AppText tone="muted">{t("booking.weeklyDays", { count: plan.creditCount ?? 0, policy: plan.unusedCreditPolicy === "CARRY_FORWARD" ? t("booking.carryForward") : t("booking.expire") })}</AppText>}<Button variant={selected ? "primary" : "secondary"} onPress={onPress}>{selected ? t("booking.selected") : t("booking.select")}</Button></View>; }
const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, input: { minHeight: 48, flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint } });
