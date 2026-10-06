import { useEffect, useState, type PropsWithChildren, type ReactNode, type RefObject } from "react";
import { Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { backgroundGradient, colors, radius, shadows, spacing, toneColors, toneIcons } from "./theme";
import { AppText } from "./AppText";
import { appBrandName } from "./brand";
import { inlineFeedbackDuration, subscribeInlineFeedback, type InlineFeedback } from "./InlineFeedback";

export type ScreenProps = PropsWithChildren<{ title?: string; header?: ReactNode; headerAction?: ReactNode; footer?: ReactNode; floatingAction?: ReactNode; scrollViewRef?: RefObject<ScrollView | null>; onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void; showAppBar?: boolean; refreshing?: boolean; onRefresh?: () => void; feedbackDismissLabel?: string }>;

export function Screen({ children, title, header, headerAction, footer, floatingAction, scrollViewRef, onScroll, showAppBar, refreshing = false, onRefresh, feedbackDismissLabel = "Close" }: ScreenProps) {
  const shouldShowAppBar = showAppBar ?? Boolean(title || header);
  const [feedback, setFeedback] = useState<InlineFeedback>();

  useEffect(() => subscribeInlineFeedback(setFeedback), []);
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(undefined), inlineFeedbackDuration(feedback));
    return () => clearTimeout(timeout);
  }, [feedback]);

  return <LinearGradient colors={backgroundGradient.colors} locations={backgroundGradient.locations} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradient}>
    <SafeAreaView style={styles.safe}>
      {shouldShowAppBar && <View style={styles.appBar}>
        {header && <View style={styles.leading}>{header}</View>}
        <AppText variant="heading" numberOfLines={1} style={styles.title}>{title ?? appBrandName}</AppText>
        {headerAction && <View style={styles.headerAction}>{headerAction}</View>}
      </View>}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, floatingAction ? styles.contentWithFloatingAction : undefined]}
        refreshControl={onRefresh && Platform.OS !== "web" ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
      >
        {children}
      </ScrollView>
      {feedback && <FeedbackToast feedback={feedback} topOffset={shouldShowAppBar ? 64 : spacing.sm} dismissLabel={feedbackDismissLabel} onDismiss={() => setFeedback(undefined)} />}
      {floatingAction && <View pointerEvents="box-none" style={[styles.floatingAction, footer ? styles.floatingActionWithFooter : undefined]}>{floatingAction}</View>}
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  </LinearGradient>;
}

/**
 * Pinned above the scroll content so it stays visible no matter how far the
 * user has scrolled when a save succeeds or fails.
 */
function FeedbackToast({ feedback, topOffset, dismissLabel, onDismiss }: { feedback: InlineFeedback; topOffset: number; dismissLabel: string; onDismiss: () => void }) {
  const tone = feedback.tone ?? "info";
  const palette = toneColors[tone];
  return <View pointerEvents="box-none" style={[styles.toastContainer, { top: topOffset }]}>
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, { borderColor: palette.foreground }]}>
      <Ionicons name={toneIcons[tone]} size={22} color={palette.foreground} />
      <View style={styles.toastCopy}>
        <AppText variant="label">{feedback.title}</AppText>
        {feedback.message && <AppText variant="bodySmall" tone="muted">{feedback.message}</AppText>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} hitSlop={spacing.sm} onPress={onDismiss} style={({ pressed }) => [styles.toastClose, pressed && styles.toastClosePressed]}>
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  appBar: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, zIndex: 1, ...shadows.sm },
  leading: { flexShrink: 0 },
  title: { flex: 1 },
  headerAction: { flexShrink: 0 },
  scroll: { flex: 1 },
  // Leaves room so the floating action button never covers the last item.
  contentWithFloatingAction: { paddingBottom: 96 },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md, width: "100%", maxWidth: 1080, alignSelf: "center" },
  toastContainer: { position: "absolute", left: spacing.md, right: spacing.md, zIndex: 10, alignItems: "center" },
  toast: { width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surface, ...shadows.md },
  toastCopy: { flex: 1, gap: spacing.xs / 2 },
  toastClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  toastClosePressed: { backgroundColor: colors.surfaceTint },
  floatingAction: { position: "absolute", right: spacing.md, bottom: spacing.md },
  floatingActionWithFooter: { bottom: 76 },
  footer: { backgroundColor: colors.surface, ...shadows.md, shadowOffset: { width: 0, height: -4 } },
});
