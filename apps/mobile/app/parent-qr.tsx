import { useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, BottomSheet, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useAttendanceQr } from "@/attendance/useAttendance";
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
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const children = useChildren();
  const { t } = useI18n();
  const visibleChildren = typeof childId === "string" ? children.data?.filter((child) => child.id === childId) : children.data;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(typeof childId === "string" ? childId : null);
  const selectedChild = visibleChildren?.find((child) => child.id === selectedChildId) ?? null;
  return <AppScreen>
    <AppText variant="title">{t("qr.title")}</AppText>
    {visibleChildren?.map((child) => <NavigationCard key={child.id} accessibilityLabel={t("qr.showQr", { name: child.fullName })} onPress={() => setSelectedChildId(child.id)}>
      <AppText variant="h5">{child.fullName}</AppText>
    </NavigationCard>)}
    {!children.isLoading && visibleChildren?.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
    <BottomSheet visible={Boolean(selectedChild)} onClose={() => setSelectedChildId(null)} closeAccessibilityLabel={t("common.close")} title={selectedChild?.fullName ?? t("qr.title")}>
      {selectedChild && <ChildQr childId={selectedChild.id} name={selectedChild.fullName} />}
    </BottomSheet>
  </AppScreen>;
}
const styles = StyleSheet.create({ card: { alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface } });
