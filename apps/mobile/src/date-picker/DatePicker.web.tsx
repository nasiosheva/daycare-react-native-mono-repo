import { StyleSheet } from "react-native";
import { colors, radius, spacing } from "@daycare/ui";
import type { DatePickerProps } from "./types";

export function DatePicker({ value, onChange, placeholder, mode = "date", minimumDate, maximumDate, disabled = false, onClear, clearAccessibilityLabel }: DatePickerProps) {
  return <div style={styles.container}>
    <input aria-label={placeholder} type={mode} value={value} min={minimumDate} max={maximumDate} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} style={styles.input} />
    {Boolean(value && onClear) && <button aria-label={clearAccessibilityLabel} type="button" disabled={disabled} onClick={onClear} style={styles.clear}>×</button>}
  </div>;
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  input: { flex: 1, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  clear: { width: 48, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 20 },
});
