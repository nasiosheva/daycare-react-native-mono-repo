import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren, useRecordAttendance } from "@/attendance/useAttendance";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function AttendanceScreen() {
  const children = useChildren();
  const record = useRecordAttendance();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const readOnly = profile?.memberships.find((item) => item.organizationId === organizationId)?.active === false;
  const submit = async (childId: string, action: "CHECK_IN" | "CHECK_OUT") => {
    try { const actionLabel = action === "CHECK_IN" ? t("attendance.checkIn") : t("attendance.checkOut"); await record.mutateAsync({ childId, action, method: "MANUAL" }); Alert.alert(t("attendance.success"), t("attendance.recorded", { action: actionLabel })); }
    catch (error) { Alert.alert(t("attendance.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen>
    <AppText variant="title">{t("attendance.title")}</AppText>
    {readOnly && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {!readOnly && <Button variant="secondary" onPress={() => router.push("/attendance-scan")}>{t("attendance.scan")}</Button>}
    {children.isLoading && <AppText>{t("attendance.loading")}</AppText>}
    {children.isError && <Button onPress={() => children.refetch()}>{t("common.retry")}</Button>}
    {children.data?.map((child) => <View key={child.id} style={styles.card}>
      <AppText variant="heading">{child.fullName}</AppText>
      {!readOnly && <View style={styles.actions}><Button loading={record.isPending} onPress={() => void submit(child.id, "CHECK_IN")}>{t("attendance.checkIn")}</Button><Button variant="secondary" loading={record.isPending} onPress={() => void submit(child.id, "CHECK_OUT")}>{t("attendance.checkOut")}</Button></View>}
    </View>)}
  </AppScreen>;
}
const styles = StyleSheet.create({ card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.md, borderWidth: 1, borderColor: colors.border }, actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" } });
