import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, BottomSheet, EmptyState, ErrorState, MenuItem, Shimmer, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";
import { useAttendanceQr, useParentChildrenAcrossTenants, type ChildWithTenant } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

function ChildQr({ childId, name }: { childId: string; name: string }) {
  const qr = useAttendanceQr(childId);
  const { t, formatTime } = useI18n();
  if (qr.isLoading) return <View style={styles.card}><Shimmer width={220} height={220} /><AppText tone="muted">{t("qr.preparing", { name })}</AppText></View>;
  if (qr.isError || !qr.data) return <ErrorState compact title={t("qr.failed")} retryLabel={t("common.retry")} onRetry={() => void qr.refetch()} />;
  const payload = JSON.stringify({ version: 1, child: { id: childId, name }, token: qr.data.token });
  return <View style={styles.card}><AppText tone="muted" style={styles.center}>{t("qr.instruction")}</AppText><View style={styles.qrFrame}><QRCode value={payload} size={220} /></View><AppText variant="label">{t("qr.validUntil", { time: formatTime(qr.data.expiresAt) })}</AppText><AppText variant="caption" tone="muted">{t("qr.childId", { id: childId })}</AppText></View>;
}

export default function ParentQrScreen() {
  return <LegacyDaycareRouteGuard policy={legacyDaycareRoutePolicies.parentQr}><ParentQrScreenContent /></LegacyDaycareRouteGuard>;
}

function ParentQrScreenContent() {
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const { profile, organizationId, selectOrganization } = useAuth();
  const parentMemberships = (profile?.memberships ?? []).filter((membership) => membership.role === "PARENT" && membership.active);
  const showsTenantLabel = parentMemberships.length > 1;
  const children = useParentChildrenAcrossTenants(parentMemberships, true);
  const { t } = useI18n();
  // Issuing an attendance QR still requires an operational tenant subscription (unlike the child
  // list itself, see docs/business-rules.md §13.12), so a restricted tenant's child has nothing
  // to do here.
  const availableChildren = children.data.filter((child) => !child.tenantSubscriptionRestricted);
  const visibleChildren = typeof childId === "string" ? availableChildren.filter((child) => child.id === childId) : availableChildren;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(typeof childId === "string" ? childId : null);
  const selectedChild = visibleChildren.find((child) => child.id === selectedChildId) ?? null;
  const onlyChild = visibleChildren.length === 1 ? visibleChildren[0] : null;
  // Attendance QR issuance is scoped to the currently active tenant, so a child from another
  // tenant needs that tenant made active before its QR can be requested.
  useEffect(() => {
    if (onlyChild && onlyChild.organizationId !== organizationId) selectOrganization(onlyChild.organizationId);
  }, [onlyChild, organizationId, selectOrganization]);
  const openChild = (child: ChildWithTenant) => {
    selectOrganization(child.organizationId);
    setSelectedChildId(child.id);
  };
  return <AppScreen>
    <AppText variant="title">{t("qr.title")}</AppText>
    {!onlyChild && visibleChildren.length > 0 && <AppText tone="muted">{t("qr.chooseChild")}</AppText>}
    {children.isFetching && <ShimmerList variant="tile" />}
    {!children.isFetching && onlyChild && <View style={styles.single}><AppText variant="h5">{onlyChild.fullName}</AppText>{onlyChild.organizationId === organizationId && <ChildQr childId={onlyChild.id} name={onlyChild.fullName} />}</View>}
    {!children.isFetching && !onlyChild && visibleChildren.map((child) => <MenuItem key={child.id} icon="qr-code-outline" title={child.fullName} description={showsTenantLabel ? child.organizationName : t("qr.showQr", { name: child.fullName })} onPress={() => openChild(child)} />)}
    {!children.isFetching && visibleChildren.length === 0 && <EmptyState icon="happy-outline" title={t("children.empty")} />}
    {!onlyChild && <BottomSheet visible={Boolean(selectedChild)} onClose={() => setSelectedChildId(null)} closeAccessibilityLabel={t("common.close")} title={selectedChild?.fullName ?? t("qr.title")}>
      {selectedChild && selectedChild.organizationId === organizationId && <ChildQr childId={selectedChild.id} name={selectedChild.fullName} />}
    </BottomSheet>}
  </AppScreen>;
}
const styles = StyleSheet.create({
  card: { alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  qrFrame: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.onPrimary },
  center: { textAlign: "center" },
  single: { gap: spacing.sm },
});
