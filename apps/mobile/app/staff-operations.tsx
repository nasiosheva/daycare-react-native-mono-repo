import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { StyleSheet, View } from "react-native";
import { AppText, NavigationCard, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function StaffOperationsScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);

  if (!profile) return null;
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
      <MenuItem
        title={t("absence.menu")}
        description={t("absence.menuDescription")}
        onPress={() => router.push("/absence-requests")}
      />
    </View>
  </AppScreen>;
}

function MenuItem({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return <NavigationCard accessibilityLabel={title} onPress={onPress}>
    <View style={styles.menuContent}>
      <AppText variant="h5">{title}</AppText>
      <AppText variant="bodySmall" tone="muted">{description}</AppText>
    </View>
  </NavigationCard>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  menuContent: { flex: 1, gap: spacing.xs },
});
