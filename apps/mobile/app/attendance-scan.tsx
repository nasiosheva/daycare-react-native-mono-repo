import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { AppText, BackButton, Button } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useRecordAttendance } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";

type QrPayload = { child: { id: string; name: string }; token: string };

export default function AttendanceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const record = useRecordAttendance();
  const { t } = useI18n();
  const onScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    try {
      setScanned(true);
      const payload = JSON.parse(data) as QrPayload;
      if (!payload.child?.id || !payload.child.name || !payload.token) throw new Error(t("attendance.invalidQr"));
      await record.mutateAsync({ childId: payload.child.id, action: "CHECK_IN", method: "QR", qrToken: payload.token });
      Alert.alert(t("attendance.success"), t("attendance.qrRecorded"), [{ text: t("common.ok"), onPress: () => router.back() }]);
    } catch (error) {
      setScanned(false);
      Alert.alert(t("attendance.invalidQr"), error instanceof Error ? error.message : t("attendance.rescan"));
    }
  };
  const screenProps = { showBottomNavigation: false, title: t("attendance.scanTitle"), header: <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} /> };
  if (!permission) return <AppScreen {...screenProps}><AppText>{t("attendance.cameraChecking")}</AppText></AppScreen>;
  if (!permission.granted) return <AppScreen {...screenProps}><AppText>{t("attendance.cameraRequired")}</AppText><Button onPress={() => void requestPermission()}>{t("attendance.allowCamera")}</Button></AppScreen>;
  return <AppScreen {...screenProps}><View style={styles.camera}><CameraView style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} /></View></AppScreen>;
}
const styles = StyleSheet.create({ camera: { height: 420, overflow: "hidden", borderRadius: 16 } });
