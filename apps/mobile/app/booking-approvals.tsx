import { useEffect, useState, type ReactElement } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useBookingApproval } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { downloadPaymentProofImage } from "@/payment-proof/downloadImage";

type PendingConfirm = { kind: "booking" | "enrollment"; id: string; approved: boolean; name: string };

export default function BookingApprovalsScreen() {
  const router = useRouter();
  const approval = useBookingApproval(); const { api, organizationId, profile } = useAuth(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const [filterBranchId, setFilterBranchId] = useState<string>();
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: isStaffAdmin && Boolean(organizationId) });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const bookings = useQuery({ queryKey: ["bookings", organizationId, true, filterBranchId, debouncedSearch], queryFn: () => api.pendingBookings(isStaffAdmin ? { branchId: filterBranchId } : {}, debouncedSearch || undefined), enabled: Boolean(organizationId) });
  const readOnly = membership?.active === false;
  const canDecideEnrollment = isStaffAdmin && !readOnly;
  const canDecideBooking = (membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF") && !readOnly;
  const enrollments = useQuery({ queryKey: ["parent-enrollments", organizationId, "pending", filterBranchId, debouncedSearch], queryFn: () => api.pendingParentEnrollments({ branchId: filterBranchId }, debouncedSearch || undefined), enabled: Boolean(organizationId) && isStaffAdmin });
  const enrollmentApproval = useMutation({ mutationFn: ({ enrollmentId, approved }: { enrollmentId: string; approved: boolean }) => api.approveParentEnrollment(enrollmentId, approved), onSuccess: () => { void client.invalidateQueries({ queryKey: ["parent-enrollments", organizationId] }); void client.invalidateQueries({ queryKey: ["bookings", organizationId] }); void client.invalidateQueries({ queryKey: ["children", organizationId] }); void client.invalidateQueries({ queryKey: ["classrooms", organizationId] }); } });
  const { t, formatDate } = useI18n();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const closeConfirm = () => setConfirm(null);
  const openConfirm = (value: PendingConfirm) => setConfirm(value);
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
  const openProof = (invoiceId: string) => setViewProofInvoiceId(invoiceId);
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
    {isStaffAdmin && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      <BranchTab label={t("branchFilter.allBranches")} selected={!filterBranchId} onPress={() => setFilterBranchId(undefined)} />
      {branches.data?.map((branch) => <BranchTab key={branch.id} label={branch.name} selected={filterBranchId === branch.id} onPress={() => setFilterBranchId(branch.id)} />)}
    </ScrollView>}
    <TextInput style={styles.input} placeholder={t("approval.search")} value={search} onChangeText={setSearch} />

    {isStaffAdmin && enrollments.data?.map((enrollment) => <ApprovalCard
      key={enrollment.id}
      title={enrollment.childName}
      description={`${enrollment.planName} · ${formatDate(enrollment.createdAt)}`}
      actions={canDecideEnrollment ? <View style={styles.actionsRow}>
        <Button style={styles.actionButton} onPress={() => openConfirm({ kind: "enrollment", id: enrollment.id, approved: true, name: enrollment.childName })}>{t("approval.approve")}</Button>
        <Button style={styles.actionButton} variant="danger" onPress={() => openConfirm({ kind: "enrollment", id: enrollment.id, approved: false, name: enrollment.childName })}>{t("approval.reject")}</Button>
      </View> : undefined}
    />)}
    {bookings.data?.map((booking) => <ApprovalCard
      key={booking.id}
      title={booking.childName}
      description={`${formatDate(booking.bookingDate)} · ${booking.planName}`}
      actions={<>
        {isStaffAdmin && <Button variant="secondary" onPress={() => openProof(booking.invoiceId)}>{t("paymentProof.view")}</Button>}
        {canDecideBooking && <View style={styles.actionsRow}>
          <Button style={styles.actionButton} onPress={() => openConfirm({ kind: "booking", id: booking.id, approved: true, name: booking.childName })}>{t("approval.approve")}</Button>
          <Button style={styles.actionButton} variant="danger" onPress={() => openConfirm({ kind: "booking", id: booking.id, approved: false, name: booking.childName })}>{t("approval.reject")}</Button>
        </View>}
      </>}
    />)}
    {empty && <AppText tone="muted">{t("approval.empty")}</AppText>}

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

function BranchTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}>
    <AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted },
  activeTabText: { color: colors.primary },
  pressedTab: { opacity: 0.72 },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
  preview: { width: "100%", height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
