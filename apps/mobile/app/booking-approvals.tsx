import { Alert, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import { useBookingApproval, useBookings } from "@/booking/useBooking";

export default function BookingApprovalsScreen() {
  const bookings = useBookings(true); const approval = useBookingApproval();
  const decide = async (bookingId: string, approved: boolean) => { try { await approval.mutateAsync({ bookingId, approved }); } catch (error) { Alert.alert("Tidak dapat memperbarui booking", error instanceof Error ? error.message : "Silakan coba lagi."); } };
  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}><AppText variant="title">Persetujuan booking</AppText><AppText tone="muted">Booking yang sudah dibayar menunggu persetujuan cabang.</AppText>{bookings.data?.map((booking) => <View key={booking.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: "#FFF" }}><AppText variant="heading">{booking.childName}</AppText><AppText>{booking.bookingDate} · {booking.planName}</AppText><Button loading={approval.isPending} onPress={() => void decide(booking.id, true)}>Setujui</Button><Button variant="danger" loading={approval.isPending} onPress={() => void decide(booking.id, false)}>Tolak</Button></View>)}{!bookings.isLoading && bookings.data?.length === 0 && <AppText tone="muted">Tidak ada booking menunggu persetujuan.</AppText>}</Screen>;
}
