import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";

type Option<T extends string> = { value: T; label: string };

type OptionSelectFieldProps<T extends string> = {
  label: string;
  placeholder: string;
  emptyLabel: string;
  value?: T;
  options: readonly Option<T>[];
  onChange: (value: T | undefined) => void;
};

export function OptionSelectField<T extends string>({ label, placeholder, emptyLabel, value, options, onChange }: OptionSelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const close = () => setOpen(false);
  const select = (nextValue: T | undefined) => { onChange(nextValue); close(); };

  return <View style={styles.field}>
    <AppText variant="label">{label}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
      <AppText tone={selected ? "default" : "muted"}>{selected?.label ?? placeholder}</AppText>
      <AppText variant="label" tone="muted">⌄</AppText>
    </Pressable>
    <BottomSheet visible={open} onClose={close} closeAccessibilityLabel={emptyLabel} title={label} negativeAction={{ label: emptyLabel, onPress: () => select(undefined) }}>
      <View style={styles.options}>{options.map((option) => <Button key={option.value} variant={option.value === value ? "primary" : "secondary"} onPress={() => select(option.value)}>{option.label}</Button>)}</View>
    </BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { gap: spacing.sm },
  pressed: { opacity: 0.82 },
});
