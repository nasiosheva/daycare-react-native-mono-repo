import { Alert, View } from "react-native";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useBookingApproval, useBookings } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";

export default function BookingApprovalsScreen() {
  const bookings = useBookings(true); const approval = useBookingApproval();
  const { t, formatDate } = useI18n();
  const decide = async (bookingId: string, approved: boolean) => { try { await approval.mutateAsync({ bookingId, approved }); } catch (error) { Alert.alert(t("approval.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  return <AppScreen><AppText variant="title">{t("approval.title")}</AppText><AppText tone="muted">{t("approval.subtitle")}</AppText>{bookings.data?.map((booking) => <View key={booking.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><AppText variant="heading">{booking.childName}</AppText><AppText>{formatDate(booking.bookingDate)} · {booking.planName}</AppText><Button loading={approval.isPending} onPress={() => void decide(booking.id, true)}>{t("approval.approve")}</Button><Button variant="danger" loading={approval.isPending} onPress={() => void decide(booking.id, false)}>{t("approval.reject")}</Button></View>)}{!bookings.isLoading && bookings.data?.length === 0 && <AppText tone="muted">{t("approval.empty")}</AppText>}</AppScreen>;
}
