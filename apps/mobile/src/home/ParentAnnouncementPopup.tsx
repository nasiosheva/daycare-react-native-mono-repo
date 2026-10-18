// Mories Deo Hutapea,S.E.,S.Kom
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { ParentAnnouncementSlide } from "@/home/parentHomeSummary";
import { parentActionRoute } from "@/announcements/actionDestination";
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
  const imageSlides = useMemo(() => announcements.filter(({ announcement }) => Boolean(announcement.imageUrl && isValidHttpsImageUrl(announcement.imageUrl))), [announcements]);
  const visibleSlides = useMemo(() => imageSlides.filter(({ announcement, organizationId }) => !dismissedIds.has(`${organizationId}:${announcement.id}`)), [imageSlides, dismissedIds]);
  const { activeIndex, setActiveIndex, pauseAutoAdvance, resumeAutoAdvance } = useAutoAdvanceCarousel(visibleSlides.length);
  const slideSignature = announcements.map(({ announcement, organizationId }) => `${organizationId}:${announcement.id}`).join("|");
  const activeSlide = visibleSlides[Math.min(activeIndex, Math.max(0, visibleSlides.length - 1))];
  const cardWidth = Math.min(windowWidth - spacing.lg * 2, 560);
  const dismiss = () => {
    setDismissedIds((current) => new Set([...current, ...visibleSlides.map(({ announcement, organizationId }) => `${organizationId}:${announcement.id}`)]));
    setActiveIndex(0);
  };
  const dismissActive = () => {
    if (!activeSlide) return;
    setDismissedIds((current) => new Set(current).add(`${activeSlide.organizationId}:${activeSlide.announcement.id}`));
    setActiveIndex(0);
  };
  const openAction = async (slide: ParentAnnouncementSlide) => {
    const actionType = slide.announcement.actionType ?? "NONE";
    const actionTarget = slide.announcement.actionTarget;
    const appRoute = actionType === "OPEN_APP_PAGE" ? parentActionRoute(actionTarget) : null;
    const hasAction = actionType === "OPEN_BROWSER" ? Boolean(actionTarget && isValidHttpsUrl(actionTarget)) : Boolean(appRoute);
    if (!hasAction) return;
    if (actionType === "OPEN_BROWSER" && actionTarget) {
      try {
        await Linking.openURL(actionTarget);
        dismiss();
      } catch (error) {
        notify(t("operations.actionOpenFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger");
      }
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
        <View style={styles.toolbar}>
          <AppText variant="h5" numberOfLines={1} style={styles.toolbarTitle}>{t("operations.announcements")}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t("operations.dismissAllAnnouncements")} hitSlop={spacing.sm} onPress={dismiss} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScrollBeginDrag={pauseAutoAdvance} onScrollEndDrag={onMomentumScrollEnd} onMomentumScrollEnd={onMomentumScrollEnd} style={styles.slider} contentContainerStyle={styles.slides}>
          {visibleSlides.map(({ announcement: item, organizationId: tenantId, organizationName: tenantName }) => {
            const itemActionType = item.actionType ?? "NONE";
            const itemActionTarget = item.actionTarget;
            const itemRoute = itemActionType === "OPEN_APP_PAGE" ? parentActionRoute(itemActionTarget) : null;
            const itemHasAction = itemActionType === "OPEN_BROWSER"
              ? Boolean(itemActionTarget && isValidHttpsUrl(itemActionTarget))
              : Boolean(itemRoute);
            const image = <FallbackImage key={`${item.id}:${item.imageUrl}`} accessibilityLabel={`${tenantName}: ${item.title}`} fallbackLabel={t("operations.imageUnavailable")} uri={item.imageUrl!} style={styles.image} />;
            return <View key={`${tenantId}:${item.id}`} style={[styles.slide, { width: cardWidth }]}>
              {itemHasAction
                ? <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => void openAction({ announcement: item, organizationId: tenantId, organizationName: tenantName })}>{image}</Pressable>
                : image}
            </View>;
          })}
        </ScrollView>
        {visibleSlides.length > 1 && <View style={styles.indicators} accessibilityLiveRegion="polite">
          {visibleSlides.map(({ announcement: item, organizationId: tenantId }, index) => <View key={`${tenantId}:${item.id}`} accessible accessibilityRole="text" accessibilityLabel={`${index === activeIndex ? "●" : "○"} ${index + 1}/${visibleSlides.length}`} style={[styles.indicator, index === activeIndex && styles.indicatorActive]} />)}
        </View>}
        <View style={styles.actions}>
          {announcement.requiresAcknowledgement && !announcement.acknowledgedByMe && <Button loading={acknowledging} onPress={() => void acknowledgeActive()}>{t("operations.acknowledge")}</Button>}
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md, backgroundColor: colors.overlay },
  dialog: { width: "100%", maxWidth: 600, overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  toolbarTitle: { flex: 1 },
  close: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTint },
  slider: { flexGrow: 0 },
  slides: { alignItems: "stretch" },
  slide: { justifyContent: "center" },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceTint },
  indicators: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: spacing.xs, paddingBottom: spacing.sm },
  indicator: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.border },
  indicatorActive: { width: 18, backgroundColor: colors.primary },
  actions: { gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
