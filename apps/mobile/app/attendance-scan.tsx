import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { AppText, Button, Screen } from "@daycare/ui";
import { useRecordAttendance } from "@/attendance/useAttendance";

type QrPayload = { childId: string; token: string };

export default function AttendanceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const record = useRecordAttendance();
  const onScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    try {
      setScanned(true);
      const payload = JSON.parse(data) as QrPayload;
      await record.mutateAsync({ childId: payload.childId, action: "CHECK_IN", method: "QR", qrToken: payload.token });
      Alert.alert("Berhasil", "Check-in QR tercatat.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (error) {
      setScanned(false);
      Alert.alert("QR tidak valid", error instanceof Error ? error.message : "Coba pindai ulang.");
    }
  };
  if (!permission) return <Screen><AppText>Memeriksa izin kamera...</AppText></Screen>;
  if (!permission.granted) return <Screen><AppText>Kamera diperlukan untuk memindai QR.</AppText><Button onPress={() => void requestPermission()}>Izinkan kamera</Button></Screen>;
  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}><AppText variant="title">Pindai QR</AppText><View style={styles.camera}><CameraView style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} /></View></Screen>;
}
const styles = StyleSheet.create({ camera: { height: 420, overflow: "hidden", borderRadius: 16 } });
