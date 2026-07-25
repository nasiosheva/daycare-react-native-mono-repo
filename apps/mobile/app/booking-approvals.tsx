import { useState, type ReactElement } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useBookingApproval, useBookings } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { downloadPaymentProofImage } from "@/payment-proof/downloadImage";
import { BranchFilterControl } from "@/branches/BranchFilterSheet";

type PendingConfirm = { kind: "booking" | "enrollment"; id: string; approved: boolean; name: string };

export default function BookingApprovalsScreen() {
  const router = useRouter();
  const approval = useBookingApproval(); const { api, organizationId, profile } = useAuth(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const bookings = useBookings(true, isStaffAdmin ? { branchId: filterBranchId } : {});
  const readOnly = membership?.active === false;
  const canDecideEnrollment = isStaffAdmin && !readOnly;
  const canDecideBooking = (membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF") && !readOnly;
  const enrollments = useQuery({ queryKey: ["parent-enrollments", organizationId, "pending", filterBranchId], queryFn: () => api.pendingParentEnrollments({ branchId: filterBranchId }), enabled: Boolean(organizationId) && isStaffAdmin });
  const enrollmentApproval = useMutation({ mutationFn: ({ enrollmentId, approved }: { enrollmentId: string; approved: boolean }) => api.approveParentEnrollment(enrollmentId, approved), onSuccess: () => { void client.invalidateQueries({ queryKey: ["parent-enrollments", organizationId] }); void client.invalidateQueries({ queryKey: ["bookings", organizationId] }); void client.invalidateQueries({ queryKey: ["children", organizationId] }); void client.invalidateQueries({ queryKey: ["classrooms", organizationId] }); } });
  const { t, formatDate } = useI18n();
  const [listOpen, setListOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const closeConfirm = () => setConfirm(null);
  const openConfirm = (value: PendingConfirm) => { setListOpen(false); setConfirm(value); };
  const confirmDecision = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "booking") await approval.mutateAsync({ bookingId: confirm.id, approved: confirm.approved });
      else await enrollmentApproval.mutateAsync({ enrollmentId: confirm.id, approved: confirm.approved });
      closeConfirm();
    } catch (error) { Alert.alert(t("approval.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const [viewProofInvoiceId, setViewProofInvoiceId] = useState<string | null>(null);
  const closeProof = () => setViewProofInvoiceId(null);
  const openProof = (invoiceId: string) => { setListOpen(false); setViewProofInvoiceId(invoiceId); };
  const proof = useQuery({ queryKey: ["payment-proof", viewProofInvoiceId], queryFn: () => api.paymentProof(viewProofInvoiceId!), enabled: Boolean(viewProofInvoiceId) });
  const [downloading, setDownloading] = useState(false);
  const downloadProof = async () => {
    if (!proof.data) return;
    setDownloading(true);
    try { await downloadPaymentProofImage(proof.data.fileName, proof.data.contentType, proof.data.dataBase64); }
    catch (error) { Alert.alert(t("paymentProof.downloadFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setDownloading(false); }
  };
  const empty = !bookings.isLoading && (!isStaffAdmin || !enrollments.isLoading) && bookings.data?.length === 0 && (!isStaffAdmin || enrollments.data?.length === 0);
  const confirmLoading = confirm?.kind === "booking" ? approval.isPending : enrollmentApproval.isPending;
  return <AppScreen showBottomNavigation={!isStaffAdmin} title={isStaffAdmin ? t("approval.title") : undefined} header={isStaffAdmin ? <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} /> : undefined}>
    {!isStaffAdmin && <AppText variant="title">{t("approval.title")}</AppText>}
    <AppText tone="muted">{t("approval.subtitle")}</AppText>
    {readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {isStaffAdmin && <BranchFilterControl branchId={filterBranchId} onChange={setFilterBranchId} />}
    <NavigationCard accessibilityLabel={t("approval.title")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("approval.title")}</AppText>
      <AppText tone={empty ? "muted" : "default"}>{empty ? t("approval.empty") : t("approval.pendingSummary", { count: (isStaffAdmin ? enrollments.data?.length ?? 0 : 0) + (bookings.data?.length ?? 0) })}</AppText>
    </NavigationCard>

    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("approval.title")}>
      {isStaffAdmin && enrollments.data?.map((enrollment) => <ApprovalCard
        key={enrollment.id}
        title={enrollment.childName}
        description={t("parentEnrollment.status")}
        actions={<>
          {isStaffAdmin && <Button variant="secondary" onPress={() => openProof(enrollment.invoiceId)}>{t("paymentProof.view")}</Button>}
          {canDecideEnrollment && <><Button onPress={() => openConfirm({ kind: "enrollment", id: enrollment.id, approved: true, name: enrollment.childName })}>{t("approval.approve")}</Button><Button variant="danger" onPress={() => openConfirm({ kind: "enrollment", id: enrollment.id, approved: false, name: enrollment.childName })}>{t("approval.reject")}</Button></>}
        </>}
      />)}
      {bookings.data?.map((booking) => <ApprovalCard
        key={booking.id}
        title={booking.childName}
        description={`${formatDate(booking.bookingDate)} · ${booking.planName}`}
        actions={<>
          {isStaffAdmin && <Button variant="secondary" onPress={() => openProof(booking.invoiceId)}>{t("paymentProof.view")}</Button>}
          {canDecideBooking && <><Button onPress={() => openConfirm({ kind: "booking", id: booking.id, approved: true, name: booking.childName })}>{t("approval.approve")}</Button><Button variant="danger" onPress={() => openConfirm({ kind: "booking", id: booking.id, approved: false, name: booking.childName })}>{t("approval.reject")}</Button></>}
        </>}
      />)}
      {empty && <AppText tone="muted">{t("approval.empty")}</AppText>}
    </BottomSheet>

    <BottomSheet
      visible={confirm !== null}
      onClose={closeConfirm}
      closeAccessibilityLabel={t("common.close")}
      title={confirm ? t(confirm.approved ? "approval.confirmApprove" : "approval.confirmReject", { name: confirm.name }) : undefined}
      negativeAction={{ label: t("common.cancel"), onPress: closeConfirm }}
      positiveAction={{ label: t(confirm?.approved ? "approval.approve" : "approval.reject"), variant: confirm?.approved ? "primary" : "danger", loading: confirmLoading, onPress: () => void confirmDecision() }}
    >
      <AppText tone="muted">{t(confirm?.approved ? "approval.confirmApproveDescription" : "approval.confirmRejectDescription")}</AppText>
    </BottomSheet>

    <BottomSheet
      visible={viewProofInvoiceId !== null}
      onClose={closeProof}
      closeAccessibilityLabel={t("common.close")}
      title={t("paymentProof.view")}
      negativeAction={{ label: t("common.close"), onPress: closeProof }}
      positiveAction={{ label: t("paymentProof.download"), loading: downloading, disabled: !proof.data, onPress: () => void downloadProof() }}
    >
      {proof.isLoading ? <AppText>{t("common.loading")}</AppText> : proof.data ? <Image source={{ uri: `data:${proof.data.contentType};base64,${proof.data.dataBase64}` }} style={styles.preview} resizeMode="contain" /> : <AppText tone="muted">{t("paymentProof.none")}</AppText>}
      {proof.data?.note && <AppText tone="muted">{proof.data.note}</AppText>}
    </BottomSheet>
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
  preview: { width: "100%", height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
