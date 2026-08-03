import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useQuery } from "@tanstack/react-query";
import type { TenantReadinessIssue } from "@daycare/api-client";
import { AppText, colors, NavigationCard, radius, spacing } from "@daycare/ui";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useEntitlements, useInvoices } from "@/booking/useBooking";
import { createStaffAdminSummary } from "@/home/staffAdminSummary";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantReadinessIssueKey } from "@/i18n/translations";
import { hasInstitutionCapability } from "@daycare/core";
import { hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";
import { pendingStaffAdminSetupIssues } from "@/tenant-readiness/staffAdminSetupChecklist";

const menuReadinessIssues = {
  staff: ["STAFF_ADMIN_REQUIRED"],
  paymentInstructions: ["PAYMENT_INSTRUCTION_REQUIRED"],
  plans: ["ACTIVE_SERVICE_PLAN_REQUIRED", "BRANCH_CAPACITY_REQUIRED"],
  branches: ["ACTIVE_BRANCH_REQUIRED", "OPERATING_HOURS_REQUIRED"],
} satisfies Record<string, TenantReadinessIssue[]>;

function attentionIssues(issues: TenantReadinessIssue[] | undefined, menuIssues: TenantReadinessIssue[]) {
  const activeIssues = new Set(issues);
  return menuIssues.filter((issue) => activeIssues.has(issue));
}

export default function StaffAdminScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const readOnly = membership?.active === false;
  const hasDaycareOperations = hasInstitutionCapability(membership?.capabilities ?? [], "DAYCARE_OPERATIONS");
  const access = useUiAccessContext(Boolean(membership));
  const hasLearningAccess = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" && hasDaycareOperations });
  const invoices = useInvoices();
  const entitlements = useEntitlements();
  const readiness = useQuery({ queryKey: ["organization-readiness", organizationId], queryFn: () => api.organizationReadiness(), enabled: membership?.role === "STAFF_ADMIN" });
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const summary = createStaffAdminSummary({ children: [], users: users.data ?? [], pendingBookings: [], invoices: invoices.data ?? [], entitlements: entitlements.data ?? [] });
  const setupIssues = pendingStaffAdminSetupIssues(readiness.data?.issues);
  const activeBranchId = branches.data?.find((branch) => branch.active)?.id;
  const openSetupIssue = (issue: TenantReadinessIssue) => {
    switch (issue) {
      case "ACTIVE_BRANCH_REQUIRED": router.push("/branches" as never); break;
      case "OPERATING_HOURS_REQUIRED":
        if (activeBranchId) router.push({ pathname: "/branch-operating-hours", params: { branchId: activeBranchId } });
        else router.push("/branches" as never);
        break;
      case "ACTIVE_CLASSROOM_REQUIRED": router.push("/academic"); break;
      case "ACTIVE_SERVICE_PLAN_REQUIRED":
      case "BRANCH_CAPACITY_REQUIRED": router.push("/billing-admin"); break;
      case "PAYMENT_INSTRUCTION_REQUIRED": router.push("/payment-instructions"); break;
      default: break;
    }
  };

  return <AppScreen><AppText variant="title">{t("staffAdmin.title")}</AppText>
    <AppText tone="muted">{t("staffAdmin.subtitle")}</AppText>{readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {readiness.data?.issues.includes("SUBSCRIPTION_NOT_ACTIVE") && <View style={styles.subscriptionAttention}><AppText variant="label" tone="danger">{t("tenantReadiness.needsAttention")}</AppText><AppText variant="bodySmall" tone="danger">{t(tenantReadinessIssueKey("SUBSCRIPTION_NOT_ACTIVE"))}</AppText></View>}
    {readiness.data && <SetupChecklist issues={setupIssues} ready={readiness.data.status === "READY"} onOpen={openSetupIssue} />}
    <View style={styles.metrics}>
      <Metric label={t("staffAdmin.activeStaff")} value={summary.activeStaff} />
      <Metric label={t("staffAdmin.pendingPayments")} value={summary.pendingInvoices} />
      <Metric label={t("staffAdmin.activeSubscriptions")} value={summary.activeSubscriptions} />
      <Metric label={t("staffAdmin.remainingCredits")} value={summary.remainingCredits} />
    </View>
    <MenuItem title={t("nav.development")} description={t("staffOperations.developmentDescription")} onPress={() => router.push("/development")} />
    {hasAcademicOffering && <MenuItem title={t("goals.title")} description={t("goals.menuDescription")} onPress={() => router.push("/goals")} />}
    {hasLearningAccess && <MenuItem title={t("analytics.title")} description={t("analytics.menuDescription")} onPress={() => router.push("/analytics")} />}
    <MenuItem title={t("staffAdmin.staff")} description={t("staffAdmin.staffDescription")} attentionIssues={attentionIssues(readiness.data?.issues, menuReadinessIssues.staff)} onPress={() => router.push("/tenant-users")} />
    <MenuItem title={t("staffAdmin.payments")} description={t("staffAdmin.paymentsDescription")} onPress={() => router.push("/parent-payments")} />
    <MenuItem title={t("paymentInstruction.title")} description={t("paymentInstruction.managementDescription")} attentionIssues={attentionIssues(readiness.data?.issues, menuReadinessIssues.paymentInstructions)} onPress={() => router.push("/payment-instructions")} />
    {hasDaycareOperations && <MenuItem title={t("staffAdmin.subscriptions")} description={t("staffAdmin.subscriptionsDescription")} onPress={() => router.push("/parent-subscriptions")} />}
    {hasDaycareOperations && <MenuItem title={t("staffAdmin.plans")} description={t("staffAdmin.plansDescription")} attentionIssues={attentionIssues(readiness.data?.issues, menuReadinessIssues.plans)} onPress={() => router.push("/billing-admin")} />}
    {hasAcademicOffering && <MenuItem title={t("privateTutoring.menu")} description={t("privateTutoring.adminDescription")} onPress={() => router.push("/private-tutoring-admin")} />}
    <MenuItem title={t("staffAdmin.branches")} description={t("staffAdmin.branchesDescription")} attentionIssues={attentionIssues(readiness.data?.issues, menuReadinessIssues.branches)} onPress={() => router.push("/branches" as never)} />
    <MenuItem title={t("childAttendanceReport.menu")} description={t("childAttendanceReport.menuDescription")} onPress={() => router.push("/child-attendance-report" as never)} />
    {hasDaycareOperations && <MenuItem title={t("overtime.chargesTitle")} description={t("overtime.chargesDescription")} onPress={() => router.push("/overtime-charges")} />}
    {hasDaycareOperations && <MenuItem title={t("staffAdmin.approvals")} description={t("staffAdmin.approvalsDescription")} onPress={() => router.push("/booking-approvals")} />}
    <MenuItem title={t("staffLeave.approvalsTitle")} description={t("staffLeave.approvalsDescription")} onPress={() => router.push("/staff-leave-approvals")} />
    <MenuItem title={t("absence.menu")} description={t("absence.menuDescription")} onPress={() => router.push("/absence-requests")} />
    <MenuItem title={t("nav.profile")} description={t("profile.staffMenuDescription")} onPress={() => router.push("/profile")} />
  </AppScreen>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><AppText variant="h3">{value}</AppText><AppText variant="caption" tone="muted">{label}</AppText></View>;
}

function MenuItem({ title, description, attentionIssues: issues = [], onPress }: { title: string; description: string; attentionIssues?: TenantReadinessIssue[]; onPress: () => void }) {
  const { t } = useI18n();
  const needsAttention = issues.length > 0;
  return <NavigationCard accessibilityLabel={title} onPress={onPress} style={needsAttention && styles.menuAttention}><View style={styles.menuHeader}><AppText variant="h5">{title}</AppText>{needsAttention && <View style={styles.attentionFlag}><AppText variant="overline" tone="danger">{t("tenantReadiness.needsAttention")}</AppText></View>}</View><AppText variant="bodySmall" tone="muted">{description}</AppText>{issues.map((issue) => <AppText key={issue} variant="caption" tone="danger">• {t(tenantReadinessIssueKey(issue))}</AppText>)}</NavigationCard>;
}

function SetupChecklist({ issues, ready, onOpen }: { issues: TenantReadinessIssue[]; ready: boolean; onOpen: (issue: TenantReadinessIssue) => void }) {
  const { t } = useI18n();
  if (!issues.length && !ready) return null;
  return <View style={ready ? styles.setupReady : styles.setupChecklist}>
    <AppText variant="heading">{t("tenantReadiness.setupTitle")}</AppText>
    <AppText tone="muted">{ready ? t("tenantReadiness.setupReady") : t("tenantReadiness.setupDescription")}</AppText>
    {issues.map((issue) => <NavigationCard key={issue} accessibilityLabel={t(tenantReadinessIssueKey(issue))} onPress={() => onOpen(issue)} style={styles.setupItem}>
      <AppText variant="label">{t(tenantReadinessIssueKey(issue))}</AppText>
      <AppText variant="caption" tone="muted">{t("tenantReadiness.setupAction")}</AppText>
    </NavigationCard>)}
  </View>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 140, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  subscriptionAttention: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  setupChecklist: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  setupReady: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  setupItem: { backgroundColor: colors.surface },
  menuAttention: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  menuHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  attentionFlag: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface },
});
