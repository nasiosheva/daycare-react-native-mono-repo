import { useState } from "react";
import { Pressable, StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing, typography } from "./theme";

type PasswordInputProps = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  showLabel?: string;
  hideLabel?: string;
  showAccessibilityLabel?: string;
  hideAccessibilityLabel?: string;
};

export function PasswordInput({ containerStyle, inputStyle, accessibilityLabel = "Password", showLabel = "Show", hideLabel = "Hide", showAccessibilityLabel, hideAccessibilityLabel, onFocus, onBlur, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const actionLabel = visible ? hideLabel : showLabel;
  const actionAccessibilityLabel = visible ? (hideAccessibilityLabel ?? hideLabel) : (showAccessibilityLabel ?? showLabel);

  return <View style={[styles.container, focused && styles.containerFocused, containerStyle]}>
    <TextInput {...props} accessibilityLabel={accessibilityLabel} secureTextEntry={!visible} placeholderTextColor={colors.muted} onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }} style={[styles.input, inputStyle]} />
    <Pressable accessibilityRole="button" accessibilityLabel={actionAccessibilityLabel} accessibilityState={{ selected: visible }} hitSlop={spacing.sm} onPress={() => setVisible((current) => !current)} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <AppText variant="caption" style={styles.actionLabel}>{actionLabel}</AppText>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 48, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  containerFocused: { borderColor: colors.primary, borderWidth: 2 },
  input: { flex: 1, minHeight: 44, paddingHorizontal: spacing.md, color: colors.text, ...typography.body },
  action: { alignSelf: "stretch", justifyContent: "center", paddingHorizontal: spacing.md },
  actionPressed: { opacity: 0.7 },
  actionLabel: { color: colors.primary, fontWeight: "700" },
});
