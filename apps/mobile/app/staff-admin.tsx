import { Redirect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useEntitlements, useInvoices } from "@/booking/useBooking";
import { useI18n } from "@/i18n/I18nProvider";

export default function StaffAdminScreen() {
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const users = useQuery({ queryKey: ["tenant-users", organizationId], queryFn: () => api.tenantUsers(), enabled: membership?.role === "STAFF_ADMIN" });
  const invoices = useInvoices();
  const entitlements = useEntitlements();
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const activeStaff = users.data?.filter((user) => user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || user.role === "STAFF")).length ?? 0;
  const pendingPayments = invoices.data?.filter((invoice) => invoice.status === "PENDING").length ?? 0;
  const activeSubscriptions = entitlements.data?.filter((entitlement) => entitlement.status === "ACTIVE").length ?? 0;
  const remainingCredits = entitlements.data?.filter((entitlement) => entitlement.status === "ACTIVE").reduce((total, entitlement) => total + (entitlement.remainingCredits ?? 0), 0) ?? 0;

  return <AppScreen><AppText variant="title">{t("staffAdmin.title")}</AppText>
    <AppText tone="muted">{t("staffAdmin.subtitle")}</AppText>
    <View style={styles.metrics}>
      <Metric label={t("staffAdmin.activeStaff")} value={activeStaff} />
      <Metric label={t("staffAdmin.pendingPayments")} value={pendingPayments} />
      <Metric label={t("staffAdmin.activeSubscriptions")} value={activeSubscriptions} />
      <Metric label={t("staffAdmin.remainingCredits")} value={remainingCredits} />
    </View>
    <MenuItem title={t("staffAdmin.staff")} description={t("staffAdmin.staffDescription")} onPress={() => router.push("/tenant-users")} />
    <MenuItem title={t("staffAdmin.payments")} description={t("staffAdmin.paymentsDescription")} onPress={() => router.push("/parent-payments")} />
    <MenuItem title={t("staffAdmin.subscriptions")} description={t("staffAdmin.subscriptionsDescription")} onPress={() => router.push("/parent-subscriptions")} />
    <MenuItem title={t("staffAdmin.plans")} description={t("staffAdmin.plansDescription")} onPress={() => router.push("/billing-admin")} />
    <MenuItem title={t("staffAdmin.approvals")} description={t("staffAdmin.approvalsDescription")} onPress={() => router.push("/booking-approvals")} />
    <MenuItem title={t("nav.profile")} description={t("profile.staffMenuDescription")} onPress={() => router.push("/profile")} />
  </AppScreen>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><AppText variant="h3">{value}</AppText><AppText variant="caption" tone="muted">{label}</AppText></View>;
}

function MenuItem({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return <View style={styles.menuItem}><View style={styles.menuContent}><AppText variant="h5">{title}</AppText><AppText variant="bodySmall" tone="muted">{description}</AppText></View><Button variant="secondary" onPress={onPress}>›</Button></View>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 140, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  menuContent: { flex: 1, gap: spacing.xs },
});
