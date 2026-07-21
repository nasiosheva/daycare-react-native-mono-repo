import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { AppText, Button, Screen } from "@daycare/ui";
import { useChildren, useAttendanceQr } from "@/attendance/useAttendance";

function ChildQr({ childId, name }: { childId: string; name: string }) {
  const qr = useAttendanceQr(childId);
  if (qr.isLoading) return <AppText>Menyiapkan QR untuk {name}...</AppText>;
  if (qr.isError || !qr.data) return <AppText tone="danger">QR tidak dapat dibuat.</AppText>;
  return <><AppText variant="heading">{name}</AppText><QRCode value={JSON.stringify({ childId, token: qr.data.token })} size={220} /><AppText tone="muted">Berlaku hingga {new Date(qr.data.expiresAt).toLocaleTimeString("id-ID")}</AppText></>;
}

export default function ParentQrScreen() {
  const children = useChildren();
  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}>
    <AppText variant="title">QR kehadiran</AppText>
    {children.data?.map((child) => <ChildQr key={child.id} childId={child.id} name={child.fullName} />)}
  </Screen>;
}
