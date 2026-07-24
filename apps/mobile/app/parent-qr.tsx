import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useAttendanceQr } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";

function ChildQr({ childId, name }: { childId: string; name: string }) {
  const qr = useAttendanceQr(childId);
  const { t, formatTime } = useI18n();
  if (qr.isLoading) return <AppText>{t("qr.preparing", { name })}</AppText>;
  if (qr.isError || !qr.data) return <AppText tone="danger">{t("qr.failed")}</AppText>;
  const payload = JSON.stringify({ version: 1, child: { id: childId, name }, token: qr.data.token });
  return <View style={styles.card}><AppText variant="heading">{name}</AppText><AppText variant="caption" tone="muted">{t("qr.childId", { id: childId })}</AppText><QRCode value={payload} size={220} /><AppText tone="muted">{t("qr.validUntil", { time: formatTime(qr.data.expiresAt) })}</AppText></View>;
}

export default function ParentQrScreen() {
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const children = useChildren();
  const { t } = useI18n();
  const visibleChildren = typeof childId === "string" ? children.data?.filter((child) => child.id === childId) : children.data;
  return <AppScreen>
    <AppText variant="title">{t("qr.title")}</AppText>
    {visibleChildren?.map((child) => <ChildQr key={child.id} childId={child.id} name={child.fullName} />)}
    {!children.isLoading && visibleChildren?.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
  </AppScreen>;
}
const styles = StyleSheet.create({ card: { alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface } });
