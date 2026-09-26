import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, radius } from "./theme";

type AvatarProps = { name: string; size?: "sm" | "md" | "lg"; style?: StyleProp<ViewStyle> };

const sizes = { sm: 36, md: 44, lg: 64 } as const;

/** Initial-letter avatar so people and children are recognisable at a glance in long lists. */
export function Avatar({ name, size = "md", style }: AvatarProps) {
  const dimension = sizes[size];
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.avatar, { width: dimension, height: dimension }, style]}>
    <AppText variant={size === "lg" ? "h4" : size === "md" ? "h6" : "label"} style={styles.initial}>{name.trim().charAt(0).toUpperCase() || "?"}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primary },
  initial: { color: colors.onPrimary },
});
