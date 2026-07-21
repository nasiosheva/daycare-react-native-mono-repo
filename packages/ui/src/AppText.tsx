import type { PropsWithChildren } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { colors } from "./theme";

type Variant = "title" | "heading" | "body" | "caption" | "label";
type Props = PropsWithChildren<TextProps & { variant?: Variant; tone?: "default" | "muted" | "danger" }>;

export function AppText({ children, variant = "body", tone = "default", style, ...props }: Props) {
  return <Text {...props} style={[styles.base, styles[variant], styles[tone], style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  default: { color: colors.text },
  muted: { color: colors.muted },
  danger: { color: colors.danger },
});
