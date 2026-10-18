// Mories Deo Hutapea,S.E.,S.Kom
import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";

type Props = {
  canManageBanners: boolean;
  canManageAnnouncements: boolean;
  onCreateBanner: () => void;
  onManageBanners: () => void;
  onCreateAnnouncement: () => void;
  onManageAnnouncements: () => void;
};

export function ParentHomeContentHub({ canManageBanners, canManageAnnouncements, onCreateBanner, onManageBanners, onCreateAnnouncement, onManageAnnouncements }: Props) {
  const { t } = useI18n();

  return <View style={styles.content}>
    <AppText tone="muted">{t("platformBanners.contentHubDescription")}</AppText>
    {canManageBanners && <Card icon="images-outline" title={t("platformBanners.bannerSection")}>
      <AppText tone="muted">{t("platformBanners.description")}</AppText>
      <View style={styles.actions}>
        <Button style={styles.action} onPress={onCreateBanner}>{t("platformBanners.create")}</Button>
        <Button style={styles.action} variant="secondary" onPress={onManageBanners}>{t("platformBanners.manage")}</Button>
      </View>
    </Card>}
    {canManageAnnouncements && <Card icon="megaphone-outline" title={t("platformBanners.popupSection")}>
      <AppText tone="muted">{t("operations.announcementsDescription")}</AppText>
      <View style={styles.actions}>
        <Button style={styles.action} onPress={onCreateAnnouncement}>{t("operations.addAnnouncement")}</Button>
        <Button style={styles.action} variant="secondary" onPress={onManageAnnouncements}>{t("operations.manageAnnouncements")}</Button>
      </View>
    </Card>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: "40%" },
});
