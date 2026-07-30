import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useQuery } from "@tanstack/react-query";
import { AppText, colors, NavigationCard, radius, spacing } from "@daycare/ui";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useEntitlements, useInvoices } from "@/booking/useBooking";
import { createStaffAdminSummary } from "@/home/staffAdminSummary";
import { useI18n } from "@/i18n/I18nProvider";

export default function StaffAdminScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const readOnly = membership?.active === false;
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const invoices = useInvoices();
  const entitlements = useEntitlements();
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const summary = createStaffAdminSummary({ children: [], users: users.data ?? [], pendingBookings: [], invoices: invoices.data ?? [], entitlements: entitlements.data ?? [] });

  return <AppScreen><AppText variant="title">{t("staffAdmin.title")}</AppText>
    <AppText tone="muted">{t("staffAdmin.subtitle")}</AppText>{readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <View style={styles.metrics}>
      <Metric label={t("staffAdmin.activeStaff")} value={summary.activeStaff} />
      <Metric label={t("staffAdmin.pendingPayments")} value={summary.pendingInvoices} />
      <Metric label={t("staffAdmin.activeSubscriptions")} value={summary.activeSubscriptions} />
      <Metric label={t("staffAdmin.remainingCredits")} value={summary.remainingCredits} />
    </View>
    <MenuItem title={t("nav.development")} description={t("staffOperations.developmentDescription")} onPress={() => router.push("/development")} />
    <MenuItem title={t("staffAdmin.staff")} description={t("staffAdmin.staffDescription")} onPress={() => router.push("/tenant-users")} />
    <MenuItem title={t("staffAdmin.payments")} description={t("staffAdmin.paymentsDescription")} onPress={() => router.push("/parent-payments")} />
    <MenuItem title={t("paymentInstruction.title")} description={t("paymentInstruction.managementDescription")} onPress={() => router.push("/payment-instructions")} />
    <MenuItem title={t("staffAdmin.subscriptions")} description={t("staffAdmin.subscriptionsDescription")} onPress={() => router.push("/parent-subscriptions")} />
    <MenuItem title={t("staffAdmin.plans")} description={t("staffAdmin.plansDescription")} onPress={() => router.push("/billing-admin")} />
    <MenuItem title={t("privateTutoring.menu")} description={t("privateTutoring.adminDescription")} onPress={() => router.push("/private-tutoring-admin")} />
    <MenuItem title={t("staffAdmin.branches")} description={t("staffAdmin.branchesDescription")} onPress={() => router.push("/branches" as never)} />
    <MenuItem title={t("childAttendanceReport.menu")} description={t("childAttendanceReport.menuDescription")} onPress={() => router.push("/child-attendance-report" as never)} />
    <MenuItem title={t("overtime.chargesTitle")} description={t("overtime.chargesDescription")} onPress={() => router.push("/overtime-charges")} />
    <MenuItem title={t("staffAdmin.approvals")} description={t("staffAdmin.approvalsDescription")} onPress={() => router.push("/booking-approvals")} />
    <MenuItem title={t("staffLeave.approvalsTitle")} description={t("staffLeave.approvalsDescription")} onPress={() => router.push("/staff-leave-approvals")} />
    <MenuItem title={t("absence.menu")} description={t("absence.menuDescription")} onPress={() => router.push("/absence-requests")} />
    <MenuItem title={t("nav.profile")} description={t("profile.staffMenuDescription")} onPress={() => router.push("/profile")} />
  </AppScreen>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><AppText variant="h3">{value}</AppText><AppText variant="caption" tone="muted">{label}</AppText></View>;
}

function MenuItem({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return <NavigationCard accessibilityLabel={title} onPress={onPress}><AppText variant="h5">{title}</AppText><AppText variant="bodySmall" tone="muted">{description}</AppText></NavigationCard>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 140, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
