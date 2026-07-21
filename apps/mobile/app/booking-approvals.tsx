import { Alert, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useBookingApproval, useBookings } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";

export default function BookingApprovalsScreen() {
  const bookings = useBookings(true); const approval = useBookingApproval(); const { api, organizationId, profile } = useAuth(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const readOnly = membership?.active === false;
  const canManage = isStaffAdmin && !readOnly;
  const enrollments = useQuery({ queryKey: ["parent-enrollments", organizationId, "pending"], queryFn: () => api.pendingParentEnrollments(), enabled: Boolean(organizationId) && isStaffAdmin });
  const enrollmentApproval = useMutation({ mutationFn: ({ enrollmentId, approved }: { enrollmentId: string; approved: boolean }) => api.approveParentEnrollment(enrollmentId, approved), onSuccess: () => { void client.invalidateQueries({ queryKey: ["parent-enrollments", organizationId] }); void client.invalidateQueries({ queryKey: ["bookings", organizationId] }); void client.invalidateQueries({ queryKey: ["children", organizationId] }); void client.invalidateQueries({ queryKey: ["classrooms", organizationId] }); } });
  const { t, formatDate } = useI18n();
  const decide = async (bookingId: string, approved: boolean) => { try { await approval.mutateAsync({ bookingId, approved }); } catch (error) { Alert.alert(t("approval.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const decideEnrollment = async (enrollmentId: string, approved: boolean) => { try { await enrollmentApproval.mutateAsync({ enrollmentId, approved }); } catch (error) { Alert.alert(t("approval.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const empty = !bookings.isLoading && (!isStaffAdmin || !enrollments.isLoading) && bookings.data?.length === 0 && (!isStaffAdmin || enrollments.data?.length === 0);
  return <AppScreen><AppText variant="title">{t("approval.title")}</AppText><AppText tone="muted">{t("approval.subtitle")}</AppText>{readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}{isStaffAdmin && enrollments.data?.map((enrollment) => <View key={enrollment.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><AppText variant="heading">{enrollment.childName}</AppText><AppText tone="muted">{t("parentEnrollment.status")}</AppText>{canManage && <><Button loading={enrollmentApproval.isPending} onPress={() => void decideEnrollment(enrollment.id, true)}>{t("approval.approve")}</Button><Button variant="danger" loading={enrollmentApproval.isPending} onPress={() => void decideEnrollment(enrollment.id, false)}>{t("approval.reject")}</Button></>}</View>)}{bookings.data?.map((booking) => <View key={booking.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><AppText variant="heading">{booking.childName}</AppText><AppText>{formatDate(booking.bookingDate)} · {booking.planName}</AppText>{canManage && <><Button loading={approval.isPending} onPress={() => void decide(booking.id, true)}>{t("approval.approve")}</Button><Button variant="danger" loading={approval.isPending} onPress={() => void decide(booking.id, false)}>{t("approval.reject")}</Button></>}</View>)}{empty && <AppText tone="muted">{t("approval.empty")}</AppText>}</AppScreen>;
}
