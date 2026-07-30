import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppText, Button, FloatingActionButton, ShimmerList, colors, NavigationCard, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useBookings, useEntitlements, useInvoices } from "@/booking/useBooking";
import { createStaffAdminSummary } from "@/home/staffAdminSummary";
import { AppScreen } from "@/navigation/AppScreen";
import { hasInstitutionCapability } from "@daycare/core";
import { useI18n } from "@/i18n/I18nProvider";
import { invoiceSourceKey, tenantPaymentStatusKey, tenantSubscriptionPlanKey } from "@/i18n/translations";
import { useStaffDailyTasks } from "@/home/useStaffDailyTasks";
import { createParentHomeSummary } from "@/home/parentHomeSummary";
import { authErrorMessage } from "@/auth/authErrorMessage";
import { unreadNotificationBadge, unreadNotificationCount } from "@/notifications/unreadBadge";

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, organizationId, loading, profileError } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const staffChildren = useChildren(membership?.role === "STAFF");
  const staffDailyTasks = useStaffDailyTasks(staffChildren.data ?? [], membership?.role === "STAFF");
  if (loading) return <HomeLoadingState />;
  if (!user) return <Redirect href="/sign-in" />;
  if (!profile) return profileError ? <ProfileLoadFailure error={profileError} /> : <HomeLoadingState />;
  if (profile.isPlatformAdmin) return <PlatformAdminHome />;
  if (!membership && profile.registrationRole === "PARENT") return <ParentOnboardingHome displayName={profile.displayName} />;
  if (!membership) return <Redirect href={"/profile" as never} />;
  const hasDaycareOperations = hasInstitutionCapability(membership.capabilities, "DAYCARE_OPERATIONS");
  const isStaffAdmin = membership.role === "STAFF_ADMIN";
  const isStaff = membership.role === "STAFF";
  if (isStaffAdmin) return <StaffAdminHome displayName={profile.displayName} organizationName={membership.organizationName} hasDaycareOperations={hasDaycareOperations} />;
  if (isStaff) return <StaffHome displayName={profile.displayName} organizationName={membership.organizationName} managedChildren={staffChildren} tasksByChildId={staffDailyTasks} />;
  return <ParentHome displayName={profile.displayName} organizationName={membership.organizationName} hasDaycareOperations={hasDaycareOperations} />;
}

function ProfileLoadFailure({ error }: { error: Error }) {
  const { refreshProfile, signOut } = useAuth();
  const { t } = useI18n();
  return <AppScreen showBottomNavigation={false}><View style={styles.profileError}>
    <AppText variant="heading">{t("auth.profileLoadFailed")}</AppText>
    <AppText tone="muted">{authErrorMessage(error, t)}</AppText>
    <View style={styles.profileErrorActions}>
      <Button onPress={() => void refreshProfile().catch(() => undefined)}>{t("common.retry")}</Button>
      <Button variant="secondary" onPress={() => void signOut().catch(() => undefined)}>{t("auth.signOut")}</Button>
    </View>
  </View></AppScreen>;
}

function StaffHome({ displayName, organizationName, managedChildren, tasksByChildId }: { displayName: string; organizationName: string; managedChildren: ReturnType<typeof useChildren>; tasksByChildId: ReturnType<typeof useStaffDailyTasks> }) {
  const router = useRouter();
  const { api, organizationId } = useAuth();
  const { t } = useI18n();
  const notifications = useQuery({ queryKey: ["notifications", organizationId], queryFn: () => api.notifications(), enabled: Boolean(organizationId) });
  const unreadNotificationsCount = unreadNotificationCount(notifications.data ?? []);
  const unreadNotificationBadgeLabel = unreadNotificationBadge(unreadNotificationsCount);
  const unreadNotificationsLabel = unreadNotificationBadgeLabel ? t("notifications.unreadCount", { count: unreadNotificationsCount }) : t("notifications.title");
  return <AppScreen><View style={styles.content}>
    <View style={styles.staffToolbar}><View style={styles.staffHeading}><AppText variant="title">{t("home.greeting", { name: displayName })}</AppText><AppText tone="muted">{organizationName} · {t("role.STAFF")}</AppText></View><Pressable accessibilityRole="button" accessibilityLabel={unreadNotificationsLabel} hitSlop={spacing.sm} onPress={() => router.push("/notifications")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}><Ionicons name="notifications-outline" size={28} color={colors.primary} />{unreadNotificationBadgeLabel && <View pointerEvents="none" style={styles.notificationBadge}><AppText variant="caption" style={styles.notificationBadgeText}>{unreadNotificationBadgeLabel}</AppText></View>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={t("nav.profile")} hitSlop={spacing.sm} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}><Ionicons name="person-circle-outline" size={32} color={colors.primary} /></Pressable></View>
    <AppText variant="heading">{t("home.managedChildren")}</AppText>
    {managedChildren.isFetching && <ShimmerList variant="tile" />}
    {!managedChildren.isFetching && managedChildren.data?.map((child) => {
      const tasks = tasksByChildId.get(child.id);
      return <NavigationCard key={child.id} accessibilityLabel={t("home.openDailyTasks", { name: child.fullName })} onPress={() => router.push({ pathname: "/development", params: { childId: child.id } })}>
        <AppText variant="h5">{child.fullName}</AppText>
        {!tasks || tasks.isLoading ? <AppText tone="muted">{t("home.dailyStatusLoading")}</AppText> : tasks.isError ? <AppText tone="danger">{t("home.dailyStatusUnavailable")}</AppText> : <><AppText tone={tasks.developmentRecorded ? "muted" : "danger"}>{t(tasks.developmentRecorded ? "home.dailyDevelopmentDone" : "home.dailyDevelopmentPending")}</AppText>{tasks.activeGoalCount === 0 ? <AppText variant="caption" tone="muted">{t("home.noActiveGoals")}</AppText> : tasks.pendingGoalNames.length > 0 ? <AppText variant="caption" tone="danger">{t("home.dailyGoalsPending", { names: tasks.pendingGoalNames.join(", ") })}</AppText> : <AppText variant="caption" tone="muted">{t("home.dailyGoalsDone")}</AppText>}</>}
      </NavigationCard>;
    })}
    {!managedChildren.isFetching && managedChildren.data?.length === 0 && <AppText tone="muted">{t("home.noManagedChildren")}</AppText>}
  </View></AppScreen>;
}

function ParentHome({ displayName, organizationName, hasDaycareOperations }: { displayName: string; organizationName: string; hasDaycareOperations: boolean }) {
  const router = useRouter();
  const { t, formatCurrency, formatDate } = useI18n();
  const children = useChildren(true);
  const entitlements = useEntitlements(hasDaycareOperations);
  const invoices = useInvoices(true);
  const summary = createParentHomeSummary(children.data ?? [], entitlements.data ?? [], invoices.data ?? []);
  const childrenUnavailable = children.isFetching || children.isError;
  const servicesUnavailable = hasDaycareOperations && (entitlements.isFetching || entitlements.isError);
  const paymentsUnavailable = invoices.isFetching || invoices.isError;

  return <AppScreen><View style={styles.content}>
    <View style={styles.parentToolbar}><View style={styles.staffHeading}><AppText variant="title">{t("home.greeting", { name: displayName })}</AppText><AppText tone="muted">{organizationName} · {t("role.PARENT")}</AppText></View><ProfileToolbarButton onPress={() => router.push("/profile")} label={t("nav.profile")} /></View>
    <SummarySection title={t("home.parentChildren")}>
      {children.isFetching && <ShimmerList />}
      {children.isError && <Button variant="secondary" onPress={() => children.refetch()}>{t("common.retry")}</Button>}
      {!childrenUnavailable && summary.children.map(({ child, activeEntitlements }) => <View key={child.id} style={styles.parentCard}>
        <AppText variant="heading">{child.fullName}</AppText>
        <AppText tone="muted">{t(child.todayCheckedOutAt ? "attendance.statusCheckedOut" : child.todayCheckedInAt ? "attendance.statusCheckedIn" : "attendance.statusNotYet")}</AppText>
        {hasDaycareOperations && (servicesUnavailable ? <AppText variant="caption" tone="muted">{t("home.parentSummaryLoading")}</AppText> : <>{activeEntitlements.length === 0 && <AppText variant="caption" tone="muted">{t("home.parentNoActiveServices")}</AppText>}{activeEntitlements.map((entitlement) => <View key={entitlement.id} style={styles.parentService}>
          <AppText variant="label">{entitlement.planName}</AppText>
          <AppText variant="caption" tone="muted">{entitlement.remainingCredits == null ? t("booking.monthlyActive") : t("booking.remainingDays", { count: entitlement.remainingCredits })} · {t("booking.validUntil", { date: formatDate(entitlement.validUntil) })}</AppText>
        </View>)}</>)}
        <View style={styles.parentActions}>
          <Button variant="secondary" onPress={() => router.push({ pathname: "/parent-child-profile", params: { childId: child.id } })}>{t("children.parentProfile")}</Button>
          <Button variant="secondary" onPress={() => router.push({ pathname: "/development", params: { childId: child.id } })}>{t("development.title")}</Button>
          <Button variant="secondary" onPress={() => router.push({ pathname: "/parent-qr", params: { childId: child.id } })}>{t("qr.title")}</Button>
          <Button variant="secondary" onPress={() => router.push({ pathname: "/absence-requests", params: { childId: child.id } })}>{t("absence.menu")}</Button>
        </View>
      </View>)}
      {!childrenUnavailable && summary.children.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
    </SummarySection>
    <NavigationCard accessibilityLabel={t("privateTutoring.menu")} onPress={() => router.push("/private-tutoring")}>
      <AppText variant="h5">{t("privateTutoring.menu")}</AppText>
      <AppText tone="muted">{t("privateTutoring.description")}</AppText>
    </NavigationCard>
    <SummarySection title={t("home.parentPayments")}>
      {invoices.isFetching && <ShimmerList />}
      {invoices.isError && <Button variant="secondary" onPress={() => invoices.refetch()}>{t("common.retry")}</Button>}
      {!paymentsUnavailable && summary.actionableInvoices.map((invoice) => <View key={invoice.id} style={styles.parentCard}>
        <AppText variant="heading">{invoice.invoiceNumber}</AppText>
        <AppText>{invoice.description ?? t(invoiceSourceKey(invoice.source))} · {formatCurrency(invoice.totalAmount)}</AppText><AppText tone="muted">{invoice.childName}</AppText>
        <AppText tone="muted">{t(`status.${invoice.status}` as Parameters<typeof t>[0])} · {t("tenant.dueDate", { date: formatDate(invoice.dueDate) })}</AppText>
        {invoice.status === "PENDING" ? <Button onPress={() => router.push({ pathname: "/parent-payment", params: { invoiceId: invoice.id } })}>{t("parentEnrollment.pay")}</Button> : <AppText variant="caption" tone="muted">{t("paymentProof.awaitingReview")}</AppText>}
      </View>)}
      {!paymentsUnavailable && summary.actionableInvoices.length === 0 && <AppText tone="muted">{t("home.noActionablePayments")}</AppText>}
    </SummarySection>
  </View></AppScreen>;
}

function ParentOnboardingHome({ displayName }: { displayName: string }) {
  const router = useRouter();
  const { api } = useAuth();
  const { t, formatCurrency } = useI18n();
  const enrollments = useQuery({ queryKey: ["parent-enrollments"], queryFn: () => api.parentEnrollments() });
  const next = enrollments.data?.find((item) => item.status === "APPROVED" && item.invoiceStatus === "PENDING") ?? enrollments.data?.find((item) => item.status === "PENDING_APPROVAL");
  return <AppScreen><View style={styles.content}>
    <View style={styles.parentToolbar}><View style={styles.staffHeading}><AppText variant="title">{t("home.greeting", { name: displayName })}</AppText><AppText tone="muted">{t("parentEnrollment.onboardingSubtitle")}</AppText></View><ProfileToolbarButton onPress={() => router.push("/profile")} label={t("nav.profile")} /></View>
    {next?.status === "PENDING_APPROVAL" && <View style={styles.parentCard}><AppText variant="heading">{next.childName}</AppText><AppText tone="muted">{t("parentEnrollment.pendingApproval")}</AppText><Button variant="secondary" onPress={() => router.push("/parent-enrollment")}>{t("parentEnrollment.viewApplication")}</Button></View>}
    {next?.invoiceStatus === "PENDING" && next.invoiceId && <View style={styles.parentCard}><AppText variant="heading">{next.childName}</AppText><AppText>{next.planName} · {formatCurrency(next.totalAmount)}</AppText><AppText tone="muted">{t("parentEnrollment.approvedPayment")}</AppText><Button onPress={() => router.push({ pathname: "/parent-payment", params: { invoiceId: next.invoiceId! } })}>{t("parentEnrollment.pay")}</Button></View>}
    {!next && <NavigationCard accessibilityLabel={t("parentEnrollment.newTenant")} onPress={() => router.push("/parent-enrollment-form")}><AppText variant="h5">{t("parentEnrollment.newTenant")}</AppText><AppText tone="muted">{t("parentEnrollment.startDescription")}</AppText></NavigationCard>}
  </View></AppScreen>;
}

function HomeLoadingState() {
  const { t } = useI18n();
  return <AppScreen showBottomNavigation={false}><View style={styles.loading}><ActivityIndicator color={colors.primary} /><AppText tone="muted">{t("common.loading")}</AppText></View></AppScreen>;
}

function StaffAdminHome({ displayName, organizationName, hasDaycareOperations }: { displayName: string; organizationName: string; hasDaycareOperations: boolean }) {
  const router = useRouter();
  const { api, organizationId } = useAuth();
  const { t } = useI18n();
  const children = useChildren(true);
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: Boolean(organizationId) });
  const pendingBookings = useBookings(true, hasDaycareOperations);
  const pendingEnrollments = useQuery({ queryKey: ["parent-enrollments", organizationId, "pending"], queryFn: () => api.pendingParentEnrollments(), enabled: Boolean(organizationId) });
  const invoices = useInvoices(hasDaycareOperations);
  const entitlements = useEntitlements(hasDaycareOperations);
  const [branchSearch, setBranchSearch] = useState("");
  const [debouncedBranchSearch, setDebouncedBranchSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedBranchSearch(branchSearch.trim()), 300);
    return () => clearTimeout(handle);
  }, [branchSearch]);
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId, debouncedBranchSearch], queryFn: () => api.branches(debouncedBranchSearch || undefined), enabled: Boolean(organizationId) });
  const capacities = useQuery({ queryKey: ["branch-capacities", organizationId], queryFn: () => api.branchCapacities(), enabled: Boolean(organizationId) });
  const activeBranches = branches.data?.filter((branch) => branch.active) ?? [];
  const branchSummaries = activeBranches.map((branch) => ({
    branch,
    capacity: capacities.data?.find((item) => item.branchId === branch.id)?.dailyCapacity,
    childrenCount: children.data?.filter((child) => child.branchId === branch.id).length ?? 0,
    staffCount: users.data?.filter((user) => user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || (user.role === "STAFF" && user.branchId === branch.id))).length ?? 0,
    pendingApprovals: (pendingBookings.data?.filter((booking) => booking.branchId === branch.id && booking.status === "PENDING_APPROVAL").length ?? 0) + (pendingEnrollments.data?.filter((enrollment) => enrollment.branchId === branch.id).length ?? 0),
    pendingInvoices: invoices.data?.filter((invoice) => invoice.branchId === branch.id && invoice.status === "PENDING").length ?? 0,
  }));
  const notifications = useQuery({ queryKey: ["notifications", organizationId], queryFn: () => api.notifications(), enabled: Boolean(organizationId) });
  const unreadNotifications = notifications.data ?? [];
  const unreadNotificationsCount = unreadNotificationCount(unreadNotifications);
  const unreadNotificationBadgeLabel = unreadNotificationBadge(unreadNotificationsCount);
  const unreadNotificationsLabel = unreadNotificationBadgeLabel ? t("notifications.unreadCount", { count: unreadNotificationsCount }) : t("notifications.title");
  const summary = createStaffAdminSummary({ children: children.data ?? [], users: users.data ?? [], pendingBookings: pendingBookings.data ?? [], pendingEnrollments: pendingEnrollments.data ?? [], invoices: invoices.data ?? [], entitlements: entitlements.data ?? [] });
  const operationalUnavailable = children.isFetching || users.isFetching || children.isError || users.isError;
  const financialUnavailable = pendingBookings.isFetching || invoices.isFetching || entitlements.isFetching || pendingBookings.isError || invoices.isError || entitlements.isError;
  const approvalsUnavailable = pendingBookings.isFetching || pendingEnrollments.isFetching || pendingBookings.isError || pendingEnrollments.isError;

  return <AppScreen><View style={styles.content}>
    <View style={styles.staffAdminToolbar}>
      <View style={styles.staffAdminHeading}>
        <AppText variant="title">{t("home.greeting", { name: displayName })}</AppText>
        <AppText tone="muted">{organizationName} · {t("role.STAFF_ADMIN")}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={unreadNotificationsLabel} hitSlop={spacing.sm} onPress={() => router.push("/notifications")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}>
        <Ionicons name="notifications-outline" size={28} color={colors.primary} />
        {unreadNotificationBadgeLabel && <View pointerEvents="none" style={styles.notificationBadge}><AppText variant="caption" style={styles.notificationBadgeText}>{unreadNotificationBadgeLabel}</AppText></View>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("nav.profile")} hitSlop={spacing.sm} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}>
        <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
      </Pressable>
    </View>
    <SummarySection title={t("home.operationalSummary")}>
      <SummaryCard label={t("home.activeChildren")} value={operationalUnavailable ? undefined : summary.activeChildren} onPress={() => router.push("/children")} />
      <SummaryCard label={t("home.activeStaff")} value={operationalUnavailable ? undefined : summary.activeStaff} onPress={() => router.push("/tenant-users")} />
      <SummaryCard label={t("home.pendingApprovals")} value={approvalsUnavailable ? undefined : summary.pendingApprovals} onPress={() => router.push("/booking-approvals")} />
    </SummarySection>
    {hasDaycareOperations && <SummarySection title={t("home.financialSummary")}>
      <SummaryCard label={t("home.pendingInvoices")} value={financialUnavailable ? undefined : summary.pendingInvoices} onPress={() => router.push("/parent-payments")} />
      <SummaryCard label={t("home.activeSubscriptions")} value={financialUnavailable ? undefined : summary.activeSubscriptions} onPress={() => router.push("/parent-subscriptions")} />
      <SummaryCard label={t("home.remainingCredits")} value={financialUnavailable ? undefined : summary.remainingCredits} onPress={() => router.push("/parent-subscriptions")} />
    </SummarySection>}

    <AppText variant="heading">{t("home.branchSummary")}</AppText>
    <TextInput style={styles.input} placeholder={t("home.branchSearchPlaceholder")} value={branchSearch} onChangeText={setBranchSearch} />
    {(branches.isFetching || capacities.isFetching || children.isFetching || users.isFetching || pendingBookings.isFetching || pendingEnrollments.isFetching || invoices.isFetching) && <ShimmerList />}
    {!branches.isFetching && !capacities.isFetching && !children.isFetching && !users.isFetching && !pendingBookings.isFetching && !pendingEnrollments.isFetching && !invoices.isFetching && branchSummaries.map((item) => <View key={item.branch.id} style={styles.branchCard}>
      <AppText variant="heading">{item.branch.name}</AppText>
      <AppText tone="muted">{item.capacity != null ? t("home.branchChildrenWithCapacity", { count: item.childrenCount, capacity: item.capacity }) : t("home.branchChildrenNoCapacity", { count: item.childrenCount })}</AppText>
      <AppText tone="muted">{t("home.branchStaffSummary", { count: item.staffCount })}</AppText>
      <AppText tone={item.pendingApprovals > 0 ? "danger" : "muted"}>{t("home.branchApprovalsSummary", { count: item.pendingApprovals })}</AppText>
      <AppText tone={item.pendingInvoices > 0 ? "danger" : "muted"}>{t("home.branchInvoicesSummary", { count: item.pendingInvoices })}</AppText>
    </View>)}
    {!branches.isFetching && activeBranches.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
  </View></AppScreen>;
}

function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.summarySection}><AppText variant="heading">{title}</AppText><View style={styles.summaryGrid}>{children}</View></View>;
}

function SummaryCard({ label, value, onPress }: { label: string; value?: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.summaryCard, pressed && styles.summaryCardPressed]}>
    <AppText variant="h3">{value ?? "—"}</AppText><AppText variant="caption" tone="muted">{label}</AppText>
  </Pressable>;
}

function ProfileToolbarButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={spacing.sm} onPress={onPress} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}><Ionicons name="person-circle-outline" size={32} color={colors.primary} /></Pressable>;
}

function PlatformAdminHome() {
  const router = useRouter();
  const { api } = useAuth();
  const { t, formatCurrency } = useI18n();
  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: () => api.tenants() });
  const readiness = useQuery({ queryKey: ["platform-tenant-readiness"], queryFn: () => api.tenantReadiness() });
  const activeTenants = tenants.data?.filter((tenant) => tenant.subscriptionStatus === "ACTIVE") ?? [];
  const pendingTenants = tenants.data?.filter((tenant) => tenant.subscriptionStatus === "PENDING_PAYMENT") ?? [];

  return <AppScreen floatingAction={<FloatingActionButton accessibilityLabel={t("home.addTenant")} onPress={() => router.push("/add-tenant")}>+ {t("home.addTenant")}</FloatingActionButton>}><View style={styles.content}>
    <View style={styles.staffAdminToolbar}>
      <View style={styles.staffAdminHeading}>
        <AppText variant="title">{t("home.platformAdmin")}</AppText>
        <AppText tone="muted">{t("home.platformSubtitle")}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("nav.profile")} hitSlop={spacing.sm} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}>
        <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
      </Pressable>
    </View>
    {tenants.isFetching && <ShimmerList />}
    {tenants.isError && <AppText tone="danger">{t("home.tenantsError")}</AppText>}
    <NavigationCard accessibilityLabel={t("tenantReadiness.open")} onPress={() => router.push("/tenant-readiness")}>
      <AppText variant="h5">{t("tenantReadiness.menu")}</AppText>
      <AppText variant="bodySmall" tone="muted">{t("tenantReadiness.menuDescription")}</AppText>
      {readiness.isFetching && <AppText variant="caption" tone="muted">{t("common.loading")}</AppText>}
      {readiness.isError && <AppText variant="caption" tone="danger">{t("tenantReadiness.loadFailed")}</AppText>}
      {readiness.data && <AppText variant="caption" tone={readiness.data.needsAttentionCount > 0 ? "danger" : "muted"}>{readiness.data.needsAttentionCount > 0 ? t("tenantReadiness.needsAttentionSummary", { count: readiness.data.needsAttentionCount }) : t("tenantReadiness.allReadySummary", { count: readiness.data.readyCount })}</AppText>}
    </NavigationCard>
    {!tenants.isFetching && <><TenantSection title={t("home.activeTenants")} tenants={activeTenants} emptyMessage={t("home.noActiveTenants")} formatCurrency={formatCurrency} t={t} />
    <TenantSection title={t("home.pendingPayments")} tenants={pendingTenants} emptyMessage={t("home.noPendingPayments")} formatCurrency={formatCurrency} t={t} /></>}
  </View></AppScreen>;
}

function TenantSection({ title, tenants, emptyMessage, formatCurrency, t }: { title: string; tenants: { id: string; name: string; subscriptionPlan: "STARTER" | "STANDARD" | "PREMIUM" | null; payments: { amount: number; status: "PENDING" | "PAID" | "VOID" }[] }[]; emptyMessage: string; formatCurrency: (value: number) => string; t: ReturnType<typeof useI18n>["t"] }) {
  return <View style={styles.section}>
    <AppText variant="heading">{title}</AppText>
    {tenants.length === 0 && <AppText tone="muted">{emptyMessage}</AppText>}
    {tenants.map((tenant) => <View key={tenant.id} style={styles.tenant}>
      <AppText variant="label">{tenant.name}</AppText>
      <AppText tone="muted">{tenant.subscriptionPlan ? t(tenantSubscriptionPlanKey(tenant.subscriptionPlan)) : t("home.noSubscription")}</AppText>
      {tenant.payments[0] && <AppText variant="caption" tone="muted">{formatCurrency(tenant.payments[0].amount)} · {t(tenantPaymentStatusKey(tenant.payments[0].status))}</AppText>}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 240 },
  profileError: { flex: 1, justifyContent: "center", gap: spacing.md, minHeight: 240 },
  profileErrorActions: { gap: spacing.sm },
  staffAdminToolbar: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  staffAdminHeading: { flex: 1, gap: spacing.xs },
  staffToolbar: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  staffHeading: { flex: 1, gap: spacing.xs },
  parentToolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  profileButton: { padding: spacing.xs, borderRadius: radius.pill },
  profileButtonPressed: { opacity: 0.76, backgroundColor: colors.surfaceTint },
  notificationBadge: { position: "absolute", top: -spacing.xs, right: -spacing.xs, minWidth: spacing.lg, height: spacing.lg, paddingHorizontal: spacing.xs, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger },
  notificationBadgeText: { color: colors.surface },
  summarySection: { gap: spacing.sm },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryCard: { flexGrow: 1, minWidth: 150, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  summaryCardPressed: { opacity: 0.76 },
  parentCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  parentService: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  parentActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.sm },
  tenant: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  branchCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
