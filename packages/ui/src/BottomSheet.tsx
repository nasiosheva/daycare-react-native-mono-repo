import { useCallback, useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { colors, radius, spacing } from "./theme";

type BottomSheetAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
};

type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeAccessibilityLabel?: string;
  negativeAction?: BottomSheetAction;
  positiveAction?: BottomSheetAction;
}>;

export function BottomSheet({ visible, onClose, title, children, negativeAction, positiveAction, closeAccessibilityLabel = "Close" }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const dismiss = useCallback(() => {
    Animated.timing(translateY, { toValue: 420, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose, translateY]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 120 || gesture.vy > 1.2) dismiss();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
  }), [dismiss, translateY]);

  useEffect(() => { if (visible) translateY.setValue(0); }, [translateY, visible]);

  return <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={closeAccessibilityLabel} style={StyleSheet.absoluteFill} onPress={dismiss} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={styles.handle} />
        </View>
        <View style={styles.header}>
          {title ? <AppText variant="heading" style={styles.title}>{title}</AppText> : <View style={styles.title} />}
          <Pressable accessibilityRole="button" accessibilityLabel={closeAccessibilityLabel} hitSlop={spacing.sm} onPress={dismiss} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Ionicons name="close" size={22} color={colors.primary} />
          </Pressable>
        </View>
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {children}
        </ScrollView>
        {(negativeAction || positiveAction) && <View style={styles.actions}>
          {negativeAction && <Button style={styles.actionButton} variant={negativeAction.variant ?? "secondary"} disabled={negativeAction.disabled} loading={negativeAction.loading} onPress={negativeAction.onPress}>{negativeAction.label}</Button>}
          {positiveAction && <Button style={styles.actionButton} variant={positiveAction.variant ?? "primary"} disabled={positiveAction.disabled} loading={positiveAction.loading} onPress={positiveAction.onPress}>{positiveAction.label}</Button>}
        </View>}
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(61, 38, 50, 0.42)" },
  sheet: { maxHeight: "88%", paddingBottom: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  dragArea: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs },
  handle: { width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingLeft: spacing.md, paddingRight: spacing.sm },
  title: { flex: 1 },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTint },
  contentScroll: { flexShrink: 1 },
  content: { gap: spacing.md, paddingHorizontal: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  actionButton: { flex: 1 },
  pressed: { opacity: 0.7 },
});
