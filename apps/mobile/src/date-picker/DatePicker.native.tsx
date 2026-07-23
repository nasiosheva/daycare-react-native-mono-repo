import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { dateFromIsoDate, dateFromIsoTime, formatIsoDate, formatIsoTime } from "./date";
import type { DatePickerProps } from "./types";

export function DatePicker({ value, onChange, placeholder, mode = "date", minimumDate, maximumDate, disabled = false, onClear, clearAccessibilityLabel }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setIsOpen(false);
    if (event.type === "set" && selectedDate) onChange(mode === "date" ? formatIsoDate(selectedDate) : formatIsoTime(selectedDate));
  };

  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel={placeholder} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setIsOpen(true)} style={({ pressed }) => [styles.input, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <AppText tone={value ? "default" : "muted"}>{value || placeholder}</AppText>
    </Pressable>
    {Boolean(value && onClear) && <Pressable accessibilityRole="button" accessibilityLabel={clearAccessibilityLabel} onPress={onClear} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}><AppText variant="label">×</AppText></Pressable>}
    {isOpen && <DateTimePicker value={mode === "date" ? dateFromIsoDate(value) : dateFromIsoTime(value)} mode={mode} display="default" minimumDate={mode === "date" && minimumDate ? dateFromIsoDate(minimumDate) : undefined} maximumDate={mode === "date" && maximumDate ? dateFromIsoDate(maximumDate) : undefined} onChange={onPickerChange} />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  input: { flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  clear: { width: 48, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  disabled: { backgroundColor: colors.disabled },
  pressed: { opacity: 0.82 },
});
