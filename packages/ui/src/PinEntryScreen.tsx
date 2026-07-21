import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Screen } from "./Screen";
import { colors, radius, spacing } from "./theme";

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type PinEntryScreenProps = {
  value: string;
  onChange: (value: string) => void;
  pinLength?: number;
  title?: string;
  description?: string;
  header?: ReactNode;
  onComplete?: (pin: string) => void;
  enteredDigitsAccessibilityLabel?: string;
  deleteAccessibilityLabel?: string;
};

export function PinEntryScreen({ value, onChange, pinLength = 6, title = "Enter PIN", description, header, onComplete, enteredDigitsAccessibilityLabel, deleteAccessibilityLabel = "Delete last digit" }: PinEntryScreenProps) {
  const maximumLength = Math.max(1, pinLength);
  const appendDigit = (digit: string) => {
    if (value.length >= maximumLength) return;
    const nextValue = `${value}${digit}`;
    onChange(nextValue);
    if (nextValue.length === maximumLength) onComplete?.(nextValue);
  };
  const removeDigit = () => onChange(value.slice(0, -1));

  return <Screen title={title} header={header}>
    {description && <AppText tone="muted">{description}</AppText>}
    <View accessibilityLabel={enteredDigitsAccessibilityLabel ?? `${value.length} of ${maximumLength} PIN digits entered`} style={styles.indicators}>
      {Array.from({ length: maximumLength }, (_, index) => <View key={index} style={[styles.indicator, index < value.length && styles.indicatorFilled]} />)}
    </View>
    <View style={styles.keypad}>
      {digits.map((digit) => <PinKey key={digit} label={digit} onPress={() => appendDigit(digit)} />)}
      <PinKey label="0" onPress={() => appendDigit("0")} />
      <PinKey label="⌫" accessibilityLabel={deleteAccessibilityLabel} onPress={removeDigit} disabled={value.length === 0} />
    </View>
  </Screen>;
}

function PinKey({ label, onPress, accessibilityLabel, disabled = false }: { label: string; onPress: () => void; accessibilityLabel?: string; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.key, disabled && styles.keyDisabled, pressed && !disabled && styles.keyPressed]}>
    <AppText variant="heading" style={styles.keyLabel}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  indicators: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  indicator: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.disabled },
  indicatorFilled: { backgroundColor: colors.primary },
  keypad: { alignSelf: "center", width: "100%", maxWidth: 340, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  key: { width: "30%", minHeight: 64, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  keyDisabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  keyPressed: { backgroundColor: colors.surfaceTint },
  keyLabel: { color: colors.primary },
});
