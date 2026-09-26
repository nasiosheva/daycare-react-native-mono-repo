import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { radius, spacing, toneColors, toneIcons, type Tone } from "./theme";

type BannerProps = {
  title: string;
  message?: ReactNode;
  tone?: Tone;
  /** Optional call to action, e.g. a Button. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Inline, persistent notice: errors on a form, read-only mode, setup that needs attention. */
export function Banner({ title, message, tone = "info", action, style }: BannerProps) {
  const palette = toneColors[tone];
  return <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.banner, { backgroundColor: palette.background, borderColor: palette.border }, style]}>
    <Ionicons name={toneIcons[tone]} size={22} color={palette.foreground} />
    <View style={styles.copy}>
      <AppText variant="label" style={{ color: palette.foreground }}>{title}</AppText>
      {typeof message === "string" ? <AppText variant="bodySmall">{message}</AppText> : message}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.md },
  copy: { flex: 1, gap: spacing.xs },
  action: { marginTop: spacing.xs, alignSelf: "flex-start" },
});
