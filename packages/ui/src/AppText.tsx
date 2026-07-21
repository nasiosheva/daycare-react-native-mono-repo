import type { PropsWithChildren } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, typography } from "./theme";

export type AppTextVariant = keyof typeof typography | "title" | "heading";
type Props = PropsWithChildren<TextProps & { variant?: AppTextVariant; tone?: "default" | "muted" | "danger" }>;

export function AppText({ children, variant = "body", tone = "default", style, ...props }: Props) {
  return <Text {...props} style={[styles.base, styles[variant], styles[tone], style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  ...typography,
  title: typography.h1,
  heading: typography.h4,
  default: { color: colors.text },
  muted: { color: colors.muted },
  danger: { color: colors.danger },
});
