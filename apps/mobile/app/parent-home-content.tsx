// Mories Deo Hutapea,S.E.,S.Kom
import { useRouter } from "expo-router";
import { BackButton } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { ParentHomeContentHub } from "@/home/ParentHomeContentHub";

export default function ParentHomeContentScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManageBanners = Boolean(profile?.isPlatformAdmin);
  const canManageAnnouncements = membership?.active === true && membership.role === "STAFF_ADMIN";
  const canManage = canManageBanners || canManageAnnouncements;

  if (!profile) return null;
  if (!canManage) return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("platformBanners.contentHub")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <ParentHomeContentHub
      canManageBanners={canManageBanners}
      canManageAnnouncements={canManageAnnouncements}
      onCreateBanner={() => router.push("/platform-banners?create=1" as never)}
      onManageBanners={() => router.push("/platform-banners" as never)}
      onCreateAnnouncement={() => router.push("/tenant-announcements?create=1" as never)}
      onManageAnnouncements={() => router.push("/tenant-announcements" as never)}
    />
  </AppScreen>;
}
