import { router } from "expo-router";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";

export default function ChildrenScreen() {
  const children = useChildren();
  const { t } = useI18n();
  const { profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN";
  return <AppScreen>
    <AppText variant="title">{t("children.title")}</AppText>
    {canManage && <Button onPress={() => router.push("/child-detail")}>{t("children.add")}</Button>}
    {children.data?.map((child) => <View key={child.id} style={styles.card}><AppText variant="h5">{child.fullName}</AppText><AppText tone="muted">{child.dateOfBirth}</AppText>{canManage && <Button variant="secondary" onPress={() => router.push({ pathname: "/child-detail", params: { childId: child.id } })}>{t("children.edit")}</Button>}</View>)}
    {!children.isLoading && children.data?.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } });
