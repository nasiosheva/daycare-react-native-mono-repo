import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, BottomSheet, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";
import { useAttendanceQr, useParentChildrenAcrossTenants, type ChildWithTenant } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

function ChildQr({ childId, name }: { childId: string; name: string }) {
  const qr = useAttendanceQr(childId);
  const { t, formatTime } = useI18n();
  if (qr.isLoading) return <AppText>{t("qr.preparing", { name })}</AppText>;
  if (qr.isError || !qr.data) return <AppText tone="danger">{t("qr.failed")}</AppText>;
  const payload = JSON.stringify({ version: 1, child: { id: childId, name }, token: qr.data.token });
  return <View style={styles.card}><AppText variant="caption" tone="muted">{t("qr.childId", { id: childId })}</AppText><QRCode value={payload} size={220} /><AppText tone="muted">{t("qr.validUntil", { time: formatTime(qr.data.expiresAt) })}</AppText></View>;
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
  const visibleChildren = typeof childId === "string" ? children.data.filter((child) => child.id === childId) : children.data;
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
    {children.isFetching && <ShimmerList variant="tile" />}
    {!children.isFetching && onlyChild && <View style={styles.single}><AppText variant="h5">{onlyChild.fullName}</AppText>{onlyChild.organizationId === organizationId && <ChildQr childId={onlyChild.id} name={onlyChild.fullName} />}</View>}
    {!children.isFetching && !onlyChild && visibleChildren.map((child) => <NavigationCard key={child.id} accessibilityLabel={t("qr.showQr", { name: child.fullName })} onPress={() => openChild(child)}>
      <AppText variant="h5">{child.fullName}</AppText>
      {showsTenantLabel && <AppText variant="caption" tone="muted">{child.organizationName}</AppText>}
    </NavigationCard>)}
    {!children.isFetching && visibleChildren.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
    {!onlyChild && <BottomSheet visible={Boolean(selectedChild)} onClose={() => setSelectedChildId(null)} closeAccessibilityLabel={t("common.close")} title={selectedChild?.fullName ?? t("qr.title")}>
      {selectedChild && selectedChild.organizationId === organizationId && <ChildQr childId={selectedChild.id} name={selectedChild.fullName} />}
    </BottomSheet>}
  </AppScreen>;
}
const styles = StyleSheet.create({ card: { alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, single: { gap: spacing.sm } });
