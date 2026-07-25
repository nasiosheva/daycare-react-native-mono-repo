import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "./theme";
import { AppText } from "./AppText";
import { subscribeInlineFeedback, type InlineFeedback } from "./InlineFeedback";

export type ScreenProps = PropsWithChildren<{ title?: string; header?: ReactNode; headerAction?: ReactNode; footer?: ReactNode; floatingAction?: ReactNode; showAppBar?: boolean }>;

export function Screen({ children, title, header, headerAction, footer, floatingAction, showAppBar }: ScreenProps) {
  const shouldShowAppBar = showAppBar ?? Boolean(title || header);
  const [feedback, setFeedback] = useState<InlineFeedback>();

  useEffect(() => subscribeInlineFeedback(setFeedback), []);
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(undefined), 7000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  return <SafeAreaView style={styles.safe}>
    {shouldShowAppBar && <View style={styles.appBar}>
      {header && <View style={styles.leading}>{header}</View>}
      <AppText variant="heading" numberOfLines={1} style={styles.title}>{title ?? "Umur Emas"}</AppText>
      {headerAction && <View style={styles.headerAction}>{headerAction}</View>}
    </View>}
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {feedback && <View accessibilityRole="alert" style={styles.feedback}>
        <AppText variant="label">{feedback.title}</AppText>
        {feedback.message && <AppText variant="caption">{feedback.message}</AppText>}
      </View>}
      {children}
    </ScrollView>
    {floatingAction && <View pointerEvents="box-none" style={[styles.floatingAction, footer ? styles.floatingActionWithFooter : undefined]}>{floatingAction}</View>}
    {footer && <View style={styles.footer}>{footer}</View>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  appBar: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  leading: { flexShrink: 0 },
  title: { flex: 1 },
  headerAction: { flexShrink: 0 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md, width: "100%", maxWidth: 1080, alignSelf: "center" },
  feedback: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, backgroundColor: colors.surfaceTint },
  floatingAction: { position: "absolute", right: spacing.md, bottom: spacing.md },
  floatingActionWithFooter: { bottom: 76 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
