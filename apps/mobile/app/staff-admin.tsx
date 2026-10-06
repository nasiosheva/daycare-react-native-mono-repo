import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useQuery } from "@tanstack/react-query";
import type { TenantReadinessIssue } from "@daycare/api-client";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Badge, Banner, colors, MenuItem, MenuSection, radius, spacing } from "@daycare/ui";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { StaffChatFloatingAction } from "@/chat/StaffChatFloatingAction";
import { useEntitlements, useInvoices } from "@/booking/useBooking";
import { createStaffAdminSummary } from "@/home/staffAdminSummary";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantReadinessIssueKey } from "@/i18n/translations";
import { hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";
import { pendingStaffAdminSetupIssues } from "@/tenant-readiness/staffAdminSetupChecklist";

const menuReadinessIssues = {
  staff: ["STAFF_ADMIN_REQUIRED"],
  offerings: ["PUBLISHED_OFFERING_REQUIRED"],
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
  const access = useUiAccessContext(Boolean(membership));
  const hasDaycareOperations = hasOfferingCapability(access.data, "DAYCARE_OPERATIONS");
  const hasLearningAccess = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
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
      case "PUBLISHED_OFFERING_REQUIRED": router.push("/education-offerings" as never); break;
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

  const issuesFor = (menuIssues: TenantReadinessIssue[]) => attentionIssues(readiness.data?.issues, menuIssues);

  return <AppScreen floatingAction={<StaffChatFloatingAction />}><AppText variant="title">{t("staffAdmin.title")}</AppText>
    <AppText tone="muted">{t("staffAdmin.subtitle")}</AppText>
    {readOnly && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    {readiness.data?.issues.includes("SUBSCRIPTION_NOT_ACTIVE") && <Banner tone="danger" title={t("tenantReadiness.needsAttention")} message={t(tenantReadinessIssueKey("SUBSCRIPTION_NOT_ACTIVE"))} />}
    {readiness.data && <SetupChecklist issues={setupIssues} ready={readiness.data.status === "READY"} onOpen={openSetupIssue} />}
    <View style={styles.metrics}>
      <Metric icon="people-outline" label={t("staffAdmin.activeStaff")} value={summary.activeStaff} />
      <Metric icon="wallet-outline" label={t("staffAdmin.pendingPayments")} value={summary.pendingInvoices} />
      <Metric icon="repeat-outline" label={t("staffAdmin.activeSubscriptions")} value={summary.activeSubscriptions} />
      <Metric icon="ticket-outline" label={t("staffAdmin.remainingCredits")} value={summary.remainingCredits} />
    </View>
    <MenuSection title={t("menu.groupDaily")}>
      {hasDaycareOperations && <AdminMenuItem icon="checkmark-done-outline" title={t("staffAdmin.approvals")} description={t("staffAdmin.approvalsDescription")} onPress={() => router.push("/booking-approvals")} />}
      <AdminMenuItem icon="calendar-outline" title={t("absence.menu")} description={t("absence.menuDescription")} onPress={() => router.push("/absence-requests")} />
      <AdminMenuItem icon="airplane-outline" title={t("staffLeave.approvalsTitle")} description={t("staffLeave.approvalsDescription")} onPress={() => router.push("/staff-leave-approvals")} />
      <AdminMenuItem icon="document-text-outline" title={t("childAttendanceReport.menu")} description={t("childAttendanceReport.menuDescription")} onPress={() => router.push("/child-attendance-report" as never)} />
      {hasDaycareOperations && <AdminMenuItem icon="time-outline" title={t("overtime.chargesTitle")} description={t("overtime.chargesDescription")} onPress={() => router.push("/overtime-charges")} />}
    </MenuSection>
    <MenuSection title={t("menu.groupLearning")}>
      <AdminMenuItem icon="sparkles-outline" title={t("nav.development")} description={t("staffOperations.developmentDescription")} onPress={() => router.push("/development")} />
      {hasAcademicOffering && <AdminMenuItem icon="flag-outline" title={t("goals.title")} description={t("goals.menuDescription")} onPress={() => router.push("/goals")} />}
      {hasLearningAccess && <AdminMenuItem icon="bar-chart-outline" title={t("analytics.title")} description={t("analytics.menuDescription")} onPress={() => router.push("/analytics")} />}
      {hasAcademicOffering && <AdminMenuItem icon="school-outline" title={t("privateTutoring.menu")} description={t("privateTutoring.adminDescription")} onPress={() => router.push("/private-tutoring-admin")} />}
    </MenuSection>
    <MenuSection title={t("menu.groupFinance")}>
      <AdminMenuItem icon="wallet-outline" title={t("staffAdmin.payments")} description={t("staffAdmin.paymentsDescription")} onPress={() => router.push("/parent-payments")} />
      <AdminMenuItem icon="card-outline" title={t("paymentInstruction.title")} description={t("paymentInstruction.managementDescription")} attentionIssues={issuesFor(menuReadinessIssues.paymentInstructions)} onPress={() => router.push("/payment-instructions")} />
      {hasDaycareOperations && <AdminMenuItem icon="repeat-outline" title={t("staffAdmin.subscriptions")} description={t("staffAdmin.subscriptionsDescription")} onPress={() => router.push("/parent-subscriptions")} />}
      {hasDaycareOperations && <AdminMenuItem icon="pricetags-outline" title={t("staffAdmin.plans")} description={t("staffAdmin.plansDescription")} attentionIssues={issuesFor(menuReadinessIssues.plans)} onPress={() => router.push("/billing-admin")} />}
    </MenuSection>
    <MenuSection title={t("menu.groupInstitution")}>
      <AdminMenuItem icon="people-outline" title={t("staffAdmin.staff")} description={t("staffAdmin.staffDescription")} attentionIssues={issuesFor(menuReadinessIssues.staff)} onPress={() => router.push("/tenant-users")} />
      <AdminMenuItem icon="business-outline" title={t("staffAdmin.branches")} description={t("staffAdmin.branchesDescription")} attentionIssues={issuesFor(menuReadinessIssues.branches)} onPress={() => router.push("/branches" as never)} />
      <AdminMenuItem icon="apps-outline" title={t("tenant.institutionTypes")} description={t("tenant.institutionTypesInfo")} attentionIssues={issuesFor(menuReadinessIssues.offerings)} onPress={() => router.push("/education-offerings" as never)} />
      {hasDaycareOperations && <AdminMenuItem icon="shield-checkmark-outline" title={t("consent.staffTitle")} description={t("consent.staffDescription")} onPress={() => router.push("/consent-definitions" as never)} />}
    </MenuSection>
    <MenuSection title={t("menu.groupOther")}>
      <AdminMenuItem icon="chatbox-ellipses-outline" title={t("tenantFeedback.inboxTitle")} description={t("tenantFeedback.inboxDescription")} onPress={() => router.push("/tenant-feedback-inbox" as never)} />
      <AdminMenuItem icon="person-circle-outline" title={t("nav.profile")} description={t("profile.staffMenuDescription")} onPress={() => router.push("/profile")} />
    </MenuSection>
  </AppScreen>;
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return <View style={styles.metric}><Ionicons name={icon} size={20} color={colors.primary} /><AppText variant="h3">{value}</AppText><AppText variant="caption" tone="muted">{label}</AppText></View>;
}

function AdminMenuItem({ icon, title, description, attentionIssues: issues = [], onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; attentionIssues?: TenantReadinessIssue[]; onPress: () => void }) {
  const { t } = useI18n();
  const needsAttention = issues.length > 0;
  return <View>
    <MenuItem icon={icon} title={title} description={description} attention={needsAttention} badge={needsAttention ? <Badge tone="danger" icon="alert-circle" label={t("tenantReadiness.needsAttention")} /> : undefined} onPress={onPress} />
    {needsAttention && <View style={styles.issueList}>{issues.map((issue) => <AppText key={issue} variant="caption" tone="danger">• {t(tenantReadinessIssueKey(issue))}</AppText>)}</View>}
  </View>;
}

function SetupChecklist({ issues, ready, onOpen }: { issues: TenantReadinessIssue[]; ready: boolean; onOpen: (issue: TenantReadinessIssue) => void }) {
  const { t } = useI18n();
  if (!issues.length && !ready) return null;
  return <View style={ready ? styles.setupReady : styles.setupChecklist}>
    <AppText variant="heading">{t("tenantReadiness.setupTitle")}</AppText>
    <AppText tone="muted">{ready ? t("tenantReadiness.setupReady") : t("tenantReadiness.setupDescription")}</AppText>
    {issues.map((issue) => <MenuItem key={issue} icon="alert-circle-outline" attention title={t(tenantReadinessIssueKey(issue))} description={t("tenantReadiness.setupAction")} onPress={() => onOpen(issue)} />)}
  </View>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 140, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  setupChecklist: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  setupReady: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  issueList: { gap: 2, paddingTop: spacing.xs, paddingHorizontal: spacing.md },
});
