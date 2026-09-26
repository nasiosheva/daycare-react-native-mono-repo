import { forwardRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors, radius, spacing, typography } from "./theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

export type TextFieldProps = Omit<TextInputProps, "style"> & {
  /** Visible label above the input. Always prefer a label over a placeholder-only field. */
  label?: string;
  /** Short guidance shown under the input while there is no error. */
  hint?: string;
  /** Error shown under the input; also turns the border red. */
  error?: string | null;
  required?: boolean;
  leadingIcon?: IoniconName;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, hint, error, required = false, leadingIcon, trailing, containerStyle, multiline, editable = true, onFocus, onBlur, accessibilityLabel, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const iconColor = hasError ? colors.danger : focused ? colors.primary : colors.muted;
  return <View style={[styles.container, containerStyle]}>
    {label && <View style={styles.labelRow}>
      <AppText variant="label">{label}</AppText>
      {required && <AppText variant="label" tone="danger" accessibilityElementsHidden importantForAccessibility="no">*</AppText>}
    </View>}
    <View style={[styles.field, multiline && styles.fieldMultiline, focused && styles.fieldFocused, hasError && styles.fieldError, !editable && styles.fieldDisabled]}>
      {leadingIcon && <Ionicons name={leadingIcon} size={20} color={iconColor} style={multiline ? styles.leadingIconMultiline : undefined} />}
      <TextInput
        ref={ref}
        {...props}
        editable={editable}
        multiline={multiline}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error ?? hint}
        aria-invalid={hasError}
        placeholderTextColor={colors.muted}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
      {trailing}
    </View>
    {hasError
      ? <View style={styles.messageRow}><Ionicons name="alert-circle" size={14} color={colors.danger} /><AppText variant="caption" tone="danger" style={styles.message}>{error}</AppText></View>
      : hint && <AppText variant="caption" tone="muted">{hint}</AppText>}
  </View>;
});

type SearchFieldProps = Omit<TextFieldProps, "leadingIcon" | "trailing" | "onChangeText" | "value"> & {
  value: string;
  onChangeText: (value: string) => void;
  clearAccessibilityLabel?: string;
};

export function SearchField({ value, onChangeText, clearAccessibilityLabel = "Clear search", ...props }: SearchFieldProps) {
  return <TextField
    {...props}
    value={value}
    onChangeText={onChangeText}
    leadingIcon="search"
    returnKeyType="search"
    autoCorrect={false}
    trailing={value ? <Pressable accessibilityRole="button" accessibilityLabel={clearAccessibilityLabel} hitSlop={spacing.sm} onPress={() => onChangeText("")} style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}>
      <Ionicons name="close-circle" size={20} color={colors.muted} />
    </Pressable> : undefined}
  />;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  labelRow: { flexDirection: "row", gap: 2 },
  field: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  fieldMultiline: { alignItems: "flex-start", paddingVertical: spacing.sm },
  fieldFocused: { borderColor: colors.primary, borderWidth: 2, paddingHorizontal: spacing.md - 1 },
  fieldError: { borderColor: colors.danger },
  fieldDisabled: { backgroundColor: colors.disabled },
  input: { flex: 1, minHeight: 46, color: colors.text, ...typography.body, paddingVertical: 0 },
  inputMultiline: { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.xs },
  leadingIconMultiline: { marginTop: spacing.xs },
  messageRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  message: { flex: 1 },
  clear: { borderRadius: 999 },
  clearPressed: { opacity: 0.6 },
});
