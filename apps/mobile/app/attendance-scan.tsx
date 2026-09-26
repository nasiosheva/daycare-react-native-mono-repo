import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BackButton, Button, EmptyState, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { LegacyDaycareRouteGuard } from "@/navigation/LegacyDaycareRouteGuard";
import { legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";
import { useRecordAttendance } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";

type QrPayload = { child: { id: string; name: string }; token: string };

export default function AttendanceScanScreen() {
  return <LegacyDaycareRouteGuard policy={legacyDaycareRoutePolicies.attendanceScan}><AttendanceScanScreenContent /></LegacyDaycareRouteGuard>;
}

function AttendanceScanScreenContent() {
  const router = useRouter();
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
  if (!permission) return <AppScreen {...screenProps}><EmptyState icon="camera-outline" title={t("attendance.cameraChecking")} /></AppScreen>;
  if (!permission.granted) return <AppScreen {...screenProps}><EmptyState icon="camera-outline" title={t("attendance.cameraRequired")} action={{ label: t("attendance.allowCamera"), onPress: () => void requestPermission() }} /></AppScreen>;
  return <AppScreen {...screenProps}>
    <AppText tone="muted" style={styles.center}>{t("attendance.scanInstruction")}</AppText>
    <View style={styles.camera}>
      <CameraView style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} />
      <View pointerEvents="none" style={styles.overlay}><View style={styles.frame} /></View>
      {scanned && <View style={styles.status}><Ionicons name="hourglass-outline" size={18} color={colors.onPrimary} /><AppText variant="label" style={styles.statusText}>{t("attendance.scanProcessing")}</AppText></View>}
    </View>
    <Button variant="secondary" leadingIcon={<Ionicons name="list-outline" size={18} color={colors.primary} />} onPress={() => router.back()}>{t("attendance.manualInstead")}</Button>
  </AppScreen>;
}
const styles = StyleSheet.create({
  center: { textAlign: "center" },
  camera: { height: 420, overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.text },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: 240, height: 240, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.onPrimary },
  status: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
  statusText: { color: colors.onPrimary },
});
