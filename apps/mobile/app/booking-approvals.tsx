import { type ReactElement } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useBookingApproval, useBookings } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";

export default function BookingApprovalsScreen() {
  const router = useRouter();
  const bookings = useBookings(true); const approval = useBookingApproval(); const { api, organizationId, profile } = useAuth(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const readOnly = membership?.active === false;
  const canDecideEnrollment = isStaffAdmin && !readOnly;
  const canDecideBooking = (membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF") && !readOnly;
  const enrollments = useQuery({ queryKey: ["parent-enrollments", organizationId, "pending"], queryFn: () => api.pendingParentEnrollments(), enabled: Boolean(organizationId) && isStaffAdmin });
  const enrollmentApproval = useMutation({ mutationFn: ({ enrollmentId, approved }: { enrollmentId: string; approved: boolean }) => api.approveParentEnrollment(enrollmentId, approved), onSuccess: () => { void client.invalidateQueries({ queryKey: ["parent-enrollments", organizationId] }); void client.invalidateQueries({ queryKey: ["bookings", organizationId] }); void client.invalidateQueries({ queryKey: ["children", organizationId] }); void client.invalidateQueries({ queryKey: ["classrooms", organizationId] }); } });
  const { t, formatDate } = useI18n();
  const decide = async (bookingId: string, approved: boolean) => { try { await approval.mutateAsync({ bookingId, approved }); } catch (error) { Alert.alert(t("approval.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const decideEnrollment = async (enrollmentId: string, approved: boolean) => { try { await enrollmentApproval.mutateAsync({ enrollmentId, approved }); } catch (error) { Alert.alert(t("approval.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const empty = !bookings.isLoading && (!isStaffAdmin || !enrollments.isLoading) && bookings.data?.length === 0 && (!isStaffAdmin || enrollments.data?.length === 0);
  return <AppScreen showBottomNavigation={!isStaffAdmin} title={isStaffAdmin ? t("approval.title") : undefined} header={isStaffAdmin ? <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} /> : undefined}>
    {!isStaffAdmin && <AppText variant="title">{t("approval.title")}</AppText>}
    <AppText tone="muted">{t("approval.subtitle")}</AppText>
    {readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {isStaffAdmin && enrollments.data?.map((enrollment) => <ApprovalCard
      key={enrollment.id}
      title={enrollment.childName}
      description={t("parentEnrollment.status")}
      actions={canDecideEnrollment ? <><Button loading={enrollmentApproval.isPending} onPress={() => void decideEnrollment(enrollment.id, true)}>{t("approval.approve")}</Button><Button variant="danger" loading={enrollmentApproval.isPending} onPress={() => void decideEnrollment(enrollment.id, false)}>{t("approval.reject")}</Button></> : undefined}
    />)}
    {bookings.data?.map((booking) => <ApprovalCard
      key={booking.id}
      title={booking.childName}
      description={`${formatDate(booking.bookingDate)} · ${booking.planName}`}
      actions={canDecideBooking ? <><Button loading={approval.isPending} onPress={() => void decide(booking.id, true)}>{t("approval.approve")}</Button><Button variant="danger" loading={approval.isPending} onPress={() => void decide(booking.id, false)}>{t("approval.reject")}</Button></> : undefined}
    />)}
    {empty && <AppText tone="muted">{t("approval.empty")}</AppText>}
  </AppScreen>;
}

function ApprovalCard({ title, description, actions }: { title: string; description: string; actions?: ReactElement }) {
  return <View style={styles.card}>
    <AppText variant="heading">{title}</AppText>
    <AppText tone="muted">{description}</AppText>
    {actions}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
