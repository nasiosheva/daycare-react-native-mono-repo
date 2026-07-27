import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

type ToggleSwitchProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ToggleSwitch({ label, value, onValueChange, accessibilityLabel, description, disabled = false, style }: ToggleSwitchProps) {
  return <View style={[styles.container, style]}>
    <View style={styles.copy}>
      <AppText variant="label">{label}</AppText>
      {description && <AppText tone="muted">{description}</AppText>}
    </View>
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.track, value && styles.trackOn, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  track: { width: 48, height: 28, justifyContent: "center", padding: 3, borderRadius: radius.pill, backgroundColor: colors.disabled },
  trackOn: { alignItems: "flex-end", backgroundColor: colors.primary },
  thumb: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.surface },
  thumbOn: { backgroundColor: colors.onPrimary },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
});
