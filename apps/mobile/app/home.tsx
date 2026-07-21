import { Redirect, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText, Button, colors, FloatingActionButton, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { can, hasInstitutionCapability } from "@daycare/core";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey, tenantPaymentStatusKey, tenantSubscriptionPlanKey } from "@/i18n/translations";

export default function HomeScreen() {
  const { user, profile, organizationId, isSimulationSession } = useAuth();
  const { t } = useI18n();
  if (!user) return <Redirect href="/sign-in" />;
  if (profile?.isPlatformAdmin) return <PlatformAdminHome />;
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  if (!membership) return <Redirect href={"/parent-enrollment" as never} />;
  const hasDaycareOperations = hasInstitutionCapability(membership.capabilities, "DAYCARE_OPERATIONS");
  const hasAcademicCurriculum = hasInstitutionCapability(membership.capabilities, "ACADEMIC_CURRICULUM");
  const isStaffAdmin = membership.role === "STAFF_ADMIN";
  const isStaff = membership.role === "STAFF";
  const hasStaffProfileMenu = membership.role === "STAFF_ADMIN" || membership.role === "STAFF";
  return <AppScreen><View style={styles.content}>
    <AppText variant="title">{t("home.greeting", { name: profile?.displayName ?? "" })}</AppText>
    <AppText tone="muted">{membership.organizationName} · {t(roleKey(membership.role))}</AppText>
    {isSimulationSession && <AppText variant="caption" tone="muted">{t("home.simulation")}</AppText>}
    {isStaff && <Button onPress={() => router.push("/staff-operations")}>{t("nav.staffFlow")}</Button>}
    {!isStaff && can(membership.role, "recordAttendance") && <Button onPress={() => router.push("/attendance")}>{t("attendance.title")}</Button>}
    {!isStaff && can(membership.role, "manageChildren") && <Button variant="secondary" onPress={() => router.push("/children")}>{t("children.title")}</Button>}
    {!isStaff && can(membership.role, "viewChildDevelopment") && <Button variant="secondary" onPress={() => router.push("/development")}>{t("development.title")}</Button>}
    {can(membership.role, "viewOwnChildren") && <Button onPress={() => router.push("/parent-qr")}>{t("qr.title")}</Button>}
    {hasAcademicCurriculum && ["STAFF_ADMIN", "STAFF"].includes(membership.role) && <Button variant="secondary" onPress={() => router.push("/academic")}>{t("nav.academic")}</Button>}
    {hasDaycareOperations && can(membership.role, "bookServices") && <Button onPress={() => router.push("/booking")}>{t("booking.title")}</Button>}
    {membership.role === "PARENT" && <Button variant="secondary" onPress={() => router.push("/parent-enrollment" as never)}>{t("parentEnrollment.manageTenants")}</Button>}
    {isStaffAdmin && hasDaycareOperations && <Button onPress={() => router.push("/staff-admin")}>{t("staffAdmin.title")}</Button>}
    {!isStaffAdmin && hasDaycareOperations && can(membership.role, "approveBookings") && <Button onPress={() => router.push("/booking-approvals")}>{t("home.bookingApprovals")}</Button>}
    {hasStaffProfileMenu && <Button variant="secondary" onPress={() => router.push("/profile")}>{t("nav.profile")}</Button>}
  </View></AppScreen>;
}

function PlatformAdminHome() {
  const { api } = useAuth();
  const { t, formatCurrency } = useI18n();
  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: () => api.tenants() });
  const activeTenants = tenants.data?.filter((tenant) => tenant.subscriptionStatus === "ACTIVE") ?? [];
  const pendingTenants = tenants.data?.filter((tenant) => tenant.subscriptionStatus === "PENDING_PAYMENT") ?? [];

  return <AppScreen floatingAction={<FloatingActionButton accessibilityLabel={t("home.addTenant")} onPress={() => router.push("/add-tenant")}>+ {t("home.addTenant")}</FloatingActionButton>}><View style={styles.content}>
    <AppText variant="title">{t("home.platformAdmin")}</AppText>
    <AppText tone="muted">{t("home.platformSubtitle")}</AppText>
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
  section: { gap: spacing.sm },
  tenant: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
