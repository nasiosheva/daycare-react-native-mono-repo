import QRCode from "react-native-qrcode-svg";
import { AppText } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useAttendanceQr } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";

function ChildQr({ childId, name }: { childId: string; name: string }) {
  const qr = useAttendanceQr(childId);
  const { t, formatTime } = useI18n();
  if (qr.isLoading) return <AppText>{t("qr.preparing", { name })}</AppText>;
  if (qr.isError || !qr.data) return <AppText tone="danger">{t("qr.failed")}</AppText>;
  return <><AppText variant="heading">{name}</AppText><QRCode value={JSON.stringify({ childId, token: qr.data.token })} size={220} /><AppText tone="muted">{t("qr.validUntil", { time: formatTime(qr.data.expiresAt) })}</AppText></>;
}

export default function ParentQrScreen() {
  const children = useChildren();
  const { t } = useI18n();
  return <AppScreen>
    <AppText variant="title">{t("qr.title")}</AppText>
    {children.data?.map((child) => <ChildQr key={child.id} childId={child.id} name={child.fullName} />)}
  </AppScreen>;
}
