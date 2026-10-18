// Mories Deo Hutapea,S.E.,S.Kom
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { ParentAnnouncementSlide } from "@/home/parentHomeSummary";
import { parentActionRoute } from "@/announcements/actionDestination";
import { downloadAnnouncementImage, shareAnnouncementImage } from "@/announcements/downloadAnnouncementImage";
import { isValidHttpsImageUrl, isValidHttpsUrl } from "@/media/imageUrl";
import { notify } from "@/notify/notify";
import { FallbackImage } from "@/media/FallbackImage";
import { useAutoAdvanceCarousel } from "./useAutoAdvanceCarousel";

export function ParentAnnouncementPopup({ announcements, onAcknowledge }: { announcements: readonly ParentAnnouncementSlide[]; onAcknowledge: (slide: ParentAnnouncementSlide) => void | Promise<unknown> }) {
  const router = useRouter();
  const { t } = useI18n();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [acknowledging, setAcknowledging] = useState(false);
  const [busyAction, setBusyAction] = useState<"download" | "share" | null>(null);
  const imageSlides = useMemo(() => announcements.filter(({ announcement }) => Boolean(announcement.imageUrl && isValidHttpsImageUrl(announcement.imageUrl))), [announcements]);
  const visibleSlides = useMemo(() => imageSlides.filter(({ announcement, organizationId }) => !dismissedIds.has(`${organizationId}:${announcement.id}`)), [imageSlides, dismissedIds]);
  const { activeIndex, setActiveIndex, pauseAutoAdvance, resumeAutoAdvance } = useAutoAdvanceCarousel(visibleSlides.length);
  const slideSignature = announcements.map(({ announcement, organizationId }) => `${organizationId}:${announcement.id}`).join("|");
  const activeSlide = visibleSlides[Math.min(activeIndex, Math.max(0, visibleSlides.length - 1))];
  const cardWidth = Math.min(windowWidth - spacing.md * 2, 560);
  const dismiss = () => {
    setDismissedIds((current) => new Set([...current, ...visibleSlides.map(({ announcement, organizationId }) => `${organizationId}:${announcement.id}`)]));
    setActiveIndex(0);
  };
  const dismissActive = () => {
    if (!activeSlide) return;
    setDismissedIds((current) => new Set(current).add(`${activeSlide.organizationId}:${activeSlide.announcement.id}`));
    setActiveIndex(0);
  };
  const openAction = (slide: ParentAnnouncementSlide) => {
    const actionType = slide.announcement.actionType ?? "NONE";
    const actionTarget = slide.announcement.actionTarget;
    const appRoute = actionType === "OPEN_APP_PAGE" ? parentActionRoute(actionTarget) : null;
    const hasAction = actionType === "OPEN_BROWSER" ? Boolean(actionTarget && isValidHttpsUrl(actionTarget)) : Boolean(appRoute);
    if (!hasAction) return;
    if (actionType === "OPEN_BROWSER" && actionTarget) {
      dismiss();
      router.push({ pathname: "/in-app-browser", params: { url: actionTarget } } as never);
      return;
    }
    if (appRoute) {
      dismiss();
      router.push((appRoute.tenantScoped ? { pathname: appRoute.pathname, params: { organizationId: slide.organizationId } } : appRoute.pathname) as never);
    }
  };
  const acknowledgeActive = async () => {
    if (!activeSlide || acknowledging) return;
    setAcknowledging(true);
    try {
      await onAcknowledge(activeSlide);
      dismissActive();
    } catch {
      // The mutation reports the actionable error; keep the popup open for a retry.
    } finally {
      setAcknowledging(false);
    }
  };
  const downloadActiveImage = async () => {
    if (!activeSlide || busyAction) return;
    setBusyAction("download");
    try {
      await downloadAnnouncementImage(activeSlide.announcement.imageUrl!, activeSlide.announcement.title, activeSlide.announcement.id);
      notify(t("operations.imageDownloadSaved"));
    } catch (error) {
      const messageKey = error instanceof Error && error.message === "operations.imageDownloadPermissionDenied"
        ? "operations.imageDownloadPermissionDenied"
        : "operations.imageDownloadFailed";
      notify(t(messageKey), undefined, "danger");
    } finally {
      setBusyAction(null);
    }
  };
  const shareActiveImage = async () => {
    if (!activeSlide || busyAction) return;
    setBusyAction("share");
    try {
      const result = await shareAnnouncementImage(activeSlide.announcement.imageUrl!, activeSlide.announcement.title, activeSlide.announcement.id);
      if (result === "copied") notify(t("operations.imageShareLinkCopied"));
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) notify(t("operations.imageShareFailed"), undefined, "danger");
    } finally {
      setBusyAction(null);
    }
  };
  useEffect(() => setActiveIndex(0), [slideSignature, setActiveIndex]);
  useEffect(() => {
    if (visibleSlides.length > 1) scrollRef.current?.scrollTo({ x: activeIndex * cardWidth, animated: true });
  }, [activeIndex, cardWidth, visibleSlides.length]);
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth > 0) setActiveIndex(Math.max(0, Math.min(visibleSlides.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardWidth))));
    resumeAutoAdvance();
  };

  if (!activeSlide) return null;
  const { announcement } = activeSlide;
  return <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
    <View style={styles.backdrop}>
      <View style={[styles.dialog, { maxHeight: Math.min(windowHeight - spacing.xl * 2, 760) }]} accessibilityViewIsModal>
        <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScrollBeginDrag={pauseAutoAdvance} onScrollEndDrag={onMomentumScrollEnd} onMomentumScrollEnd={onMomentumScrollEnd} style={styles.slider} contentContainerStyle={styles.slides}>
          {visibleSlides.map(({ announcement: item, organizationId: tenantId, organizationName: tenantName }, index) => {
              const itemActionType = item.actionType ?? "NONE";
              const itemActionTarget = item.actionTarget;
              const itemRoute = itemActionType === "OPEN_APP_PAGE" ? parentActionRoute(itemActionTarget) : null;
              const itemHasAction = itemActionType === "OPEN_BROWSER"
                ? Boolean(itemActionTarget && isValidHttpsUrl(itemActionTarget))
                : Boolean(itemRoute);
              const image = <FallbackImage key={`${item.id}:${item.imageUrl}`} accessibilityLabel={`${tenantName}: ${item.title}`} fallbackLabel={t("operations.imageUnavailable")} uri={item.imageUrl!} resizeMode="cover" style={styles.image} />;
              return <View key={`${tenantId}:${item.id}`} testID={index === activeIndex ? "announcement-image-frame" : undefined} style={[styles.slide, { width: cardWidth }]}>
                {itemHasAction
                  ? <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => void openAction({ announcement: item, organizationId: tenantId, organizationName: tenantName })}>{image}</Pressable>
                  : image}
                {index === activeIndex && <Pressable testID="announcement-close-button" accessibilityRole="button" accessibilityLabel={t("operations.dismissAllAnnouncements")} hitSlop={spacing.sm} onPress={dismiss} style={styles.close}>
                  <Ionicons name="close" size={26} color={colors.text} style={styles.closeIcon} />
                </Pressable>}
                {index === activeIndex && visibleSlides.length > 1 && <View testID="announcement-indicators" style={styles.indicators} accessibilityLiveRegion="polite">
                  {visibleSlides.map(({ announcement: indicatorItem, organizationId: indicatorTenantId }, indicatorIndex) => <View key={`${indicatorTenantId}:${indicatorItem.id}`} accessible accessibilityRole="text" accessibilityLabel={`${indicatorIndex === activeIndex ? "●" : "○"} ${indicatorIndex + 1}/${visibleSlides.length}`} style={[styles.indicator, indicatorIndex === activeIndex && styles.indicatorActive]} />)}
                </View>}
              </View>;
            })}
        </ScrollView>
        <View style={styles.actions}>
          <View testID="announcement-image-actions" style={styles.imageActions}>
            <Button style={styles.imageAction} variant="secondary" disabled={busyAction !== null} loading={busyAction === "download"} leadingIcon={<Ionicons name="download-outline" size={18} color={colors.text} />} onPress={() => void downloadActiveImage()}>{t("operations.downloadImage")}</Button>
            <Button style={styles.imageAction} variant="secondary" disabled={busyAction !== null} loading={busyAction === "share"} leadingIcon={<Ionicons name="share-outline" size={18} color={colors.text} />} onPress={() => void shareActiveImage()}>{t("operations.shareImage")}</Button>
          </View>
          {announcement.requiresAcknowledgement && !announcement.acknowledgedByMe && <Button loading={acknowledging} onPress={() => void acknowledgeActive()}>{t("operations.acknowledge")}</Button>}
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md, backgroundColor: colors.overlay },
  dialog: { width: "100%", maxWidth: 560, alignItems: "center", backgroundColor: "transparent" },
  close: { position: "absolute", top: spacing.sm, right: spacing.sm, zIndex: 2, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  closeIcon: { textShadowColor: "rgba(0, 0, 0, 0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  slider: { flexGrow: 0, width: "100%" },
  slides: { alignItems: "stretch" },
  slide: { position: "relative", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "transparent" },
  indicators: { position: "absolute", bottom: spacing.sm, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: "rgba(0, 0, 0, 0.4)" },
  indicator: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.58)" },
  indicatorActive: { width: 18, backgroundColor: colors.surface },
  actions: { width: "100%", maxWidth: 560, paddingTop: spacing.sm, gap: spacing.sm },
  imageActions: { flexDirection: "row", gap: spacing.sm },
  imageAction: { flex: 1 },
});
