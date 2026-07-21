import { Redirect, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function StaffOperationsScreen() {
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);

  if (membership?.role !== "STAFF") return <Redirect href="/home" />;

  return <AppScreen>
    <AppText variant="title">{t("staffOperations.title")}</AppText>
    <AppText tone="muted">{t("staffOperations.subtitle")}</AppText>
    <View style={styles.content}>
      <MenuItem
        title={t("attendance.title")}
        description={t("staffOperations.attendanceDescription")}
        onPress={() => router.push("/attendance")}
      />
      <MenuItem
        title={t("children.title")}
        description={t("staffOperations.childrenDescription")}
        onPress={() => router.push("/children")}
      />
      <MenuItem
        title={t("development.title")}
        description={t("staffOperations.developmentDescription")}
        onPress={() => router.push("/development")}
      />
    </View>
  </AppScreen>;
}

function MenuItem({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return <View style={styles.menuItem}>
    <View style={styles.menuContent}>
      <AppText variant="h5">{title}</AppText>
      <AppText variant="bodySmall" tone="muted">{description}</AppText>
    </View>
    <Button variant="secondary" onPress={onPress}>›</Button>
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  menuContent: { flex: 1, gap: spacing.xs },
});
