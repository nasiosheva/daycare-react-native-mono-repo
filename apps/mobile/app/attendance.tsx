import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import { useChildren, useRecordAttendance } from "@/attendance/useAttendance";
import { strings } from "@/i18n/strings";

export default function AttendanceScreen() {
  const children = useChildren();
  const record = useRecordAttendance();
  const submit = async (childId: string, action: "CHECK_IN" | "CHECK_OUT") => {
    try { await record.mutateAsync({ childId, action, method: "MANUAL" }); Alert.alert("Berhasil", `${action === "CHECK_IN" ? "Check-in" : "Check-out"} tercatat.`); }
    catch (error) { Alert.alert("Tidak dapat menyimpan", error instanceof Error ? error.message : "Silakan coba lagi."); }
  };
  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}>
    <AppText variant="title">{strings.attendance}</AppText>
    <Button variant="secondary" onPress={() => router.push("/attendance-scan")}>Pindai QR orang tua</Button>
    {children.isLoading && <AppText>Memuat anak...</AppText>}
    {children.isError && <Button onPress={() => children.refetch()}>{strings.retry}</Button>}
    {children.data?.map((child) => <View key={child.id} style={styles.card}>
      <AppText variant="heading">{child.fullName}</AppText>
      <View style={styles.actions}><Button loading={record.isPending} onPress={() => void submit(child.id, "CHECK_IN")}>{strings.checkIn}</Button><Button variant="secondary" loading={record.isPending} onPress={() => void submit(child.id, "CHECK_OUT")}>{strings.checkOut}</Button></View>
    </View>)}
  </Screen>;
}
const styles = StyleSheet.create({ card: { padding: spacing.md, backgroundColor: "#FFF", borderRadius: 12, gap: spacing.md }, actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" } });
