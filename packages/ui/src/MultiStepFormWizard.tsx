import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";
import { isWizardConnectorActive, normalizeWizardStepIndex, shouldScrollWizardSteps, type MultiStepFormWizardStep } from "./wizardSteps";

const SCROLL_STEP_WIDTH = 128;

export type MultiStepFormWizardProps = PropsWithChildren<{
  steps: readonly MultiStepFormWizardStep[];
  currentStep: number;
  progressLabel?: ReactNode;
  accessibilityLabel?: string;
}>;

export function MultiStepFormWizard({ steps, currentStep, progressLabel, accessibilityLabel, children }: MultiStepFormWizardProps) {
  const scrollRef = useRef<ScrollView>(null);
  const normalizedStep = normalizeWizardStepIndex(currentStep, steps.length);
  const scrollable = shouldScrollWizardSteps(steps.length);

  useEffect(() => {
    if (scrollable) scrollRef.current?.scrollTo({ x: normalizedStep * (SCROLL_STEP_WIDTH + spacing.sm), animated: true });
  }, [normalizedStep, scrollable]);

  const stepItems = steps.map((step, index) => <View
    key={step.id}
    accessible
    accessibilityLabel={`${index + 1}. ${step.label}`}
    accessibilityState={{ selected: index === normalizedStep }}
    style={[styles.stepItem, scrollable ? styles.scrollStepItem : styles.inlineStepItem]}
  >
    <View style={styles.stepMarkerRow}>
      <View style={[
        styles.connector,
        index === 0 && styles.connectorHidden,
        index > 0 && isWizardConnectorActive(index, normalizedStep) && styles.connectorActive,
      ]} />
      <View style={[styles.stepCircle, index <= normalizedStep && styles.stepCircleActive]}>
        <AppText variant="label" style={index <= normalizedStep ? styles.stepNumberActive : styles.stepNumber}>{index + 1}</AppText>
      </View>
      <View style={[
        styles.connector,
        index === steps.length - 1 && styles.connectorHidden,
        index < steps.length - 1 && isWizardConnectorActive(index + 1, normalizedStep) && styles.connectorActive,
      ]} />
    </View>
    <AppText variant="caption" style={index === normalizedStep ? styles.stepLabelActive : styles.stepLabel}>{step.label}</AppText>
  </View>);

  return <View style={styles.container}>
    {steps.length > 0 && <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 1, max: steps.length, now: normalizedStep + 1 }}
      style={styles.progress}
    >
      {scrollable
        ? <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollSteps}>{stepItems}</ScrollView>
        : <View style={styles.inlineSteps}>{stepItems}</View>}
      {progressLabel != null && <AppText variant="caption" tone="muted">{progressLabel}</AppText>}
    </View>}
    <View style={styles.content}>{children}</View>
  </View>;
}

export type { MultiStepFormWizardStep } from "./wizardSteps";

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  progress: { gap: spacing.xs },
  inlineSteps: { flexDirection: "row", alignItems: "flex-start" },
  scrollSteps: { alignItems: "flex-start", paddingRight: spacing.md },
  stepItem: { alignItems: "center", gap: spacing.xs },
  inlineStepItem: { flex: 1 },
  scrollStepItem: { width: SCROLL_STEP_WIDTH },
  stepMarkerRow: { width: "100%", flexDirection: "row", alignItems: "center" },
  connector: { flex: 1, height: 2, backgroundColor: colors.surface },
  connectorActive: { backgroundColor: colors.primary },
  connectorHidden: { backgroundColor: "transparent" },
  stepCircle: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stepCircleActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepNumber: { color: colors.muted },
  stepNumberActive: { color: colors.onPrimary },
  stepLabel: { color: colors.muted, textAlign: "center" },
  stepLabelActive: { color: colors.primary, textAlign: "center", fontWeight: "700" },
  content: { gap: spacing.md },
});
