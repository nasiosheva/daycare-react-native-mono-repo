import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, colors, radius, spacing } from "@daycare/ui";

export { paymentStepForInvoice } from "./paymentStep";

/** Tells the parent where they are in the transfer → upload proof → verification flow. */
export function PaymentSteps({ current, labels }: { current: number; labels: string[] }) {
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: labels.length, now: Math.min(current, labels.length) }} style={styles.steps}>
    {labels.map((label, index) => {
      const step = index + 1;
      const done = step < current;
      const active = step === current;
      return <View key={label} style={styles.step}>
        <View style={[styles.stepDot, (done || active) && styles.stepDotActive]}>
          {done ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : <AppText variant="caption" style={active ? styles.stepNumberActive : styles.stepNumber}>{step}</AppText>}
        </View>
        <AppText variant="caption" tone={active ? "default" : "muted"} style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</AppText>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: spacing.sm },
  step: { flex: 1, alignItems: "center", gap: spacing.xs },
  stepDot: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stepDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepNumber: { color: colors.muted },
  stepNumberActive: { color: colors.onPrimary },
  stepLabel: { textAlign: "center" },
  stepLabelActive: { fontWeight: "700" },
});
