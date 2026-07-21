import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import type { ServicePlan } from "@daycare/api-client";
import { useChildren } from "@/attendance/useAttendance";
import { useBookEntitlement, useBookings, useEntitlements, useInvoices, usePurchaseService, useServicePlans } from "@/booking/useBooking";
import { strings } from "@/i18n/strings";

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function BookingScreen() {
  const children = useChildren(); const plans = useServicePlans(); const entitlements = useEntitlements(); const bookings = useBookings(); const invoices = useInvoices(); const purchase = usePurchaseService(); const bookEntitlement = useBookEntitlement();
  const [childId, setChildId] = useState<string | null>(null); const [planId, setPlanId] = useState<string | null>(null); const [creditEntitlementId, setCreditEntitlementId] = useState<string | null>(null); const [dateInput, setDateInput] = useState(""); const [bookingDates, setBookingDates] = useState<string[]>([]);
  const plan = useMemo(() => plans.data?.find((item) => item.id === planId) ?? null, [plans.data, planId]);
  const creditEntitlement = useMemo(() => entitlements.data?.find((item) => item.id === creditEntitlementId) ?? null, [creditEntitlementId, entitlements.data]);
  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); if (!planId && plans.data?.[0]) setPlanId(plans.data[0].id); }, [childId, children.data, planId, plans.data]);
  const addDate = () => { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return Alert.alert("Format tanggal", "Gunakan format YYYY-MM-DD."); if (bookingDates.includes(dateInput)) return; setBookingDates((dates) => [...dates, dateInput].sort()); setDateInput(""); };
  const submit = async () => {
    if (creditEntitlement) {
      if (bookingDates.length === 0) return Alert.alert("Pilih tanggal", "Tambahkan minimal satu tanggal booking.");
      try { await bookEntitlement.mutateAsync({ entitlementId: creditEntitlement.id, bookingDates }); setBookingDates([]); setCreditEntitlementId(null); Alert.alert("Booking dibuat", "Booking menggunakan sisa hari dan menunggu persetujuan cabang bila diperlukan."); }
      catch (error) { Alert.alert("Tidak dapat membuat booking", error instanceof Error ? error.message : "Silakan coba lagi."); }
      return;
    }
    if (!childId || !plan) return;
    const dates = plan.type === "MONTHLY" ? [] : bookingDates;
    if (plan.type !== "MONTHLY" && dates.length === 0) return Alert.alert("Pilih tanggal", "Tambahkan minimal satu tanggal booking.");
    try { await purchase.mutateAsync({ childId, planId: plan.id, bookingDates: dates }); setBookingDates([]); Alert.alert("Pesanan dibuat", "Invoice menunggu konfirmasi pembayaran admin."); }
    catch (error) { Alert.alert("Tidak dapat membuat pesanan", error instanceof Error ? error.message : "Silakan coba lagi."); }
  };
  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}>
    <AppText variant="title">{strings.booking}</AppText><AppText tone="muted">Pilih paket dan tanggal layanan anak.</AppText>
    <AppText variant="heading">Anak</AppText><View style={styles.row}>{children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>
    <AppText variant="heading">Paket layanan</AppText>
    {plans.data?.map((item) => <PlanCard key={item.id} plan={item} selected={item.id === planId && !creditEntitlementId} onPress={() => { setPlanId(item.id); setCreditEntitlementId(null); setBookingDates([]); }} />)}
    {(creditEntitlement || plan?.type !== "MONTHLY") && <View style={styles.form}><AppText variant="label">Tanggal booking ({creditEntitlement ? `maks. ${creditEntitlement.remainingCredits ?? 0} hari dari sisa layanan` : plan?.type === "DAILY" ? "satu tanggal" : `maks. ${plan?.creditCount ?? 0} hari`})</AppText><View style={styles.row}><TextInput style={styles.input} placeholder="YYYY-MM-DD" value={dateInput} onChangeText={setDateInput} /><Button variant="secondary" onPress={addDate}>Tambah</Button></View><AppText tone="muted">{bookingDates.join(", ") || "Belum ada tanggal dipilih"}</AppText></View>}
    {!creditEntitlement && plan?.type === "MONTHLY" && <AppText tone="muted">Paket bulanan aktif tanpa booking ulang harian.</AppText>}
    <Button loading={purchase.isPending || bookEntitlement.isPending} onPress={() => void submit()}>{creditEntitlement ? "Gunakan sisa layanan" : "Buat pesanan dan tagihan"}</Button>
    <AppText variant="heading">Sisa layanan</AppText>{entitlements.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.planName}</AppText><AppText>{item.remainingCredits === undefined ? "Aktif bulanan" : `Sisa ${item.remainingCredits} hari`}</AppText><AppText variant="caption" tone="muted">Berlaku hingga {item.validUntil}</AppText>{item.status === "ACTIVE" && (item.remainingCredits ?? 0) > 0 && <Button variant={item.id === creditEntitlementId ? "primary" : "secondary"} onPress={() => { setCreditEntitlementId(item.id); setChildId(item.childId); setBookingDates([]); }}>Pakai sisa hari</Button>}</View>)}
    <AppText variant="heading">Tagihan</AppText>{invoices.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.invoiceNumber} · {rupiah.format(item.totalAmount)}</AppText><AppText>{item.status} · jatuh tempo {item.dueDate}</AppText></View>)}
    <AppText variant="heading">Riwayat booking</AppText>{bookings.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.childName} · {item.bookingDate}</AppText><AppText>{item.planName} · {item.status}</AppText></View>)}
  </Screen>;
}
function PlanCard({ plan, selected, onPress }: { plan: ServicePlan; selected: boolean; onPress: () => void }) { return <View style={styles.card}><AppText variant="heading">{plan.name}</AppText><AppText>{rupiah.format(plan.price)} · {plan.type}</AppText>{plan.type === "WEEKLY" && <AppText tone="muted">{plan.creditCount} hari · {plan.unusedCreditPolicy === "CARRY_FORWARD" ? "Sisa dapat dipindahkan" : "Sisa hangus"}</AppText>}<Button variant={selected ? "primary" : "secondary"} onPress={onPress}>{selected ? "Dipilih" : "Pilih paket"}</Button></View>; }
const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, form: { gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: "#FFF" }, input: { minHeight: 48, flex: 1, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#FFF" }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: 12, backgroundColor: "#FFF" } });
