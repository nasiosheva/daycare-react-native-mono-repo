
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, MenuItem, MenuSection } from "@daycare/ui";
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
    <MenuSection title={t("platformCatalog.title")}>
      <MenuItem icon="library-outline" title={t("globalCurriculum.menu")} description={t("globalCurriculum.subtitle")} onPress={() => router.push("/global-curriculum")} />
      <MenuItem icon="flag-outline" title={t("globalDevelopmentPrograms.menu")} description={t("globalDevelopmentPrograms.subtitle")} onPress={() => router.push("/global-development-programs")} />
      <MenuItem icon="pricetags-outline" title={t("development.globalCategories")} description={t("development.globalCategoriesSubtitle")} onPress={() => router.push("/global-development-categories")} />
      <MenuItem icon="layers-outline" title={t("globalLearningLevels.menu")} description={t("globalLearningLevels.subtitle")} onPress={() => router.push("/global-learning-levels")} />
      <MenuItem icon="analytics-outline" title={t("screening.title")} description={t("screening.description")} onPress={() => router.push("/screening-catalog" as never)} />
    </MenuSection>
  </AppScreen>;
}


