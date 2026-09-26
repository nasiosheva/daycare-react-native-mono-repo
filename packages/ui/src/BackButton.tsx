import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "./theme";

export function BackButton({ onPress, accessibilityLabel = "Back" }: { onPress: () => void; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={spacing.sm} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Ionicons name="chevron-back" size={26} color={colors.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  pressed: { backgroundColor: colors.surfaceTint },
});
