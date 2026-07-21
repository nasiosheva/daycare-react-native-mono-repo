import { Platform, Pressable, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

export function BackButton({ onPress, accessibilityLabel = "Back" }: { onPress: () => void; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={spacing.sm} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <AppText style={styles.arrow}>{Platform.OS === "ios" ? "‹" : "←"}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  pressed: { backgroundColor: colors.surfaceTint },
  arrow: { color: colors.primary, fontSize: 28, lineHeight: 32 },
});
