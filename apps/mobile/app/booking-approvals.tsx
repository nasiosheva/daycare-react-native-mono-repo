import { useEffect, useState, type ReactElement } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ParentFamilyProfileForTenant } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useBookingApproval } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
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
  const { t, formatCurrency, formatDate } = useI18n();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const closeConfirm = () => { setConfirm(null); setDecisionError(null); };
  const openConfirm = (value: PendingConfirm) => { setDecisionError(null); setConfirm(value); };
  const confirmDecision = async () => {
    if (!confirm) return;
    setDecisionError(null);
    try {
      if (confirm.kind === "booking") await approval.mutateAsync({ bookingId: confirm.id, approved: confirm.approved });
      else await enrollmentApproval.mutateAsync({ enrollmentId: confirm.id, approved: confirm.approved });
      closeConfirm();
    } catch (error) { setDecisionError(error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const [viewProofInvoiceId, setViewProofInvoiceId] = useState<string | null>(null);
  const closeProof = () => { setViewProofInvoiceId(null); setProofError(null); };
  const openProof = (invoiceId: string) => { setProofError(null); setViewProofInvoiceId(invoiceId); };
  const proof = useQuery({ queryKey: ["payment-proof", viewProofInvoiceId], queryFn: () => api.paymentProof(viewProofInvoiceId!), enabled: Boolean(viewProofInvoiceId) });
  const [downloading, setDownloading] = useState(false);
  const downloadProof = async () => {
    if (!proof.data) return;
    setDownloading(true);
    setProofError(null);
    try { await downloadPaymentProofImage(proof.data.fileName, proof.data.contentType, proof.data.dataBase64); }
    catch (error) { setProofError(error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setDownloading(false); }
  };
  const approvalsFetching = bookings.isFetching || (isStaffAdmin && enrollments.isFetching);
  const empty = !approvalsFetching && bookings.data?.length === 0 && (!isStaffAdmin || enrollments.data?.length === 0);
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

    {approvalsFetching && <ShimmerList />}
    {isStaffAdmin && !approvalsFetching && Boolean(enrollments.data?.length) && <ApprovalSection title={t("approval.enrollmentSection")} description={t("approval.enrollmentSectionDescription")}>
      {enrollments.data?.map((enrollment) => <ApprovalCard
        key={enrollment.id}
        title={enrollment.childName}
        description={`${enrollment.planName} · ${formatCurrency(enrollment.totalAmount)} · ${formatDate(enrollment.createdAt)}`}
        parentFamilyProfile={enrollment.parentFamilyProfile}
        actions={canDecideEnrollment ? <View style={styles.actionsRow}>
          <Button style={styles.actionButton} onPress={() => openConfirm({ kind: "enrollment", id: enrollment.id, approved: true, name: enrollment.childName })}>{t("approval.approve")}</Button>
          <Button style={styles.actionButton} variant="danger" onPress={() => openConfirm({ kind: "enrollment", id: enrollment.id, approved: false, name: enrollment.childName })}>{t("approval.reject")}</Button>
        </View> : undefined}
      />)}
    </ApprovalSection>}
    {!approvalsFetching && Boolean(bookings.data?.length) && <ApprovalSection title={t("approval.bookingSection")} description={t("approval.bookingSectionDescription")}>
      {bookings.data?.map((booking) => <ApprovalCard
        key={booking.id}
        title={booking.childName}
        description={`${formatDate(booking.bookingDate)} · ${booking.planName}`}
        detail={`${booking.invoiceNumber} · ${formatCurrency(booking.invoiceTotalAmount)}`}
        actions={<>
          {isStaffAdmin && <Button variant="secondary" onPress={() => openProof(booking.invoiceId)}>{t("paymentProof.view")}</Button>}
          {canDecideBooking && <View style={styles.actionsRow}>
            <Button style={styles.actionButton} onPress={() => openConfirm({ kind: "booking", id: booking.id, approved: true, name: booking.childName })}>{t("approval.approve")}</Button>
            <Button style={styles.actionButton} variant="danger" onPress={() => openConfirm({ kind: "booking", id: booking.id, approved: false, name: booking.childName })}>{t("approval.reject")}</Button>
          </View>}
        </>}
      />)}
    </ApprovalSection>}
    {empty && <AppText tone="muted">{t("approval.empty")}</AppText>}

    <BottomSheet
      visible={confirm !== null}
      onClose={closeConfirm}
      closeAccessibilityLabel={t("common.close")}
      title={confirm ? t(confirm.approved ? "approval.confirmApprove" : "approval.confirmReject", { name: confirm.name }) : undefined}
      negativeAction={{ label: t("common.cancel"), onPress: closeConfirm }}
      positiveAction={{ label: t(confirm?.approved ? "approval.approve" : "approval.reject"), variant: confirm?.approved ? "primary" : "danger", loading: confirmLoading, onPress: () => void confirmDecision() }}
    >
      {decisionError && <AppText accessibilityRole="alert" tone="danger">{decisionError}</AppText>}
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
      {proofError && <AppText accessibilityRole="alert" tone="danger">{proofError}</AppText>}
      {proof.isLoading ? <AppText>{t("common.loading")}</AppText> : proof.data ? <Image source={{ uri: `data:${proof.data.contentType};base64,${proof.data.dataBase64}` }} style={styles.preview} resizeMode="contain" /> : <AppText tone="muted">{t("paymentProof.none")}</AppText>}
      {proof.data?.note && <AppText tone="muted">{proof.data.note}</AppText>}
    </BottomSheet>
  </AppScreen>;
}

function ApprovalSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <View style={styles.section}>
    <View style={styles.sectionHeader}><AppText variant="heading">{title}</AppText><AppText tone="muted">{description}</AppText></View>
    {children}
  </View>;
}

function ApprovalCard({ title, description, detail, actions, parentFamilyProfile }: { title: string; description: string; detail?: string; actions?: ReactElement; parentFamilyProfile?: ParentFamilyProfileForTenant | null }) {
  return <View style={styles.card}>
    <AppText variant="heading">{title}</AppText>
    <AppText tone="muted">{description}</AppText>
    {detail && <AppText variant="label">{detail}</AppText>}
    {parentFamilyProfile && <ParentFamilyProfileSummary profile={parentFamilyProfile} />}
    {actions}
  </View>;
}

function ParentFamilyProfileSummary({ profile }: { profile: ParentFamilyProfileForTenant }) {
  const { t } = useI18n();
  const husband = parentFamilyDetails(profile.husbandOccupation, profile.husbandIncomeRange, t);
  const wife = parentFamilyDetails(profile.wifeOccupation, profile.wifeIncomeRange, t);
  if (!husband && !wife) return null;
  return <View style={styles.parentFamilyProfile}>
    <AppText variant="label">{t("parentFamily.title")}</AppText>
    {husband && <AppText tone="muted">{t("parentFamily.husband")}: {husband}</AppText>}
    {wife && <AppText tone="muted">{t("parentFamily.wife")}: {wife}</AppText>}
  </View>;
}

function parentFamilyDetails(occupation: ParentFamilyProfileForTenant["husbandOccupation"], incomeRange: ParentFamilyProfileForTenant["husbandIncomeRange"], t: (key: TranslationKey) => string) {
  const values = [occupation ? t(`parentFamily.occupation.${occupation}` as TranslationKey) : null, incomeRange ? t(`parentFamily.income.${incomeRange}` as TranslationKey) : null].filter((value): value is string => value !== null);
  return values.length ? values.join(" · ") : null;
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
  section: { gap: spacing.sm },
  sectionHeader: { gap: spacing.xs },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  parentFamilyProfile: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
  preview: { width: "100%", height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
