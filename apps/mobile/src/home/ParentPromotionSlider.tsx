// Mories Deo Hutapea,S.E.,S.Kom
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { PlatformBanner } from "@daycare/api-client";
import { platformBannerActionRoute } from "@/announcements/actionDestination";
import { isValidHttpsUrl } from "@/media/imageUrl";
import { FallbackImage } from "@/media/FallbackImage";
import { useAutoAdvanceCarousel } from "./useAutoAdvanceCarousel";

const SLIDE_WIDTH_RATIO = 0.88;
const PROMOTION_IMAGE_ASPECT_RATIO = 2.4;

export function ParentPromotionSlider({ banners, organizationId, interactive = true, sectionTitle }: { banners: readonly PlatformBanner[]; organizationId?: string | null; interactive?: boolean; sectionTitle?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const { activeIndex, setActiveIndex, pauseAutoAdvance, resumeAutoAdvance } = useAutoAdvanceCarousel(banners.length);
  const availableWidth = carouselWidth || Math.max(0, Math.min(windowWidth - spacing.md * 2, 1080 - spacing.md * 2));
  const cardWidth = availableWidth * SLIDE_WIDTH_RATIO;
  useEffect(() => {
    if (banners.length > 1) scrollRef.current?.scrollTo({ x: activeIndex * (cardWidth + spacing.sm), animated: true });
  }, [activeIndex, banners.length, cardWidth]);
  if (banners.length === 0) return null;
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const interval = cardWidth + spacing.sm;
    if (interval > 0) setActiveIndex(Math.min(banners.length - 1, Math.round(event.nativeEvent.contentOffset.x / interval)));
    resumeAutoAdvance();
  };
  const openBannerAction = (banner: PlatformBanner) => {
    const actionType = banner.actionType ?? "NONE";
    const target = banner.actionTarget;
    if (actionType === "OPEN_BROWSER" && target && isValidHttpsUrl(target)) {
      router.push({ pathname: "/in-app-browser", params: { url: target } } as never);
      return;
    }
    const appRoute = actionType === "OPEN_APP_PAGE" ? platformBannerActionRoute(banner.audience, target) : null;
    if (!appRoute || (appRoute.tenantScoped && !organizationId)) return;
    router.push((appRoute.tenantScoped ? { pathname: appRoute.pathname, params: { organizationId } } : appRoute.pathname) as never);
  };

  return <View style={styles.section}>
    <AppText variant="heading">{sectionTitle ?? t("platformBanners.parentTitle")}</AppText>
    <View style={styles.carouselFrame}>
      <ScrollView ref={scrollRef} style={styles.carousel} onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)} horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + spacing.sm} decelerationRate="fast" onScrollBeginDrag={pauseAutoAdvance} onScrollEndDrag={onMomentumScrollEnd} onMomentumScrollEnd={onMomentumScrollEnd} contentContainerStyle={styles.slides} accessibilityLabel={sectionTitle ?? t("platformBanners.parentTitle")}>
        {banners.map((banner) => {
          const appRoute = banner.actionType === "OPEN_APP_PAGE" ? platformBannerActionRoute(banner.audience, banner.actionTarget) : null;
          const actionable = interactive && (banner.actionType === "OPEN_BROWSER"
            ? Boolean(banner.actionTarget && isValidHttpsUrl(banner.actionTarget))
            : Boolean(appRoute && (!appRoute.tenantScoped || organizationId)));
          const cardStyle = [styles.card, { width: cardWidth }];
          const content = <FallbackImage key={`${banner.id}:${banner.imageUrl}`} accessibilityLabel={banner.title} fallbackLabel={t("operations.imageUnavailable")} uri={banner.imageUrl} style={styles.image} resizeMode="cover" />;
          return actionable
            ? <Pressable key={banner.id} accessibilityRole="button" accessibilityLabel={banner.title} onPress={() => void openBannerAction(banner)} style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}>{content}</Pressable>
            : <View key={banner.id} style={cardStyle}>{content}</View>;
        })}
      </ScrollView>
      {banners.length > 1 && <View pointerEvents="none" style={styles.indicators} accessibilityLabel={`${sectionTitle ?? t("platformBanners.parentTitle")} ${activeIndex + 1}/${banners.length}`} accessibilityLiveRegion="polite">
        {banners.map((banner, index) => <View key={banner.id} accessible accessibilityRole="text" accessibilityLabel={`${index === activeIndex ? "●" : "○"} ${index + 1}/${banners.length}`} style={[styles.indicator, index === activeIndex && styles.indicatorActive]} />)}
      </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  carouselFrame: { position: "relative" },
  carousel: { width: "100%", flexGrow: 0, flexShrink: 1 },
  slides: { gap: spacing.sm },
  card: { overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  image: { width: "100%", aspectRatio: PROMOTION_IMAGE_ASPECT_RATIO, backgroundColor: colors.surfaceTint },
  pressed: { opacity: 0.8 },
  indicators: { position: "absolute", bottom: spacing.sm, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: "rgba(0, 0, 0, 0.45)", zIndex: 1 },
  indicator: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.65)" },
  indicatorActive: { width: 18, backgroundColor: colors.surface },
});
