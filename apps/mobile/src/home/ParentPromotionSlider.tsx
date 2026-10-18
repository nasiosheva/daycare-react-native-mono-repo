// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { PlatformBanner } from "@daycare/api-client";
import { parentActionRoute } from "@/announcements/actionDestination";
import { isValidHttpsUrl } from "@/media/imageUrl";
import { notify } from "@/notify/notify";
import { FallbackImage } from "@/media/FallbackImage";

export function ParentPromotionSlider({ banners, organizationId, interactive = true }: { banners: readonly PlatformBanner[]; organizationId?: string | null; interactive?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  if (banners.length === 0) return null;

  const cardWidth = Math.max(0, Math.min(windowWidth - spacing.md * 2, 1080 - spacing.md * 2));
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const interval = cardWidth + spacing.sm;
    if (interval > 0) setActiveIndex(Math.min(banners.length - 1, Math.round(event.nativeEvent.contentOffset.x / interval)));
  };
  const openBannerAction = async (banner: PlatformBanner) => {
    const actionType = banner.actionType ?? "NONE";
    const target = banner.actionTarget;
    if (actionType === "OPEN_BROWSER" && target && isValidHttpsUrl(target)) {
      try {
        await Linking.openURL(target);
      } catch (error) {
        notify(t("operations.actionOpenFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger");
      }
      return;
    }
    const appRoute = actionType === "OPEN_APP_PAGE" ? parentActionRoute(target) : null;
    if (!appRoute || (appRoute.tenantScoped && !organizationId)) return;
    router.push((appRoute.tenantScoped ? { pathname: appRoute.pathname, params: { organizationId } } : appRoute.pathname) as never);
  };

  return <View style={styles.section}>
    <AppText variant="heading">{t("platformBanners.parentTitle")}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + spacing.sm} decelerationRate="fast" onMomentumScrollEnd={onMomentumScrollEnd} contentContainerStyle={styles.slides} accessibilityLabel={t("platformBanners.parentTitle")}>
      {banners.map((banner) => {
        const appRoute = banner.actionType === "OPEN_APP_PAGE" ? parentActionRoute(banner.actionTarget) : null;
        const actionable = interactive && (banner.actionType === "OPEN_BROWSER"
          ? Boolean(banner.actionTarget && isValidHttpsUrl(banner.actionTarget))
          : Boolean(appRoute && (!appRoute.tenantScoped || organizationId)));
        const cardStyle = [styles.card, { width: cardWidth }];
        const content = <><FallbackImage key={`${banner.id}:${banner.imageUrl}`} accessibilityLabel={banner.title} fallbackLabel={t("operations.imageUnavailable")} uri={banner.imageUrl} style={styles.image} /><View style={styles.caption}>
          <AppText variant="h5" numberOfLines={1}>{banner.title}</AppText>
          <AppText numberOfLines={2}>{banner.body}</AppText>
        </View></>;
        return actionable
          ? <Pressable key={banner.id} accessibilityRole="button" accessibilityLabel={`${banner.title}. ${t("operations.openAction")}`} onPress={() => void openBannerAction(banner)} style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}>{content}</Pressable>
          : <View key={banner.id} style={cardStyle}>{content}</View>;
      })}
    </ScrollView>
    {banners.length > 1 && <View style={styles.indicators} accessibilityLabel={`${t("platformBanners.parentTitle")} ${activeIndex + 1}/${banners.length}`} accessibilityLiveRegion="polite">
      {banners.map((banner, index) => <View key={banner.id} style={[styles.indicator, index === activeIndex && styles.indicatorActive]} />)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  slides: { gap: spacing.sm },
  card: { overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceTint },
  caption: { gap: spacing.xs, padding: spacing.md },
  pressed: { opacity: 0.8 },
  indicators: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: spacing.xs },
  indicator: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.border },
  indicatorActive: { width: 18, backgroundColor: colors.primary },
});
