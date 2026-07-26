import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function PlatformCatalogScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useI18n();

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  return <AppScreen>
    <AppText variant="title">{t("platformCatalog.title")}</AppText>
    <AppText tone="muted">{t("platformCatalog.subtitle")}</AppText>
    <View style={styles.actionsGrid}>
      <ActionCard title={t("globalCurriculum.menu")} description={t("globalCurriculum.subtitle")} onPress={() => router.push("/global-curriculum")} />
      <ActionCard title={t("globalDevelopmentPrograms.menu")} description={t("globalDevelopmentPrograms.subtitle")} onPress={() => router.push("/global-development-programs")} />
      <ActionCard title={t("development.globalCategories")} description={t("development.globalCategoriesSubtitle")} onPress={() => router.push("/global-development-categories")} />
    </View>
  </AppScreen>;
}

function ActionCard({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}>
    <AppText variant="label">{title}</AppText>
    <AppText variant="caption" tone="muted">{description}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionCard: { flexBasis: "47%", flexGrow: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionCardPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
});
