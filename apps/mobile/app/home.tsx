import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppText, Button, colors, FloatingActionButton, NavigationCard, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useBookings, useEntitlements, useInvoices } from "@/booking/useBooking";
import { createStaffAdminSummary } from "@/home/staffAdminSummary";
import { AppScreen } from "@/navigation/AppScreen";
import { can, hasInstitutionCapability } from "@daycare/core";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey, tenantPaymentStatusKey, tenantSubscriptionPlanKey } from "@/i18n/translations";
import { useStaffDailyTasks } from "@/home/useStaffDailyTasks";
import { authErrorMessage } from "@/auth/authErrorMessage";

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, organizationId, isSimulationSession, loading, profileError } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const staffChildren = useChildren(membership?.role === "STAFF" && !isSimulationSession);
  const staffDailyTasks = useStaffDailyTasks(staffChildren.data ?? [], membership?.role === "STAFF" && !isSimulationSession);
  if (loading) return <HomeLoadingState />;
  if (!user) return <Redirect href="/sign-in" />;
  if (!profile) return profileError ? <ProfileLoadFailure error={profileError} /> : <HomeLoadingState />;
  if (profile.isPlatformAdmin) return <PlatformAdminHome />;
  if (!membership) return <Redirect href={"/parent-enrollment" as never} />;
  const hasDaycareOperations = hasInstitutionCapability(membership.capabilities, "DAYCARE_OPERATIONS");
  const isStaffAdmin = membership.role === "STAFF_ADMIN";
  const isStaff = membership.role === "STAFF";
  if (isStaffAdmin) return <StaffAdminHome displayName={profile.displayName} organizationName={membership.organizationName} hasDaycareOperations={hasDaycareOperations} isSimulationSession={isSimulationSession} />;
  if (isStaff) return <StaffHome displayName={profile.displayName} organizationName={membership.organizationName} isSimulationSession={isSimulationSession} children={staffChildren} tasksByChildId={staffDailyTasks} />;
  return <AppScreen><View style={styles.content}>
    <><AppText variant="title">{t("home.greeting", { name: profile.displayName })}</AppText><AppText tone="muted">{membership.organizationName} · {t(roleKey(membership.role))}</AppText></>
    {isSimulationSession && <AppText variant="caption" tone="muted">{t("home.simulation")}</AppText>}
    {can(membership.role, "manageChildren") && <Button variant="secondary" onPress={() => router.push("/children")}>{t("children.title")}</Button>}
    {can(membership.role, "viewChildDevelopment") && <Button variant="secondary" onPress={() => router.push("/development")}>{t("development.title")}</Button>}
    {can(membership.role, "viewOwnChildren") && <Button onPress={() => router.push("/parent-qr")}>{t("qr.title")}</Button>}
    {["STAFF_ADMIN", "STAFF"].includes(membership.role) && <Button variant="secondary" onPress={() => router.push("/academic")}>{t("nav.academic")}</Button>}
    {hasDaycareOperations && can(membership.role, "bookServices") && <Button onPress={() => router.push("/booking")}>{t("booking.title")}</Button>}
    {membership.role === "PARENT" && <Button variant="secondary" onPress={() => router.push("/parent-enrollment" as never)}>{t("parentEnrollment.manageTenants")}</Button>}
    {!isStaffAdmin && hasDaycareOperations && can(membership.role, "approveBookings") && <Button onPress={() => router.push("/booking-approvals")}>{t("home.bookingApprovals")}</Button>}
  </View></AppScreen>;
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

function StaffHome({ displayName, organizationName, isSimulationSession, children, tasksByChildId }: { displayName: string; organizationName: string; isSimulationSession: boolean; children: ReturnType<typeof useChildren>; tasksByChildId: ReturnType<typeof useStaffDailyTasks> }) {
  const router = useRouter();
  const { t } = useI18n();
  return <AppScreen><View style={styles.content}>
    <View style={styles.staffToolbar}><View style={styles.staffHeading}><AppText variant="title">{t("home.greeting", { name: displayName })}</AppText><AppText tone="muted">{organizationName} · {t("role.STAFF")}</AppText></View><Pressable accessibilityRole="button" accessibilityLabel={t("nav.profile")} hitSlop={spacing.sm} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}><Ionicons name="person-circle-outline" size={32} color={colors.primary} /></Pressable></View>
    {isSimulationSession && <AppText variant="caption" tone="muted">{t("home.simulation")}</AppText>}
    <AppText variant="heading">{t("home.managedChildren")}</AppText>
    {children.isLoading && <AppText tone="muted">{t("children.loading")}</AppText>}
    {children.data?.map((child) => {
      const tasks = tasksByChildId.get(child.id);
      return <NavigationCard key={child.id} accessibilityLabel={t("home.openDailyTasks", { name: child.fullName })} onPress={() => router.push({ pathname: "/development", params: { childId: child.id } })}>
        <AppText variant="h5">{child.fullName}</AppText>
        {!tasks || tasks.isLoading ? <AppText tone="muted">{t("home.dailyStatusLoading")}</AppText> : tasks.isError ? <AppText tone="danger">{t("home.dailyStatusUnavailable")}</AppText> : <><AppText tone={tasks.developmentRecorded ? "muted" : "danger"}>{t(tasks.developmentRecorded ? "home.dailyDevelopmentDone" : "home.dailyDevelopmentPending")}</AppText>{tasks.activeGoalCount === 0 ? <AppText variant="caption" tone="muted">{t("home.noActiveGoals")}</AppText> : tasks.pendingGoalNames.length > 0 ? <AppText variant="caption" tone="danger">{t("home.dailyGoalsPending", { names: tasks.pendingGoalNames.join(", ") })}</AppText> : <AppText variant="caption" tone="muted">{t("home.dailyGoalsDone")}</AppText>}</>}
      </NavigationCard>;
    })}
    {!children.isLoading && children.data?.length === 0 && <AppText tone="muted">{t("home.noManagedChildren")}</AppText>}
  </View></AppScreen>;
}

function HomeLoadingState() {
  const { t } = useI18n();
  return <AppScreen showBottomNavigation={false}><View style={styles.loading}><ActivityIndicator color={colors.primary} /><AppText tone="muted">{t("common.loading")}</AppText></View></AppScreen>;
}

function StaffAdminHome({ displayName, organizationName, hasDaycareOperations, isSimulationSession }: { displayName: string; organizationName: string; hasDaycareOperations: boolean; isSimulationSession: boolean }) {
  const router = useRouter();
  const { api, organizationId } = useAuth();
  const { t } = useI18n();
  const canLoadData = !isSimulationSession;
  const children = useChildren(canLoadData);
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: Boolean(organizationId) && canLoadData });
  const pendingBookings = useBookings(true, canLoadData && hasDaycareOperations);
  const pendingEnrollments = useQuery({ queryKey: ["parent-enrollments", organizationId, "pending"], queryFn: () => api.pendingParentEnrollments(), enabled: Boolean(organizationId) && canLoadData });
  const invoices = useInvoices(canLoadData && hasDaycareOperations);
  const entitlements = useEntitlements(canLoadData && hasDaycareOperations);
  const summary = createStaffAdminSummary({ children: children.data ?? [], users: users.data ?? [], pendingBookings: pendingBookings.data ?? [], pendingEnrollments: pendingEnrollments.data ?? [], invoices: invoices.data ?? [], entitlements: entitlements.data ?? [] });
  const operationalUnavailable = isSimulationSession || children.isLoading || users.isLoading || children.isError || users.isError;
  const financialUnavailable = isSimulationSession || pendingBookings.isLoading || invoices.isLoading || entitlements.isLoading || pendingBookings.isError || invoices.isError || entitlements.isError;
  const approvalsUnavailable = isSimulationSession || pendingBookings.isLoading || pendingEnrollments.isLoading || pendingBookings.isError || pendingEnrollments.isError;

  return <AppScreen><View style={styles.content}>
    <View style={styles.staffAdminToolbar}>
      <View style={styles.staffAdminHeading}>
        <AppText variant="title">{t("home.greeting", { name: displayName })}</AppText>
        <AppText tone="muted">{organizationName} · {t("role.STAFF_ADMIN")}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("nav.profile")} hitSlop={spacing.sm} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}>
        <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
      </Pressable>
    </View>
    {isSimulationSession && <AppText variant="caption" tone="muted">{t("home.simulation")}</AppText>}
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

function PlatformAdminHome() {
  const router = useRouter();
  const { api } = useAuth();
  const { t, formatCurrency } = useI18n();
  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: () => api.tenants() });
  const activeTenants = tenants.data?.filter((tenant) => tenant.subscriptionStatus === "ACTIVE") ?? [];
  const pendingTenants = tenants.data?.filter((tenant) => tenant.subscriptionStatus === "PENDING_PAYMENT") ?? [];

  return <AppScreen floatingAction={<FloatingActionButton accessibilityLabel={t("home.addTenant")} onPress={() => router.push("/add-tenant")}>+ {t("home.addTenant")}</FloatingActionButton>}><View style={styles.content}>
    <AppText variant="title">{t("home.platformAdmin")}</AppText>
    <AppText tone="muted">{t("home.platformSubtitle")}</AppText>
    <Button variant="secondary" onPress={() => router.push("/global-curriculum")}>{t("globalCurriculum.menu")}</Button>
    {tenants.isLoading && <AppText>{t("home.tenantsLoading")}</AppText>}
    {tenants.isError && <AppText tone="danger">{t("home.tenantsError")}</AppText>}
    <TenantSection title={t("home.activeTenants")} tenants={activeTenants} emptyMessage={t("home.noActiveTenants")} formatCurrency={formatCurrency} t={t} />
    <TenantSection title={t("home.pendingPayments")} tenants={pendingTenants} emptyMessage={t("home.noPendingPayments")} formatCurrency={formatCurrency} t={t} />
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 240 },
  profileError: { flex: 1, justifyContent: "center", gap: spacing.md, minHeight: 240 },
  profileErrorActions: { gap: spacing.sm },
  staffAdminToolbar: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  staffAdminHeading: { flex: 1, gap: spacing.xs },
  staffToolbar: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  staffHeading: { flex: 1, gap: spacing.xs },
  profileButton: { padding: spacing.xs, borderRadius: radius.pill },
  profileButtonPressed: { opacity: 0.76, backgroundColor: colors.surfaceTint },
  summarySection: { gap: spacing.sm },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryCard: { flexGrow: 1, minWidth: 150, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  summaryCardPressed: { opacity: 0.76 },
  section: { gap: spacing.sm },
  tenant: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
